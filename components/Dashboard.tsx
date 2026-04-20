"use client";

import { useEffect, useState } from "react";
import { Zap, Settings, Bell, User } from "lucide-react";
import ChaosControl from "./ChaosControl";
import AgentMonitor from "./AgentMonitor";
import ComponentHealth from "./ComponentHealth";

interface ChaosState {
  active: boolean;
  scene: number;
}

export default function Dashboard() {
  const [chaos, setChaos] = useState<ChaosState>({ active: false, scene: 0 });
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    fetch("/api/chaos")
      .then((r) => r.json())
      .then(setChaos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-zinc-100 tracking-tight">AutoFix</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {["Overview", "Analytics", "Customers", "Reports"].map((item, i) => (
                <button
                  key={item}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    i === 0
                      ? "text-zinc-100 bg-zinc-800"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {time}
            </div>
            {chaos.active && (
              <span className="flex items-center gap-1.5 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-blink" />
                Scene {chaos.scene} active
              </span>
            )}
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
              <Settings className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/30">
              <User className="h-4 w-4 text-indigo-400" />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Overview</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Chaos + Agent side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChaosControl />
          <AgentMonitor />
        </div>

        {/* Component health probes */}
        <ComponentHealth scene={chaos.scene} />
      </main>
    </div>
  );
}
