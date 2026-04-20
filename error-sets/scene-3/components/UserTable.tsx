// BUG SCENE 3 — injected by chaos system
// Error: .map() on null userRows → TypeError crash in UserTable

"use client";

import { getTopUsers } from "@/lib/data";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ErrorBoundary } from "./ErrorBoundary";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  inactive: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  churned: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function TableContent() {
  void getTopUsers();

  // BUG 10 (cont): userRows is null — calling .map() throws immediately
  // TypeError: Cannot read properties of null (reading 'map')
  const userRows = null as unknown as ReturnType<typeof getTopUsers>;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">Top Customers</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Ranked by lifetime revenue</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Customer</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Revenue</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Orders</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Joined</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {userRows.map((user, i) => (
              <tr key={user.id} className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${i === userRows.length - 1 ? "border-0" : ""}`}>
                <td className="px-5 py-3.5">
                  <div>
                    <p className="font-medium text-zinc-100 text-sm">{user.name}</p>
                    <p className="text-xs text-zinc-500">{user.email}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-sm text-zinc-200">{formatCurrency(user.revenue)}</td>
                <td className="px-5 py-3.5 text-right text-zinc-400 text-sm">{user.orders}</td>
                <td className="px-5 py-3.5 text-right text-zinc-500 text-xs font-mono">{formatDate(user.joinedAt)}</td>
                <td className="px-5 py-3.5 text-right">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[user.status]}`}>
                    {user.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UserTable({ scene }: { scene: number }) {
  return (
    <ErrorBoundary name="UserTable" scene={scene}>
      <TableContent />
    </ErrorBoundary>
  );
}
