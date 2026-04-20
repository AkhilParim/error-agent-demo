"""
GitHub REST API client for reading and committing files.
"""

import os
import base64
import httpx

BASE_URL = "https://api.github.com"


def _owner() -> str:
    return os.getenv("GITHUB_OWNER", "AkhilParim")


def _repo() -> str:
    return os.getenv("GITHUB_REPO", "error-agent-demo")


def _headers() -> dict:
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise EnvironmentError("GITHUB_TOKEN is not set — cannot commit fixes")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
    }


def get_file_content(path: str) -> str:
    """Fetch the current content of a file from the repo."""
    resp = httpx.get(
        f"{BASE_URL}/repos/{_owner()}/{_repo()}/contents/{path}",
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    return base64.b64decode(data["content"]).decode("utf-8")


def _get_file_sha(path: str) -> str | None:
    """Get the current SHA of a file (needed for updates)."""
    try:
        resp = httpx.get(
            f"{BASE_URL}/repos/{_owner()}/{_repo()}/contents/{path}",
            headers=_headers(),
            timeout=10,
        )
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json().get("sha")
    except Exception:
        return None


def commit_fixes(fixes: list[dict[str, str]], scene: int = 0) -> None:
    """Commit one or more file fixes to the repository."""
    file_list = ", ".join(f["path"] for f in fixes)
    commit_message = f"fix(agent): resolve scene-{scene} errors in {file_list}\n\nAuto-fixed by Claude Sonnet via PostHog exception monitoring."

    for fix in fixes:
        path = fix["path"]
        content = fix["content"]
        sha = _get_file_sha(path)

        body: dict = {
            "message": commit_message,
            "content": base64.b64encode(content.encode("utf-8")).decode("utf-8"),
        }
        if sha:
            body["sha"] = sha

        resp = httpx.put(
            f"{BASE_URL}/repos/{_owner()}/{_repo()}/contents/{path}",
            headers=_headers(),
            json=body,
            timeout=20,
        )

        if not resp.ok:
            raise RuntimeError(f"GitHub API error for {path}: {resp.status_code} {resp.text}")

        print(f"[github_client] Committed fix: {path}")

    # Reset chaos-state.json
    chaos_state = '{\n  "active": false,\n  "scene": 0,\n  "timestamp": null,\n  "injectedFiles": []\n}\n'
    sha = _get_file_sha("chaos-state.json")
    body = {
        "message": "fix(agent): reset chaos state after successful fix",
        "content": base64.b64encode(chaos_state.encode()).decode(),
    }
    if sha:
        body["sha"] = sha

    httpx.put(
        f"{BASE_URL}/repos/{_owner()}/{_repo()}/contents/chaos-state.json",
        headers=_headers(),
        json=body,
        timeout=20,
    )
