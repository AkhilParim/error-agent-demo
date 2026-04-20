"""
PostHog REST API client.
Queries exception events and captures agent status events.
"""

import os
import httpx
from datetime import datetime, timezone
from typing import Any

POSTHOG_HOST = "https://us.posthog.com"


def _headers() -> dict:
    return {"Authorization": f"Bearer {os.getenv('POSTHOG_PERSONAL_API_KEY', '')}"}


def get_recent_exceptions(since: datetime, limit: int = 20) -> list[dict[str, Any]]:
    """Return $exception events captured after `since`."""
    try:
        resp = httpx.get(
            f"{POSTHOG_HOST}/api/projects/{os.getenv('POSTHOG_PROJECT_ID', '390064')}/events/",
            headers=_headers(),
            params={
                "event": "$exception",
                "after": since.isoformat(),
                "limit": limit,
            },
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get("results", [])

        exceptions = []
        for event in results:
            props = event.get("properties", {})
            exceptions.append({
                "event_id": event.get("id"),
                "timestamp": event.get("timestamp"),
                "error_type": props.get("$exception_type", "Error"),
                "message": props.get("$exception_message", "Unknown error"),
                "stack": props.get("$exception_stack_trace_raw", ""),
                "component": props.get("component_name", ""),
                "scene": props.get("chaos_scene", 0),
                "url": props.get("$current_url", ""),
            })

        return exceptions

    except Exception as e:
        print(f"[posthog_client] Failed to fetch exceptions: {e}")
        return []


def capture_agent_status(
    status: str,
    message: str,
    files: list[str] | None = None,
    duration: int | None = None,
    scene: int | None = None,
) -> None:
    """Capture an agent_status event to PostHog (used by the AgentMonitor UI)."""
    try:
        properties: dict[str, Any] = {
            "status": status,
            "message": message,
            "$lib": "pulse-agent",
        }
        if files:
            properties["files"] = files
        if duration is not None:
            properties["duration"] = duration
        if scene is not None:
            properties["scene"] = scene

        httpx.post(
            f"https://us.i.posthog.com/capture/",
            json={
                "api_key": os.getenv("POSTHOG_PUBLIC_KEY", "phc_AHVMcCxz2AxfZiEvKU5gz5yhtqpYcekb5cFZz6QyCKT3"),
                "event": "agent_status",
                "distinct_id": "claude-agent",
                "properties": properties,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            timeout=10,
        )
    except Exception as e:
        print(f"[posthog_client] Failed to capture agent status: {e}")
