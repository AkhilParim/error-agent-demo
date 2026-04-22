"""
Pulse Analytics — Claude Agent
Monitors PostHog for JavaScript exceptions, fixes them with Claude, and deploys via GitHub.
"""

import time
import os
import sys
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from posthog_client import get_recent_exceptions, capture_agent_status
from github_client import get_chaos_state

load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

console = Console()

POLL_INTERVAL_SECONDS = 12
LOOKBACK_MINUTES = 5


def log(level: str, message: str, **kwargs):
    now = datetime.now().strftime("%H:%M:%S")
    colors = {"info": "cyan", "success": "green", "warning": "yellow", "error": "red", "agent": "magenta"}
    color = colors.get(level, "white")
    console.print(f"[dim]{now}[/dim]  [{color}]{message}[/{color}]", **kwargs)


def main():
    console.print(Panel.fit(
        Text.assemble(
            ("Pulse Analytics — Claude Agent\n", "bold white"),
            ("Monitors PostHog · Fixes with Claude Sonnet · Deploys via GitHub\n", "dim"),
        ),
        border_style="bright_blue",
        padding=(0, 2),
    ))

    required = ["POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        console.print(f"[red]Missing environment variables: {', '.join(missing)}[/red]")
        sys.exit(1)

    log("info", f"Polling every {POLL_INTERVAL_SECONDS}s · Looking back {LOOKBACK_MINUTES}m")
    console.print()

    while True:
        try:
            since = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MINUTES)
            exceptions = get_recent_exceptions(since=since, limit=20)

            if not exceptions:
                log("info", "No new exceptions · Monitoring...")
                capture_agent_status("monitoring", "Polling PostHog — no exceptions found")
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            chaos = get_chaos_state()
            if not chaos.get("active", False):
                log("info", "Chaos state is inactive — exceptions are stale, skipping")
                capture_agent_status("monitoring", "Polling PostHog — no exceptions found")
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            log("warning", f"[bold]{len(exceptions)} exception(s) detected[/bold]")
            for exc in exceptions[:3]:
                console.print(f"  [red]→[/red] {exc['error_type']}: {exc['message'][:80]}")
                if exc.get('component'):
                    console.print(f"     [dim]component:[/dim] {exc['component']} · scene {exc.get('scene', '?')}")

            capture_agent_status(
                "detected",
                f"Detected {len(exceptions)} exception(s) — awaiting user-triggered fix",
                scene=exceptions[0].get("scene"),
            )

        except KeyboardInterrupt:
            console.print("\n[yellow]Agent stopped by user.[/yellow]")
            sys.exit(0)
        except Exception as e:
            log("error", f"Agent error: {e}")
            capture_agent_status("error", f"Agent error: {str(e)[:120]}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
