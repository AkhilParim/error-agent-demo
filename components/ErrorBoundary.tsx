"use client";

import React from "react";
import posthog from "posthog-js";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  name: string;
  scene?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    posthog.capture("$exception", {
      $exception_message: error.message,
      $exception_type: error.constructor.name,
      $exception_stack_trace_raw: error.stack,
      component_name: this.props.name,
      chaos_scene: this.props.scene ?? 0,
      component_stack: info.componentStack,
    });

    console.error(`[${this.props.name}] Error captured:`, error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Component Error</span>
          </div>
          <p className="text-xs text-zinc-500 text-center font-mono max-w-xs truncate">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <p className="text-xs text-zinc-600">Captured → PostHog · Agent notified</p>
        </div>
      );
    }

    return this.props.children;
  }
}
