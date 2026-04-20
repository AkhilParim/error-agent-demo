"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle, Loader2, Wrench, Rocket } from "lucide-react";

interface ChaosState {
  active: boolean;
  scene: number;
  timestamp: string | null;
  injectedFiles: string[];
}

const SCENE_DESCRIPTIONS: Record<number, string> = {
  1: "Null refs in data layer + currency formatter crash",
  2: "Division-by-zero in metrics + NaN dates + broken activity feed",
  3: "Undefined property access + null map() + NaN time display",
};

const DEPLOY_SECONDS = 45;

export default function ChaosControl() {
  const [state, setState] = useState<ChaosState>({ active: false, scene: 0, timestamp: null, injectedFiles: [] });
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  function startReloadCountdown() {
    setCountdown(DEPLOY_SECONDS);
    let n = DEPLOY_SECONDS;
    countdownRef.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        window.location.reload();
      }
    }, 1000);
  }

  async function injectErrors() {
    setLoading(true);
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
        timestamp: new Date().toISOString(),
        injectedFiles: data.files,
      }));
      // Wait for Vercel to redeploy with the broken files, then reload
      startReloadCountdown();
    } catch (e) {
      console.error("Inject failed:", e);
      setLoading(false);
    }
  }

  async function triggerFix() {
    setFixing(true);
    try {
      const res = await fetch("/api/fix", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Fix failed");
      }
      // Wait for Vercel to redeploy with the clean files, then reload
      startReloadCountdown();
    } catch (e) {
      console.error("Fix failed:", e);
      setFixing(false);
    }
  }

  const nextScene = (state.scene % 3) + 1;
  const isDeploying = countdown !== null;
  const deployingFix = isDeploying && (fixing || state.active);

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 backdrop-blur-sm ${
      state.active && !isDeploying ? "border-red-500/30 bg-red-500/5" :
      isDeploying && deployingFix ? "border-emerald-500/30 bg-emerald-500/5" :
      isDeploying ? "border-indigo-500/30 bg-indigo-500/5" :
      "border-zinc-800 bg-zinc-900/50"
    }`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
            isDeploying && deployingFix ? "bg-emerald-500/15" :
            isDeploying ? "bg-indigo-500/15" :
            state.active ? "bg-red-500/10" : "bg-zinc-800"
          }`}>
            {isDeploying && deployingFix ? (
              <Rocket className="h-4 w-4 text-emerald-400" />
            ) : isDeploying ? (
              <Rocket className="h-4 w-4 text-indigo-400" />
            ) : (
              <Zap className={`h-4 w-4 ${state.active ? "text-red-400" : "text-zinc-500"}`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">Chaos Control</h3>
              {state.active && !isDeploying && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-blink" />
                  Scene {state.scene} Active
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isDeploying && deployingFix
                ? `Fix committed · Vercel redeploying · reloading in ${countdown}s`
                : isDeploying
                ? `Errors injected · Vercel redeploying · reloading in ${countdown}s`
                : state.active
                ? `Scene ${state.scene}: ${SCENE_DESCRIPTIONS[state.scene] ?? ""}`
                : "Inject real bugs into source code. Claude detects via PostHog and fixes automatically."}
            </p>
          </div>

          {state.active && !isDeploying && state.injectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-1">
              {state.injectedFiles.map((f) => (
                <span key={f} className="text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/15 px-2 py-0.5 rounded">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isDeploying ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {deployingFix ? "Deploying fix…" : "Deploying errors…"}
            </div>
          ) : state.active ? (
            <button
              onClick={triggerFix}
              disabled={fixing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {fixing ? "Fixing…" : "Fix Errors"}
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
