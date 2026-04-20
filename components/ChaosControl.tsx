"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle, Loader2, Wrench, Rocket } from "lucide-react";

interface ChaosState {
  active: boolean;
  scene: number;
  timestamp: string | null;
  injectedFiles: string[];
}

type DeployPhase =
  | null
  | { kind: "injecting" }
  | { kind: "waiting-deploy"; expectActive: boolean; expectedScene: number; elapsed: number }
  | { kind: "reloading" };

const SCENE_DESCRIPTIONS: Record<number, string> = {
  1: "Null refs in data layer + currency formatter crash",
  2: "Division-by-zero in metrics + NaN dates + broken activity feed",
  3: "Undefined property access + null map() + NaN time display",
};

// How often to poll Vercel's deployed filesystem to detect when the new deploy is live
const POLL_MS = 4000;
// Safety ceiling — reload even if poll never matches (in case of deploy issues)
const MAX_WAIT_S = 120;

export default function ChaosControl() {
  const [state, setState] = useState<ChaosState>({ active: false, scene: 0, timestamp: null, injectedFiles: [] });
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<DeployPhase>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  function startWaitingForDeploy(expectActive: boolean, expectedScene: number) {
    setPhase({ kind: "waiting-deploy", expectActive, expectedScene, elapsed: 0 });

    let elapsed = 0;
    elapsedRef.current = setInterval(() => {
      elapsed += 1;
      setPhase((p) =>
        p?.kind === "waiting-deploy" ? { ...p, elapsed } : p
      );
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        // Poll /api/deployed-state — reads the CURRENT Vercel deployment's filesystem.
        // When it matches what we just committed to GitHub, the new deploy is live.
        const res = await fetch("/api/deployed-state", { cache: "no-store" });
        const deployed: ChaosState = await res.json();

        const matches =
          deployed.active === expectActive &&
          (!expectActive || deployed.scene === expectedScene);

        const timedOut = elapsed >= MAX_WAIT_S;

        if (matches || timedOut) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (elapsedRef.current) clearInterval(elapsedRef.current);
          setPhase({ kind: "reloading" });
          setTimeout(() => window.location.reload(), 800);
        }
      } catch {
        // ignore transient errors
      }
    }, POLL_MS);
  }

  async function injectErrors() {
    setLoading(true);
    setPhase({ kind: "injecting" });
    try {
      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inject" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Injection failed");
      setState((prev) => ({
        ...prev,
        active: true,
        scene: data.scene,
        injectedFiles: data.files,
      }));
      // Errors committed to GitHub → Vercel auto-deploys → poll until live
      startWaitingForDeploy(true, data.scene);
    } catch (e) {
      console.error("Inject failed:", e);
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  async function triggerFix() {
    setPhase({ kind: "injecting" }); // reuse "injecting" as a "committing" state
    try {
      const res = await fetch("/api/fix", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Fix failed");
      }
      // Clean files committed → Vercel auto-deploys → poll until live
      startWaitingForDeploy(false, state.scene);
    } catch (e) {
      console.error("Fix failed:", e);
      setPhase(null);
    }
  }

  const nextScene = (state.scene % 3) + 1;
  const isDeploying = phase !== null;
  const deployingFix = isDeploying && !state.active;
  const elapsed = phase?.kind === "waiting-deploy" ? phase.elapsed : null;

  function deployStatusText() {
    if (phase?.kind === "reloading") return "Reloading…";
    if (phase?.kind === "injecting") return deployingFix ? "Committing fix to GitHub…" : "Committing errors to GitHub…";
    if (phase?.kind === "waiting-deploy") {
      const action = deployingFix ? "Fix deployed" : "Errors injected";
      return `${action} · Waiting for Vercel (${elapsed}s)…`;
    }
    return "";
  }

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 backdrop-blur-sm ${
      isDeploying && deployingFix ? "border-emerald-500/30 bg-emerald-500/5" :
      isDeploying ? "border-indigo-500/30 bg-indigo-500/5" :
      state.active ? "border-red-500/30 bg-red-500/5" :
      "border-zinc-800 bg-zinc-900/50"
    }`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
            isDeploying && deployingFix ? "bg-emerald-500/15" :
            isDeploying ? "bg-indigo-500/15" :
            state.active ? "bg-red-500/10" : "bg-zinc-800"
          }`}>
            {isDeploying ? (
              <Rocket className={`h-4 w-4 ${deployingFix ? "text-emerald-400" : "text-indigo-400"}`} />
            ) : (
              <Zap className={`h-4 w-4 ${state.active ? "text-red-400" : "text-zinc-500"}`} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-100">Chaos Control</h3>
              {state.active && !isDeploying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-blink" />
                  Scene {state.scene} Active
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isDeploying
                ? deployStatusText()
                : state.active
                ? `Scene ${state.scene}: ${SCENE_DESCRIPTIONS[state.scene] ?? ""}`
                : "Inject real bugs into source code. Claude detects via PostHog and auto-fixes."}
            </p>
          </div>

          {state.active && !isDeploying && state.injectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.injectedFiles.map((f) => (
                <span key={f} className="text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/15 px-2 py-0.5 rounded">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {isDeploying ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 cursor-not-allowed">
              <Loader2 className="h-4 w-4 animate-spin" />
              {deployingFix ? "Deploying fix…" : "Deploying errors…"}
            </div>
          ) : state.active ? (
            <button
              onClick={triggerFix}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all duration-200"
            >
              <Wrench className="h-4 w-4" />
              Fix Errors
            </button>
          ) : (
            <button
              onClick={injectErrors}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {loading ? "Injecting…" : "Inject Next Errors"}
            </button>
          )}
        </div>
      </div>

      {!state.active && !isDeploying && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center gap-2 text-xs text-zinc-600">
          <AlertTriangle className="h-3 w-3" />
          <span>Next: Scene {nextScene} — {SCENE_DESCRIPTIONS[nextScene]}</span>
        </div>
      )}
    </div>
  );
}
