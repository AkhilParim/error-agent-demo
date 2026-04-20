import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
  });
}

export function captureException(
  error: Error,
  context: { component: string; scene?: number; [key: string]: unknown }
) {
  posthog.capture("$exception", {
    $exception_message: error.message,
    $exception_type: error.constructor.name,
    $exception_stack_trace_raw: error.stack,
    ...context,
  });
}

export function captureEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  posthog.capture(event, properties);
}

export { posthog };
