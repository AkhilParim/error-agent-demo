import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { commitFiles } from "@/lib/github";

const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());

const CLEAN_FILES = [
  { src: "error-sets/clean/lib/data.ts", dest: "lib/data.ts" },
  { src: "error-sets/clean/lib/formatters.ts", dest: "lib/formatters.ts" },
];

export async function POST() {
  try {
    const statePath = path.join(ROOT, "chaos-state.json");
    const currentState = existsSync(statePath)
      ? JSON.parse(readFileSync(statePath, "utf-8"))
      : { active: false, scene: 0 };

    if (!currentState.active) {
      return NextResponse.json({ success: true, message: "Already clean" });
    }

    const updates = CLEAN_FILES.map((f) => ({
      path: f.dest,
      content: readFileSync(path.join(ROOT, f.src), "utf-8"),
      message: "",
    }));

    const newState = JSON.stringify(
      {
        active: false,
        scene: currentState.scene,
        timestamp: new Date().toISOString(),
        injectedFiles: [],
        fixedBy: "agent",
      },
      null,
      2
    );

    await commitFiles(
      [...updates, { path: "chaos-state.json", content: newState, message: "" }],
      `fix: restore clean files after scene ${currentState.scene}`
    );

    return NextResponse.json({ success: true, scene: currentState.scene });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/fix] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
