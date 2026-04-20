"""
GitHub REST API client — uses the Git Trees API for atomic commits.
All file changes are bundled into ONE commit → ONE Vercel deployment.
"""

import os
import base64
import httpx

BASE_URL = "https://api.github.com"


def _owner() -> str:
    return os.getenv("GITHUB_OWNER", "AkhilParim")


def _repo() -> str:
    return os.getenv("GITHUB_REPO", "error-agent-demo")


def _branch() -> str:
    return os.getenv("GITHUB_BRANCH", "main")


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


def get_chaos_state() -> dict:
    """Return the current chaos-state.json from GitHub."""
    try:
        raw = get_file_content("chaos-state.json")
        import json
        return json.loads(raw)
    except Exception:
        return {"active": False, "scene": 0}


def _commit_all(updates: list[dict[str, str]], message: str) -> None:
    """Commit all file updates as a single atomic commit using the Git Trees API."""
    base = f"{BASE_URL}/repos/{_owner()}/{_repo()}"
    h = _headers()
    branch = _branch()

    # 1. Get HEAD commit SHA
    ref_resp = httpx.get(f"{base}/git/ref/heads/{branch}", headers=h, timeout=15)
    ref_resp.raise_for_status()
    head_sha = ref_resp.json()["object"]["sha"]

    # 2. Get the tree SHA of the HEAD commit
    commit_resp = httpx.get(f"{base}/git/commits/{head_sha}", headers=h, timeout=15)
    commit_resp.raise_for_status()
    base_tree_sha = commit_resp.json()["tree"]["sha"]

    # 3. Create blobs for each file
    tree_items = []
    for update in updates:
        encoded = base64.b64encode(update["content"].encode("utf-8")).decode("utf-8")
        blob_resp = httpx.post(
            f"{base}/git/blobs",
            headers=h,
            json={"content": encoded, "encoding": "base64"},
            timeout=20,
        )
        blob_resp.raise_for_status()
        tree_items.append({
            "path": update["path"],
            "mode": "100644",
            "type": "blob",
            "sha": blob_resp.json()["sha"],
        })

    # 4. Create new tree
    tree_resp = httpx.post(
        f"{base}/git/trees",
        headers=h,
        json={"base_tree": base_tree_sha, "tree": tree_items},
        timeout=20,
    )
    tree_resp.raise_for_status()
    new_tree_sha = tree_resp.json()["sha"]

    # 5. Create commit
    commit_create_resp = httpx.post(
        f"{base}/git/commits",
        headers=h,
        json={"message": message, "tree": new_tree_sha, "parents": [head_sha]},
        timeout=20,
    )
    commit_create_resp.raise_for_status()
    new_commit_sha = commit_create_resp.json()["sha"]

    # 6. Update branch ref
    update_ref_resp = httpx.patch(
        f"{base}/git/refs/heads/{branch}",
        headers=h,
        json={"sha": new_commit_sha},
        timeout=15,
    )
    update_ref_resp.raise_for_status()
    print(f"[github_client] Committed {len(updates)} file(s) in one commit: {new_commit_sha[:8]}")


def commit_fixes(fixes: list[dict[str, str]], scene: int = 0) -> None:
    """Commit Claude's fixes + chaos-state reset as a single atomic commit."""
    import json, datetime

    file_list = ", ".join(f["path"] for f in fixes)
    message = (
        f"fix(agent): Claude auto-fix for scene-{scene} — {file_list}\n\n"
        "Auto-fixed by Claude Sonnet via PostHog exception monitoring."
    )

    chaos_state = json.dumps({
        "active": False,
        "scene": scene,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "injectedFiles": [],
        "fixedBy": "claude-agent",
    }, indent=2)

    all_updates = list(fixes) + [{"path": "chaos-state.json", "content": chaos_state}]
    _commit_all(all_updates, message)
