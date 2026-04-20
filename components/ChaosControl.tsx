"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle, Loader2, Wrench, Rocket } from "lucide-react";

interface ChaosState {
  active: boolean;
  scene: number;
  timestamp: string | null;
  injectedFiles: string[];
}

type Intent = "inject" | "fix";

type DeployPhase =
  | null
  | { kind: "committing"; intent: Intent }
  | { kind: "analyzing" }                              // Claude is analyzing errors
  | { kind: "deploying"; intent: Intent; elapsed: number }
  | { kind: "reloading"; intent: Intent };

const SCENE_DESCRIPTIONS: Record<number, string> = {
  1: "Null refs in data layer + currency formatter crash",
  2: "Division-by-zero in metrics + NaN dates + broken activity feed",
  3: "Undefined property access + null map() + NaN time display",
};

const POLL_MS = 4000;
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

  function stopTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
  }

  // Poll /api/deployed-state (reads the currently-live Vercel filesystem).
  // When the committed timestamp differs from what was live before the commit,
  // the new Vercel deployment is serving — safe to reload.
  function startPollingForDeploy(intent: Intent, priorTimestamp: string | null) {
    setPhase({ kind: "deploying", intent, elapsed: 0 });

    let elapsed = 0;
    elapsedRef.current = setInterval(() => {
      elapsed += 1;
      setPhase((p) => p?.kind === "deploying" ? { ...p, elapsed } : p);
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        // Cache-bust so we always hit the live deployment, not a CDN cache
        const res = await fetch(`/api/deployed-state?cb=${Date.now()}`, { cache: "no-store" });
        const deployed: ChaosState = await res.json();

        // The new deploy is live when its chaos-state timestamp has changed
        const isNewDeploy =
          deployed.timestamp !== priorTimestamp ||
          elapsed >= MAX_WAIT_S;

        if (isNewDeploy) {
          stopTimers();
          setPhase({ kind: "reloading", intent });
          setTimeout(() => window.location.reload(), 600);
        }
      } catch {
        // transient network error — keep polling
      }
    }, POLL_MS);
  }

  async function injectErrors() {
    setLoading(true);
    setPhase({ kind: "committing", intent: "inject" });

    try {
      // Snapshot the timestamp that is currently deployed BEFORE committing
      const priorRes = await fetch(`/api/deployed-state?cb=${Date.now()}`, { cache: "no-store" });
      const prior: ChaosState = await priorRes.json().catch(() => ({ timestamp: null }));

      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inject" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Injection failed");

      setState((prev) => ({ ...prev, active: true, scene: data.scene, injectedFiles: data.files }));
      startPollingForDeploy("inject", prior.timestamp ?? null);
    } catch (e) {
      console.error("Inject failed:", e);
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  async function triggerFix() {
    // Step 1: snapshot what's currently deployed
    const priorRes = await fetch(`/api/deployed-state?cb=${Date.now()}`, { cache: "no-store" });
    const prior: ChaosState = await priorRes.json().catch(() => ({ timestamp: null }));

    // Step 2: show "Claude analyzing" while the API calls Claude + commits
    setPhase({ kind: "analyzing" });

    try {
      const res = await fetch("/api/fix", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Fix failed");
      }

      // Step 3: Claude committed the fix — now wait for Vercel to redeploy
      startPollingForDeploy("fix", prior.timestamp ?? null);
    } catch (e) {
      console.error("Fix failed:", e);
      setPhase(null);
    }
  }

  const isDeploying = phase !== null;
  // Safe intent extraction — "analyzing" has no intent field but always means "fix"
  const intent: Intent | null =
    phase === null ? null :
    phase.kind === "analyzing" ? "fix" :
    (phase as { intent?: Intent }).intent ?? null;
  const elapsed = phase?.kind === "deploying" ? phase.elapsed : null;
  const nextScene = (state.scene % 3) + 1;

  function statusLine() {
    if (!phase) return "";
    if (phase.kind === "reloading") return "Deploy live — reloading page…";
    if (phase.kind === "analyzing") return "Claude is reading the broken files and generating a fix…";
    if (phase.kind === "committing") return "Committing error files to GitHub…";
    if (phase.kind === "deploying") {
      const action = phase.intent === "fix" ? "Fix committed by Claude" : "Errors injected in the code";
      return `${action} · Waiting for Vercel Deployment (${elapsed}s)…`;
    }
    return "";
  }

  const isFixing = intent === "fix" && isDeploying;
  const isInjecting = intent === "inject" && isDeploying;

  const borderColor =
    isFixing ? "border-emerald-500/30 bg-emerald-500/5" :
    isInjecting ? "border-indigo-500/30 bg-indigo-500/5" :
    state.active ? "border-red-500/30 bg-red-500/5" :
    "border-zinc-800 bg-zinc-900/50";

  const iconColor =
    isFixing ? "text-emerald-400" :
    isInjecting ? "text-indigo-400" :
    state.active ? "text-red-400" : "text-zinc-500";

  const iconBg =
    isFixing ? "bg-emerald-500/15" :
    isInjecting ? "bg-indigo-500/15" :
    state.active ? "bg-red-500/10" : "bg-zinc-800";

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 backdrop-blur-sm ${borderColor}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: icon + text + file badges */}
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
            {isDeploying ? (
              <Rocket className={`h-4 w-4 ${iconColor}`} />
            ) : (
              <Zap className={`h-4 w-4 ${iconColor}`} />
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
                ? statusLine()
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

        {/* Right: action button */}
        <div className="shrink-0">
          {isDeploying ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 cursor-not-allowed select-none">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isFixing ? "Deploying Claude's fix…" : "Deploying errors…"}
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
              {loading ? "Injecting…" : "Inject Errors"}
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
