"""
Uses the Anthropic API to analyse PostHog exception events and generate file fixes.
"""

import os
import re
from typing import Any
import anthropic
from github_client import get_file_content

def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# Files the agent is allowed to fix
FIXABLE_FILES = [
    "lib/data.ts",
    "lib/formatters.ts",
    "components/ActivityFeed.tsx",
    "components/UserTable.tsx",
    "components/RevenueChart.tsx",
    "components/MetricsGrid.tsx",
]


def _build_error_summary(exceptions: list[dict[str, Any]]) -> str:
    lines = []
    for i, exc in enumerate(exceptions[:5], 1):
        lines.append(f"Error {i}:")
        lines.append(f"  Type: {exc['error_type']}")
        lines.append(f"  Message: {exc['message']}")
        lines.append(f"  Component: {exc['component'] or 'unknown'}")
        lines.append(f"  Scene: {exc.get('scene', '?')}")
        if exc.get("stack"):
            # Only include the first few stack frames to save tokens
            frames = exc["stack"].splitlines()[:8]
            lines.append(f"  Stack trace (top frames):\n    " + "\n    ".join(frames))
        lines.append("")
    return "\n".join(lines)


def _infer_affected_files(exceptions: list[dict[str, Any]]) -> list[str]:
    """Guess which source files are implicated from stack traces and component names."""
    implicated: set[str] = set()

    for exc in exceptions:
        stack = exc.get("stack", "")
        component = exc.get("component", "")

        for path in FIXABLE_FILES:
            filename = path.split("/")[-1].replace(".tsx", "").replace(".ts", "").lower()
            if filename in stack.lower() or filename in component.lower():
                implicated.add(path)

        # Fallback: if MetricsGrid or RevenueChart crashed, data.ts is likely culprit
        if "metricsGrid" in component or "MetricsGrid" in component:
            implicated.add("lib/data.ts")
            implicated.add("lib/formatters.ts")
        if "ActivityFeed" in component:
            implicated.add("components/ActivityFeed.tsx")
            implicated.add("lib/data.ts")
        if "UserTable" in component:
            implicated.add("components/UserTable.tsx")
            implicated.add("lib/formatters.ts")
        if "RevenueChart" in component:
            implicated.add("lib/data.ts")

    return list(implicated) if implicated else ["lib/data.ts", "lib/formatters.ts"]


def fix_errors_with_claude(exceptions: list[dict[str, Any]]) -> list[dict[str, str]]:
    """
    Sends error context + file contents to Claude.
    Returns a list of {path, content} dicts with the fixed file contents.
    """
    affected_files = _infer_affected_files(exceptions)
    file_contents: dict[str, str] = {}

    for path in affected_files:
        try:
            content = get_file_content(path)
            file_contents[path] = content
        except Exception as e:
            print(f"[fixer] Could not fetch {path}: {e}")

    if not file_contents:
        return []

    error_summary = _build_error_summary(exceptions)
    files_block = "\n\n".join(
        f"### {path}\n```typescript\n{content}\n```"
        for path, content in file_contents.items()
    )

    prompt = f"""You are an expert TypeScript/React developer. You have been given a set of JavaScript exceptions captured from a Next.js application via PostHog, along with the source files that are causing them.

Your task: fix ALL the bugs in the source files. Return ONLY the corrected file contents, nothing else.

## Exceptions detected

{error_summary}

## Source files to fix

{files_block}

## Instructions

1. Identify every bug in each file based on the exception messages and stack traces.
2. Fix the bugs minimally — do not refactor or restructure anything beyond what is needed.
3. Return your answer as a series of file blocks, each formatted EXACTLY like this:

FILE: lib/data.ts
```typescript
<full corrected file content>
```

FILE: lib/formatters.ts
```typescript
<full corrected file content>
```

Only include files that needed changes. Do not include explanations, comments about what you changed, or anything outside the FILE blocks."""

    message = _client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text
    return _parse_fixes(response_text)


def _parse_fixes(response: str) -> list[dict[str, str]]:
    """Parse FILE: path\\n```typescript ... ``` blocks from Claude's response."""
    fixes = []
    pattern = r"FILE:\s*([\w./]+)\s*\n```(?:typescript|tsx|ts)?\s*\n([\s\S]*?)```"
    matches = re.findall(pattern, response)

    for path, content in matches:
        path = path.strip()
        if path in FIXABLE_FILES:
            fixes.append({"path": path, "content": content.strip()})

    return fixes
