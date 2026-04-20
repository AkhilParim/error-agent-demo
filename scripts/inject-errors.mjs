#!/usr/bin/env node
/**
 * Local chaos injection script.
 * Usage: node scripts/inject-errors.mjs
 *
 * Copies the next scene's broken files into place, commits, and pushes.
 * Vercel auto-deploys from the push. PostHog captures the live errors.
 * The Claude agent detects them and pushes a fix.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SCENES = 3;
const SCENE_FILES = {
  1: [
    { src: "error-sets/scene-1/lib/data.ts", dest: "lib/data.ts" },
    { src: "error-sets/scene-1/lib/formatters.ts", dest: "lib/formatters.ts" },
  ],
  2: [
    { src: "error-sets/scene-2/lib/data.ts", dest: "lib/data.ts" },
    { src: "error-sets/scene-2/components/ActivityFeed.tsx", dest: "components/ActivityFeed.tsx" },
  ],
  3: [
    { src: "error-sets/scene-3/lib/formatters.ts", dest: "lib/formatters.ts" },
    { src: "error-sets/scene-3/components/UserTable.tsx", dest: "components/UserTable.tsx" },
  ],
};

const SCENE_DESCRIPTIONS = {
  1: "Null reference in data layer (2 errors) + currency formatter crash (1 error)",
  2: "Division-by-zero in metrics + wrong timestamp property + .map() on null",
  3: "Invalid Date formatting + null pointer in formatUserName + UserTable crash",
};

const statePath = resolve(ROOT, "chaos-state.json");
const currentState = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf-8"))
  : { active: false, scene: 0 };

const nextScene = (currentState.scene % SCENES) + 1;
const files = SCENE_FILES[nextScene];

console.log(`\n🎭 Injecting Error Scene ${nextScene}/${SCENES}`);
console.log(`   ${SCENE_DESCRIPTIONS[nextScene]}\n`);

for (const { src, dest } of files) {
  copyFileSync(resolve(ROOT, src), resolve(ROOT, dest));
  console.log(`   ✓ ${src} → ${dest}`);
}

const newState = {
  active: true,
  scene: nextScene,
  timestamp: new Date().toISOString(),
  injectedFiles: files.map((f) => f.dest),
};
writeFileSync(statePath, JSON.stringify(newState, null, 2));
console.log(`   ✓ chaos-state.json updated`);

console.log(`\n📦 Committing and pushing...`);
execSync("git add -A", { cwd: ROOT, stdio: "inherit" });
execSync(
  `git commit -m "chaos: inject error set ${nextScene} — ${files.map((f) => f.dest).join(", ")}"`,
  { cwd: ROOT, stdio: "inherit" }
);
execSync("git push", { cwd: ROOT, stdio: "inherit" });

console.log(`\n🚨 Done! Error set ${nextScene} is live.`);
console.log(`   Vercel is redeploying now (~30s)`);
console.log(`   PostHog will capture exceptions when users hit the broken routes`);
console.log(`   The Claude agent will detect and fix them automatically\n`);
