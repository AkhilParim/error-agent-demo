"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, CheckCircle2, AlertCircle, Wrench, Eye, Rocket } from "lucide-react";

interface AgentEvent {
  timestamp: string;
  status: "monitoring" | "detected" | "fixing" | "deployed" | "error";
  message: string;
  scene?: number;
  files?: string[];
  duration?: number;
}

const STATUS_CONFIG = {
  monitoring: { icon: Eye, color: "text-zinc-400", bg: "bg-zinc-500/10", dot: "bg-zinc-500" },
  detected: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-500/10", dot: "bg-yellow-500" },
  fixing: { icon: Wrench, color: "text-indigo-400", bg: "bg-indigo-500/10", dot: "bg-indigo-500" },
  deployed: { icon: Rocket, color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  error: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-500" },
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AgentMonitor() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAgentActive, setIsAgentActive] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-status", { cache: "no-store" });
      const data = await res.json();
      setEvents(data.events ?? []);
      setIsAgentActive((data.events ?? []).some(
        (e: AgentEvent) => Date.now() - new Date(e.timestamp).getTime() < 120000
      ));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const latestStatus = events[0]?.status ?? "monitoring";
  const statusCfg = STATUS_CONFIG[latestStatus] ?? STATUS_CONFIG.monitoring;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isAgentActive ? "bg-indigo-500/15" : "bg-zinc-800"}`}>
              <Bot className={`h-4 w-4 ${isAgentActive ? "text-indigo-400" : "text-zinc-500"}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Claude Agent</h3>
              <p className="text-xs text-zinc-500">PostHog → Auto-fix → Deploy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isAgentActive ? "bg-emerald-400 animate-blink" : "bg-zinc-600"}`} />
            <span className="text-xs text-zinc-500">{isAgentActive ? "Active" : "Standby"}</span>
          </div>
        </div>
      </div>

      {/* Current status pill */}
      <div className="px-5 py-3 border-b border-zinc-800/50">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
          <StatusIcon className="h-3 w-3" />
          {latestStatus === "monitoring" && "Monitoring PostHog for exceptions"}
          {latestStatus === "detected" && "Errors detected — analysing with Claude"}
          {latestStatus === "fixing" && "Generating fix with Claude Sonnet"}
          {latestStatus === "deployed" && "Fix deployed — Vercel redeploying"}
          {latestStatus === "error" && "Agent error — check logs"}
        </div>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5 min-h-[160px]">
        {loading && (
          <p className="text-xs text-zinc-600 text-center py-6">Loading agent events...</p>
        )}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-6 w-6 text-zinc-700" />
            <p className="text-xs text-zinc-600 text-center">No agent events yet.<br />Trigger chaos to see the agent in action.</p>
          </div>
        )}
        {events.map((event, i) => {
          const cfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.monitoring;
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-2.5 animate-slide-in">
              <div className={`mt-0.5 shrink-0 flex h-5 w-5 items-center justify-center rounded ${cfg.bg}`}>
                <Icon className={`h-3 w-3 ${cfg.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 leading-relaxed">{event.message}</p>
                {event.files && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {event.files.map((f) => (
                      <span key={f} className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
                {event.duration && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">Fixed in {event.duration}s</p>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 shrink-0 font-mono">{timeLabel(event.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
