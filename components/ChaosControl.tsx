"use client";

import { useState, useEffect } from "react";
import { Zap, AlertTriangle, CheckCircle, Loader2, ChevronRight } from "lucide-react";

interface ChaosState {
  active: boolean;
  scene: number;
  timestamp: string | null;
  injectedFiles: string[];
}

const SCENE_DESCRIPTIONS = [
  null,
  "Null reference errors in data layer + currency formatter crash",
  "Division-by-zero in metrics + broken activity timestamps",
  "ReferenceError in growth calculator + invalid date formatting + table crash",
];

export default function ChaosControl() {
  const [state, setState] = useState<ChaosState>({ active: false, scene: 0, timestamp: null, injectedFiles: [] });
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(true);

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);

  const nextScene = (state.scene % 3) + 1;

  async function triggerChaos() {
    setLoading(true);
    try {
      const res = await fetch("/api/chaos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inject" }),
      });

      if (res.status === 500) {
        const err = await res.json();
        if (err.message?.includes("GITHUB_TOKEN")) {
          setHasToken(false);
        }
        throw new Error(err.message);
      }

      const data = await res.json();
      setState((prev) => ({
        ...prev,
        active: true,
        scene: data.scene,
        timestamp: new Date().toISOString(),
        injectedFiles: data.files,
      }));
    } catch (e) {
      console.error("Chaos trigger failed:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 ${
      state.active
        ? "border-red-500/30 bg-red-500/5"
        : "border-zinc-800 bg-zinc-900/50"
    } backdrop-blur-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
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
            Injects real bugs into source code. Claude agent detects via PostHog and auto-fixes.
          </p>

          {!hasToken && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">
                <strong>GITHUB_TOKEN</strong> not configured. Add it to Vercel environment variables to enable cloud chaos injection.
              </p>
            </div>
          )}

          {state.active && state.injectedFiles.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-zinc-500 mb-1.5">Injected into:</p>
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

          {state.active && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              Errors published to PostHog · Agent monitoring for fix
            </div>
          )}
        </div>

        <button
          onClick={triggerChaos}
          disabled={loading}
          className={`flex items-center gap-2 shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            state.active
              ? "bg-red-500 hover:bg-red-600 text-white animate-pulse-ring"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {loading ? "Injecting..." : state.active ? `Next Scene` : "Trigger Chaos"}
          {!loading && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center gap-6 text-xs text-zinc-600">
        <span>Scene {nextScene} next</span>
        <span>·</span>
        <span>{SCENE_DESCRIPTIONS[nextScene]}</span>
      </div>
    </div>
  );
}
