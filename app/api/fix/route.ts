import { NextResponse } from "next/server";
import { getFileContent, commitFiles } from "@/lib/github";

export const maxDuration = 60;

const POSTHOG_HOST = "https://us.posthog.com";
const FILES_TO_FIX = ["lib/data.ts", "lib/formatters.ts"];

async function fetchRecentExceptions(): Promise<string> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID ?? "390064";
  if (!key) return "(no PostHog key — fixing based on source code only)";

  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const url = new URL(`${POSTHOG_HOST}/api/projects/${project}/events/`);
    url.searchParams.set("event", "$exception");
    url.searchParams.set("after", since);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return "(could not fetch PostHog errors)";
    const data = await res.json();
    const lines = (data.results ?? []).slice(0, 5).map((e: Record<string, unknown>) => {
      const p = (e.properties ?? {}) as Record<string, string>;
      return `- ${p.$exception_type}: ${p.$exception_message} (component: ${p.component_name ?? "?"})`;
    });
    return lines.length ? lines.join("\n") : "(no recent exceptions found)";
  } catch {
    return "(error fetching PostHog)";
  }
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured on Vercel");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function parseFixes(response: string): Array<{ path: string; content: string }> {
  const fixes: Array<{ path: string; content: string }> = [];
  const pattern = /FILE:\s*([\w./]+)\s*\n```(?:typescript|tsx|ts)?\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(response)) !== null) {
    const path = match[1].trim();
    if (FILES_TO_FIX.includes(path)) {
      fixes.push({ path, content: match[2].trim() });
    }
  }
  return fixes;
}

export async function POST() {
  try {
    // 1. Read current chaos-state from GitHub (source of truth)
    const rawState = await getFileContent("chaos-state.json");
    const currentState = JSON.parse(rawState);

    // 2. Fetch broken source files from GitHub
    const fileContents: Record<string, string> = {};
    for (const path of FILES_TO_FIX) {
      try {
        fileContents[path] = await getFileContent(path);
      } catch {
        // file might not exist if already clean
      }
    }

    if (Object.keys(fileContents).length === 0) {
      return NextResponse.json({ success: true, message: "Files already clean" });
    }

    // 3. Fetch recent PostHog exceptions for context
    const exceptionSummary = await fetchRecentExceptions();

    // 4. Build prompt and call Claude
    const filesBlock = Object.entries(fileContents)
      .map(([path, content]) => `### ${path}\n\`\`\`typescript\n${content}\n\`\`\``)
      .join("\n\n");

    const prompt = `You are an expert TypeScript developer. Fix ALL bugs in these source files.

## Recent exceptions from PostHog
${exceptionSummary}

## Source files to fix
${filesBlock}

## Instructions
1. Identify every bug based on the exception messages.
2. Fix bugs minimally — do not refactor beyond what is needed.
3. Return ONLY file blocks in this exact format:

FILE: lib/data.ts
\`\`\`typescript
<full corrected file content>
\`\`\`

FILE: lib/formatters.ts
\`\`\`typescript
<full corrected file content>
\`\`\`

Only include files that needed changes. No explanations outside the FILE blocks.`;

    const claudeResponse = await callClaude(prompt);
    const fixes = parseFixes(claudeResponse);

    if (fixes.length === 0) {
      // Fallback: restore known-clean files
      const cleanFixes = [];
      for (const path of FILES_TO_FIX) {
        try {
          const clean = await getFileContent(`error-sets/clean/${path}`);
          cleanFixes.push({ path, content: clean });
        } catch { /* skip */ }
      }
      if (cleanFixes.length === 0) {
        return NextResponse.json({ error: "Claude returned no fixes and clean fallback unavailable" }, { status: 500 });
      }
      fixes.push(...cleanFixes);
    }

    // 5. Commit Claude's fixes to GitHub
    const newState = JSON.stringify(
      {
        active: false,
        scene: currentState.scene ?? 0,
        timestamp: new Date().toISOString(),
        injectedFiles: [],
        fixedBy: "claude-agent",
      },
      null,
      2
    );

    await commitFiles(
      [
        ...fixes.map((f) => ({ path: f.path, content: f.content, message: "" })),
        { path: "chaos-state.json", content: newState, message: "" },
      ],
      `fix(agent): Claude-powered fix for scene ${currentState.scene ?? 0} — ${fixes.map((f) => f.path).join(", ")}`
    );

    return NextResponse.json({ success: true, files: fixes.map((f) => f.path) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/fix]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
