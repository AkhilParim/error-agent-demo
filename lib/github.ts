interface GitHubFileUpdate {
  path: string;
  content: string;
  message: string;
}

const BASE_URL = "https://api.github.com";
const OWNER = process.env.GITHUB_OWNER ?? "AkhilParim";
const REPO = process.env.GITHUB_REPO ?? "error-agent-demo";

async function getHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };
}

// Uses the Git Trees API to create ONE atomic commit for all file changes.
// This means one Vercel deployment instead of N (one per file).
export async function commitFiles(updates: GitHubFileUpdate[], commitMessage: string) {
  const headers = await getHeaders();
  const base = `${BASE_URL}/repos/${OWNER}/${REPO}`;

  // 1. Get current HEAD commit SHA on main (/git/refs/ plural is the documented endpoint)
  const refRes = await fetch(`${base}/git/refs/heads/main`, { headers });
  if (!refRes.ok) {
    const body = await refRes.text();
    throw new Error(`Failed to get ref: ${refRes.status} — ${body}`);
  }
  const { object: { sha: headSha } } = await refRes.json();

  // 2. Get the tree SHA that HEAD commit points to
  const commitRes = await fetch(`${base}/git/commits/${headSha}`, { headers });
  if (!commitRes.ok) {
    const body = await commitRes.text();
    throw new Error(`Failed to get commit: ${commitRes.status} — ${body}`);
  }
  const { tree: { sha: baseSha } } = await commitRes.json();

  // 3. Create a blob for each file (in parallel)
  const treeItems = await Promise.all(
    updates.map(async (update) => {
      const blobRes = await fetch(`${base}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          content: Buffer.from(update.content).toString("base64"),
          encoding: "base64",
        }),
      });
      if (!blobRes.ok) {
        const body = await blobRes.text();
        throw new Error(`Failed to create blob for ${update.path}: ${blobRes.status} — ${body}`);
      }
      const { sha: blobSha } = await blobRes.json();
      return { path: update.path, mode: "100644", type: "blob", sha: blobSha };
    })
  );

  // 4. Create a new tree on top of the existing one
  const newTreeRes = await fetch(`${base}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
  });
  if (!newTreeRes.ok) {
    const body = await newTreeRes.text();
    throw new Error(`Failed to create tree: ${newTreeRes.status} — ${body}`);
  }
  const { sha: newTreeSha } = await newTreeRes.json();

  // 5. Create the commit
  const newCommitRes = await fetch(`${base}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: commitMessage, tree: newTreeSha, parents: [headSha] }),
  });
  if (!newCommitRes.ok) {
    const body = await newCommitRes.text();
    throw new Error(`Failed to create commit: ${newCommitRes.status} — ${body}`);
  }
  const { sha: newCommitSha } = await newCommitRes.json();

  // 6. Fast-forward the branch ref
  const updateRes = await fetch(`${base}/git/refs/heads/main`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ sha: newCommitSha }),
  });
  if (!updateRes.ok) {
    const body = await updateRes.text();
    throw new Error(`Failed to update ref: ${updateRes.status} — ${body}`);
  }
}

export async function getFileContent(path: string): Promise<string> {
  const headers = await getHeaders();
  const res = await fetch(`${BASE_URL}/repos/${OWNER}/${REPO}/contents/${path}`, { headers });
  if (!res.ok) throw new Error(`Could not fetch ${path}: ${res.status}`);
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}
