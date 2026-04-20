import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd());

// Reads chaos-state from THIS deployment's filesystem snapshot.
// Used to detect when a new Vercel deployment has gone live:
// poll here until the value matches what was just committed to GitHub.
export async function GET() {
  const statePath = path.join(ROOT, "chaos-state.json");
  const state = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf-8"))
    : { active: false, scene: 0 };
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
