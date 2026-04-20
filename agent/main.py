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
from fixer import fix_errors_with_claude
from github_client import commit_fixes

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

    required = ["ANTHROPIC_API_KEY", "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        console.print(f"[red]Missing environment variables: {', '.join(missing)}[/red]")
        sys.exit(1)

    log("info", f"Polling every {POLL_INTERVAL_SECONDS}s · Looking back {LOOKBACK_MINUTES}m")
    log("info", "GitHub token: " + ("✓ configured" if os.getenv("GITHUB_TOKEN") else "✗ missing — cannot auto-deploy"))
    console.print()

    last_fix_timestamp: datetime | None = None
    fixes_deployed = 0

    while True:
        try:
            since = datetime.now(timezone.utc) - timedelta(minutes=LOOKBACK_MINUTES)
            exceptions = get_recent_exceptions(since=since, limit=20)

            if not exceptions:
                log("info", "No new exceptions · Monitoring...")
                capture_agent_status("monitoring", "Polling PostHog — no exceptions found")
            else:
                log("warning", f"[bold]{len(exceptions)} exception(s) detected[/bold]")

                for exc in exceptions[:3]:
                    console.print(f"  [red]→[/red] {exc['error_type']}: {exc['message'][:80]}")
                    if exc.get('component'):
                        console.print(f"     [dim]component:[/dim] {exc['component']} · scene {exc.get('scene', '?')}")

                capture_agent_status(
                    "detected",
                    f"Detected {len(exceptions)} exception(s) — invoking Claude",
                    scene=exceptions[0].get("scene"),
                )

                log("agent", "Sending to Claude Sonnet for analysis and fix...")
                start_time = time.time()

                fixes = fix_errors_with_claude(exceptions)

                if not fixes:
                    log("warning", "Claude returned no fixes — skipping deploy")
                    time.sleep(POLL_INTERVAL_SECONDS)
                    continue

                log("agent", f"Claude generated {len(fixes)} fix(es):")
                for fix in fixes:
                    console.print(f"  [green]→[/green] {fix['path']}")

                capture_agent_status(
                    "fixing",
                    f"Applying {len(fixes)} fix(es) with Claude Sonnet",
                    files=[f["path"] for f in fixes],
                )

                log("info", "Committing and pushing via GitHub API...")
                commit_fixes(fixes, scene=exceptions[0].get("scene", 0))

                elapsed = round(time.time() - start_time)
                fixes_deployed += 1
                last_fix_timestamp = datetime.now(timezone.utc)

                capture_agent_status(
                    "deployed",
                    f"Fix deployed — {len(fixes)} file(s) updated · Vercel redeploying",
                    files=[f["path"] for f in fixes],
                    duration=elapsed,
                    scene=exceptions[0].get("scene"),
                )

                console.print()
                log("success", f"[bold]Fix deployed in {elapsed}s[/bold] · Total fixes: {fixes_deployed}")
                log("success", "Vercel is redeploying now (~30s)")
                console.print()

                # Back off after a successful fix to avoid refixing during Vercel redeploy
                log("info", "Backing off 90s to allow Vercel redeploy...")
                time.sleep(90)
                continue

        except KeyboardInterrupt:
            console.print("\n[yellow]Agent stopped by user.[/yellow]")
            sys.exit(0)
        except Exception as e:
            log("error", f"Agent error: {e}")
            capture_agent_status("error", f"Agent error: {str(e)[:120]}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
