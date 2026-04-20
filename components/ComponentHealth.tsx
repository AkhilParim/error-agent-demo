"use client";

import React from "react";
import { CheckCircle2, Database, Type, Activity, Users } from "lucide-react";
import posthog from "posthog-js";
import { getMetricsSummary, getRecentActivity, getTopUsers } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface ProbeProps {
  name: string;
  icon: React.ElementType;
  children: React.ReactNode;
  scene: number;
}

class ProbeErrorBoundary extends React.Component<
  { name: string; scene: number; icon: React.ElementType; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: ProbeErrorBoundary["props"]) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    posthog.capture("$exception", {
      $exception_message: error.message,
      $exception_type: error.constructor.name,
      $exception_stack_trace_raw: error.stack,
      component_name: this.props.name,
      chaos_scene: this.props.scene,
      component_stack: info.componentStack,
    });
  }

  render() {
    const Icon = this.props.icon;
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 flex flex-col gap-3 animate-slide-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                <Icon className="h-3.5 w-3.5 text-red-400" />
              </div>
              <span className="text-sm font-medium text-zinc-200">{this.props.name}</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-blink" />
              Error
            </span>
          </div>
          <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 p-3">
            <p className="text-[11px] font-mono text-red-300 leading-relaxed break-all">
              {this.state.error.constructor.name}: {this.state.error.message}
            </p>
          </div>
          <p className="text-[10px] text-zinc-600">Captured → PostHog · Agent monitoring</p>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800">
              <Icon className="h-3.5 w-3.5 text-zinc-400" />
            </div>
            <span className="text-sm font-medium text-zinc-200">{this.props.name}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Healthy
          </span>
        </div>
        <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/50 p-3 min-h-[48px]">
          {this.props.children}
        </div>
      </div>
    );
  }
}

function MetricsProbeContent() {
  const metrics = getMetricsSummary();
  return (
    <div className="flex flex-wrap gap-2">
      {metrics.slice(0, 2).map((m) => (
        <span key={m.label} className="text-[11px] font-mono text-zinc-400">
          {m.label}: <span className="text-zinc-300">{m.value}</span>
        </span>
      ))}
    </div>
  );
}

function FormattersProbeContent() {
  const formatted = formatCurrency(12450);
  const date = formatDate("2024-03-15");
  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-[11px] font-mono text-zinc-400">
        currency: <span className="text-zinc-300">{formatted}</span>
      </span>
      <span className="text-[11px] font-mono text-zinc-400">
        date: <span className="text-zinc-300">{date}</span>
      </span>
    </div>
  );
}

function ActivityProbeContent() {
  const items = getRecentActivity();
  return (
    <p className="text-[11px] font-mono text-zinc-400">
      events: <span className="text-zinc-300">{items.length} loaded</span>
      {" · "}last: <span className="text-zinc-300">{items[0]?.user ?? "—"}</span>
    </p>
  );
}

function UsersProbeContent() {
  const users = getTopUsers();
  return (
    <p className="text-[11px] font-mono text-zinc-400">
      users: <span className="text-zinc-300">{users.length} loaded</span>
      {" · "}top: <span className="text-zinc-300">{users[0]?.name ?? "—"}</span>
    </p>
  );
}

export default function ComponentHealth({ scene }: { scene: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Component Health</h2>
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600">Live probes · errors captured to PostHog</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ProbeErrorBoundary name="Data Layer" scene={scene} icon={Database}>
          <MetricsProbeContent />
        </ProbeErrorBoundary>
        <ProbeErrorBoundary name="Formatters" scene={scene} icon={Type}>
          <FormattersProbeContent />
        </ProbeErrorBoundary>
        <ProbeErrorBoundary name="Activity Feed" scene={scene} icon={Activity}>
          <ActivityProbeContent />
        </ProbeErrorBoundary>
        <ProbeErrorBoundary name="User Table" scene={scene} icon={Users}>
          <UsersProbeContent />
        </ProbeErrorBoundary>
      </div>
    </div>
  );
}
