"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle, CheckCircle2, Loader2, Wrench } from "lucide-react";

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

export default function ChaosControl() {
  const [state, setState] = useState<ChaosState>({ active: false, scene: 0, timestamp: null, injectedFiles: [] });
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);

  function startPollingForFix() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/chaos");
        const data: ChaosState = await res.json();
        if (!data.active) {
          if (pollRef.current) clearInterval(pollRef.current);
          setFixing(false);
          setState(data);
          startReloadCountdown();
        }
      } catch {
        // ignore
      }
    }, 4000);
  }

  function startReloadCountdown() {
    setCountdown(5);
    let n = 5;
    countdownRef.current = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        window.location.reload();
      }
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

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
    } catch (e) {
      console.error("Inject failed:", e);
    } finally {
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
      startPollingForFix();
    } catch (e) {
      console.error("Fix failed:", e);
      setFixing(false);
    }
  }

  const nextScene = (state.scene % 3) + 1;

  if (countdown !== null) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm p-5 flex items-center justify-center min-h-[160px]">
        <div className="text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-100">Fix deployed</p>
          <p className="text-xs text-zinc-500 mt-1">Reloading in <span className="text-emerald-400 font-mono">{countdown}s</span>...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 backdrop-blur-sm ${
      state.active ? "border-red-500/30 bg-red-500/5" : "border-zinc-800 bg-zinc-900/50"
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`h-4 w-4 ${state.active ? "text-red-400" : "text-zinc-500"}`} />
            <h3 className="text-sm font-semibold text-zinc-100">Chaos Control</h3>
            {state.active && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-blink" />
                Scene {state.scene} Active
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            {state.active
              ? "Live bugs injected into source. Claude agent will auto-fix."
              : "Inject real bugs into source code. Claude detects via PostHog and fixes automatically."}
          </p>

          {state.active && state.injectedFiles.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-zinc-500 mb-1.5">Affected files:</p>
              <div className="flex flex-wrap gap-1.5">
                {state.injectedFiles.map((f) => (
                  <span key={f} className="text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/15 px-2 py-0.5 rounded">
                    {f}
                  </span>
                ))}
              </div>
              {SCENE_DESCRIPTIONS[state.scene] && (
                <p className="text-xs text-zinc-500 mt-2">{SCENE_DESCRIPTIONS[state.scene]}</p>
              )}
            </div>
          )}

          {fixing && (
            <div className="flex items-center gap-2 text-xs text-indigo-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Agent is pushing fix to GitHub · Vercel redeploying…
            </div>
          )}
        </div>

        <div className="shrink-0">
          {state.active ? (
            <button
              onClick={triggerFix}
              disabled={fixing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4" />
              )}
              {fixing ? "Fixing…" : "Fix Errors"}
            </button>
          ) : (
            <button
              onClick={injectErrors}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {loading ? "Injecting…" : "Inject Next Errors"}
            </button>
          )}
        </div>
      </div>

      {!state.active && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center gap-2 text-xs text-zinc-600">
          <AlertTriangle className="h-3 w-3" />
          <span>Next: Scene {nextScene} — {SCENE_DESCRIPTIONS[nextScene]}</span>
        </div>
      )}
    </div>
  );
}
