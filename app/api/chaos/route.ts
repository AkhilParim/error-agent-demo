import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { commitFiles, getFileContent } from "@/lib/github";

const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());
const SCENES = 3;

interface SceneFile {
  src: string;
  dest: string;
}

const SCENE_FILES: Record<number, SceneFile[]> = {
  1: [
    { src: "error-sets/scene-1/lib/data.ts", dest: "lib/data.ts" },
    { src: "error-sets/scene-1/lib/formatters.ts", dest: "lib/formatters.ts" },
  ],
  2: [
    { src: "error-sets/scene-2/lib/data.ts", dest: "lib/data.ts" },
    { src: "error-sets/scene-2/lib/formatters.ts", dest: "lib/formatters.ts" },
  ],
  3: [
    { src: "error-sets/scene-3/lib/data.ts", dest: "lib/data.ts" },
    { src: "error-sets/scene-3/lib/formatters.ts", dest: "lib/formatters.ts" },
  ],
};

export async function GET() {
  // Read from the deployed filesystem — this ensures chaos-state and component
  // health are always in sync (both reflect the same Vercel deployment).
  // The polling in ChaosControl uses /api/deployed-state for the same reason.
  const statePath = path.join(ROOT, "chaos-state.json");
  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf-8"))
    : { active: false, scene: 0 };
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json().catch(() => ({ action: "inject" }));

    if (action !== "inject") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    // Always read current state from GitHub — the filesystem snapshot on the
    // deployed Vercel instance can be stale (e.g. if the last deploy was from
    // a different chaos state).
    let currentState: { active: boolean; scene: number } = { active: false, scene: 0 };
    try {
      const raw = await getFileContent("chaos-state.json");
      currentState = JSON.parse(raw);
    } catch {
      // fall back to filesystem if GitHub token isn't configured
      const statePath = path.join(ROOT, "chaos-state.json");
      if (existsSync(statePath)) currentState = JSON.parse(readFileSync(statePath, "utf-8"));
    }

    const nextScene = (currentState.scene % SCENES) + 1;
    const files = SCENE_FILES[nextScene];

    const updates = files.map((f) => ({
      path: f.dest,
      content: readFileSync(path.join(ROOT, f.src), "utf-8"),
      message: "",
    }));

    const chaosStateContent = JSON.stringify(
      {
        active: true,
        scene: nextScene,
        timestamp: new Date().toISOString(),
        injectedFiles: files.map((f) => f.dest),
      },
      null,
      2
    );

    await commitFiles(
      [...updates, { path: "chaos-state.json", content: chaosStateContent, message: "" }],
      `chaos: inject error set ${nextScene} — ${files.map((f) => f.dest).join(", ")}`
    );

    return NextResponse.json({ success: true, scene: nextScene, files: files.map((f) => f.dest) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/chaos] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
