"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertTriangle, Loader2, Rocket, Bot } from "lucide-react";

interface ChaosState {
  active: boolean;
  scene: number;
  timestamp: string | null;
  injectedFiles: string[];
}

type DeployPhase =
  | null
  | { kind: "committing" }
  | { kind: "deploying_errors"; elapsed: number }
  | { kind: "monitoring" }          // errors live, agent is watching
  | { kind: "deploying_fix"; elapsed: number }  // agent committed fix, waiting for redeploy
  | { kind: "reloading" };

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
  const [lastError, setLastError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount, load chaos state. If already active (e.g. page reload mid-flow),
  // jump straight into monitoring so the UI reflects agent activity.
  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then((s: ChaosState) => {
        setState(s);
        if (s.active) {
          setPhase({ kind: "monitoring" });
          startPollingForFixDeploy();
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => stopTimers();
  }, []);

  function stopTimers() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    pollRef.current = null;
    elapsedRef.current = null;
  }

  // Phase 1 — wait for the error-injection deploy to go live.
  // Detects by timestamp change vs the pre-commit snapshot.
  function startPollingForErrorDeploy(priorTimestamp: string | null) {
    setPhase({ kind: "deploying_errors", elapsed: 0 });

    let elapsed = 0;
    elapsedRef.current = setInterval(() => {
      elapsed += 1;
      setPhase((p) => p?.kind === "deploying_errors" ? { kind: "deploying_errors", elapsed } : p);
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deployed-state?cb=${Date.now()}`, { cache: "no-store" });
        const deployed: ChaosState = await res.json();
        const isNewDeploy = deployed.timestamp !== priorTimestamp || elapsed >= MAX_WAIT_S;
        if (isNewDeploy) {
          stopTimers();
          setState(deployed);
          setPhase({ kind: "monitoring" });
          startPollingForFixDeploy();
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
  }

  // Phase 2 — errors are live, wait for the agent to commit a fix and redeploy.
  // Detects by chaos.active flipping to false in the deployed filesystem.
  function startPollingForFixDeploy() {
    let elapsed = 0;
    let fixDeployStarted = false;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deployed-state?cb=${Date.now()}`, { cache: "no-store" });
        const deployed: ChaosState = await res.json();

        if (!deployed.active && !fixDeployStarted) {
          // Agent committed the fix and Vercel has redeployed — reload.
          fixDeployStarted = true;
          stopTimers();
          setPhase({ kind: "reloading" });
          setTimeout(() => window.location.reload(), 600);
        } else if (deployed.active && !fixDeployStarted) {
          // Still waiting — check if agent has at least committed (GitHub active=false)
          // by polling GitHub state via /api/chaos (reads GitHub directly in POST, but
          // for detection we check deployed-state only — trust Vercel as source of truth).
          elapsed += POLL_MS / 1000;
          if (elapsed >= MAX_WAIT_S * 2) {
            // Safety: give up after 4 min and reload anyway
            stopTimers();
            setPhase({ kind: "reloading" });
            setTimeout(() => window.location.reload(), 600);
          }
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
  }

  async function injectErrors() {
    setLoading(true);
    setLastError(null);
    setPhase({ kind: "committing" });

    try {
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
      startPollingForErrorDeploy(prior.timestamp ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      setPhase(null);
    } finally {
      setLoading(false);
    }
  }

  const isDeploying = phase !== null;
  const nextScene = (state.scene % 3) + 1;

  function statusLine() {
    if (!phase) return "";
    switch (phase.kind) {
      case "committing":
        return "Committing error files to GitHub…";
      case "deploying_errors":
        return `Errors committed · Waiting for Vercel deployment (${phase.elapsed}s)…`;
      case "monitoring":
        return "Errors live · Claude agent monitoring for exceptions…";
      case "deploying_fix":
        return `Claude committed a fix · Waiting for Vercel deployment (${phase.elapsed}s)…`;
      case "reloading":
        return "Fix deployed — reloading page…";
    }
  }

  const isMonitoring = phase?.kind === "monitoring";
  const isFixing = phase?.kind === "deploying_fix" || phase?.kind === "reloading";
  const isInjecting = phase?.kind === "committing" || phase?.kind === "deploying_errors";

  const borderColor =
    isFixing ? "border-emerald-500/30 bg-emerald-500/5" :
    isMonitoring ? "border-amber-500/30 bg-amber-500/5" :
    isInjecting ? "border-indigo-500/30 bg-indigo-500/5" :
    state.active ? "border-red-500/30 bg-red-500/5" :
    "border-zinc-800 bg-zinc-900/50";

  const iconColor =
    isFixing ? "text-emerald-400" :
    isMonitoring ? "text-amber-400" :
    isInjecting ? "text-indigo-400" :
    state.active ? "text-red-400" : "text-zinc-500";

  const iconBg =
    isFixing ? "bg-emerald-500/15" :
    isMonitoring ? "bg-amber-500/15" :
    isInjecting ? "bg-indigo-500/15" :
    state.active ? "bg-red-500/10" : "bg-zinc-800";

  return (
    <div className={`rounded-xl border p-5 transition-all duration-300 backdrop-blur-sm ${borderColor}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: icon + text + file badges */}
        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
            {isMonitoring ? (
              <Bot className={`h-4 w-4 ${iconColor}`} />
            ) : isDeploying ? (
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

        {/* Right: action button / status indicator */}
        <div className="shrink-0">
          {isDeploying ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 cursor-not-allowed select-none">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isMonitoring ? "Agent watching…" : isFixing ? "Deploying fix…" : "Deploying…"}
            </div>
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

      {lastError && !isDeploying && (
        <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-yellow-300 font-mono break-all">{lastError}</p>
        </div>
      )}

      {!state.active && !isDeploying && !lastError && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center gap-2 text-xs text-zinc-600">
          <AlertTriangle className="h-3 w-3" />
          <span>Next: Scene {nextScene} — {SCENE_DESCRIPTIONS[nextScene]}</span>
        </div>
      )}
    </div>
  );
}
