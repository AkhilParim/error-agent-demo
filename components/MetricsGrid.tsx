"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { getMetricsSummary } from "@/lib/data";
import { formatPercentage } from "@/lib/formatters";
import { ErrorBoundary } from "./ErrorBoundary";

function MetricCard({
  label,
  value,
  change,
  changeLabel,
}: {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
}) {
  const isPositive = change >= 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">{label}</p>
      <p className="text-2xl font-semibold text-zinc-50 mb-2">{value}</p>
      <div className={`flex items-center gap-1.5 text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span className="font-medium">{formatPercentage(change)}</span>
        <span className="text-zinc-600">{changeLabel}</span>
      </div>
    </div>
  );
}

function MetricsContent() {
  const metrics = getMetricsSummary();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <MetricCard key={m.label} {...m} />
      ))}
    </div>
  );
}

export default function MetricsGrid({ scene }: { scene: number }) {
  return (
    <ErrorBoundary name="MetricsGrid" scene={scene}>
      <MetricsContent />
    </ErrorBoundary>
  );
}
