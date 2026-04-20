#!/usr/bin/env node
/**
 * Restore all source files to clean working state.
 * Usage: node scripts/restore-clean.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CLEAN_FILES = [
  { src: "error-sets/clean/lib/data.ts", dest: "lib/data.ts" },
  { src: "error-sets/clean/lib/formatters.ts", dest: "lib/formatters.ts" },
  { src: "error-sets/clean/components/ActivityFeed.tsx", dest: "components/ActivityFeed.tsx" },
  { src: "error-sets/clean/components/UserTable.tsx", dest: "components/UserTable.tsx" },
];

console.log("\n🔧 Restoring clean source files...\n");

for (const { src, dest } of CLEAN_FILES) {
  const srcPath = resolve(ROOT, src);
  if (existsSync(srcPath)) {
    const { copyFileSync } = await import("fs");
    copyFileSync(srcPath, resolve(ROOT, dest));
    console.log(`   ✓ Restored ${dest}`);
  }
}

const statePath = resolve(ROOT, "chaos-state.json");
writeFileSync(
  statePath,
  JSON.stringify({ active: false, scene: 0, timestamp: null, injectedFiles: [] }, null, 2)
);
console.log(`   ✓ chaos-state.json reset`);

execSync("git add -A", { cwd: ROOT, stdio: "inherit" });
execSync('git commit -m "fix: restore clean state"', { cwd: ROOT, stdio: "inherit" });
execSync("git push", { cwd: ROOT, stdio: "inherit" });

console.log("\n✅ All files restored and deployed.\n");
