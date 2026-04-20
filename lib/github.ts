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

async function getFileSha(path: string): Promise<string | null> {
  const headers = await getHeaders();
  const res = await fetch(`${BASE_URL}/repos/${OWNER}/${REPO}/contents/${path}`, { headers });
  if (res.status === 404) return null;
  const data = await res.json();
  return data.sha ?? null;
}

export async function commitFiles(updates: GitHubFileUpdate[], commitMessage: string) {
  const headers = await getHeaders();

  for (const update of updates) {
    const sha = await getFileSha(update.path);
    const body: Record<string, unknown> = {
      message: commitMessage,
      content: Buffer.from(update.content).toString("base64"),
    };
    if (sha) body.sha = sha;

    const res = await fetch(`${BASE_URL}/repos/${OWNER}/${REPO}/contents/${update.path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub API error for ${update.path}: ${JSON.stringify(err)}`);
    }
  }
}

export async function getFileContent(path: string): Promise<string> {
  const headers = await getHeaders();
  const res = await fetch(`${BASE_URL}/repos/${OWNER}/${REPO}/contents/${path}`, { headers });
  if (!res.ok) throw new Error(`Could not fetch ${path}: ${res.status}`);
  const data = await res.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}
