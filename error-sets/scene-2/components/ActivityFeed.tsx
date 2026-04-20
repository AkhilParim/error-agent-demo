// BUG SCENE 2 — injected by chaos system
// Errors: wrong timestamp property → "Invalid Date"; activities is null → .map() crash

"use client";

import { ShoppingCart, UserPlus, ArrowUpCircle, RefreshCw } from "lucide-react";
import { getRecentActivity, type Activity } from "@/lib/data";
import { formatCurrency, formatTimeAgo } from "@/lib/formatters";
import { ErrorBoundary } from "./ErrorBoundary";

const TYPE_CONFIG = {
  purchase: { icon: ShoppingCart, color: "text-indigo-400", bg: "bg-indigo-500/10" },
  signup: { icon: UserPlus, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  upgrade: { icon: ArrowUpCircle, color: "text-blue-400", bg: "bg-blue-500/10" },
  refund: { icon: RefreshCw, color: "text-red-400", bg: "bg-red-500/10" },
};

function ActivityItem({ activity }: { activity: Activity }) {
  const config = TYPE_CONFIG[activity.type];
  const Icon = config.icon;

  // BUG 6: activity.ts does not exist — the property is activity.timestamp
  // new Date(undefined) evaluates to "Invalid Date" which renders visibly broken
  const timeDisplay = formatTimeAgo((activity as unknown as { ts: number }).ts);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/40 last:border-0 animate-slide-in">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-zinc-200 truncate">{activity.user}</p>
          <span className="text-xs text-zinc-600 shrink-0">{timeDisplay}</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{activity.description}</p>
      </div>
      {activity.amount !== undefined && (
        <span className={`text-sm font-medium shrink-0 ${activity.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {activity.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(activity.amount))}
        </span>
      )}
    </div>
  );
}

function FeedContent() {
  // BUG 7: nullActivities is null — .map() on null throws
  // TypeError: Cannot read properties of null (reading 'map')
  const nullActivities = null as unknown as Activity[];
  const activities = nullActivities.map((a) => a);
  void getRecentActivity();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Activity Feed</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time events</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-blink" />
            Live
          </span>
        </div>
      </div>
      <div className="px-5 py-1">
        {activities.map((a) => (
          <ActivityItem key={a.id} activity={a} />
        ))}
      </div>
    </div>
  );
}

export default function ActivityFeed({ scene }: { scene: number }) {
  return (
    <ErrorBoundary name="ActivityFeed" scene={scene}>
      <FeedContent />
    </ErrorBoundary>
  );
}
