import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { commitFiles } from "@/lib/github";

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
  const statePath = path.join(ROOT, "chaos-state.json");
  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf-8"))
    : { active: false, scene: 0 };
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json().catch(() => ({ action: "inject" }));

    if (action !== "inject") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const statePath = path.join(ROOT, "chaos-state.json");
    const currentState = existsSync(statePath)
      ? JSON.parse(readFileSync(statePath, "utf-8"))
      : { active: false, scene: 0 };

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
