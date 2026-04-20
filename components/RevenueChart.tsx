"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getRevenueTimeline } from "@/lib/data";
import { ErrorBoundary } from "./ErrorBoundary";

function formatK(value: number) {
  return `$${(value / 1000).toFixed(0)}k`;
}

function ChartContent() {
  const data = getRevenueTimeline();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-zinc-100">Revenue Trend</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Monthly revenue vs. target</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatK} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(v) => [`$${Number(v).toLocaleString()}`, ""]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 12 }}
            iconType="circle"
            iconSize={6}
          />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" dot={false} />
          <Area type="monotone" dataKey="target" name="Target" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#targetGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function RevenueChart({ scene }: { scene: number }) {
  return (
    <ErrorBoundary name="RevenueChart" scene={scene}>
      <ChartContent />
    </ErrorBoundary>
  );
}
