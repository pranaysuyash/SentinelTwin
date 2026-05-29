#!/usr/bin/env bun

import { execSync } from "node:child_process";

const KNOWN_GENERATED_PATTERNS: Array<{ pattern: RegExp; suggestedIgnore: string; reason: string }> = [
  { pattern: /^outputs\//, suggestedIgnore: "outputs/", reason: "generated runtime outputs" },
  { pattern: /^qa-output\//, suggestedIgnore: "qa-output/", reason: "generated QA artifacts" },
  {
    pattern: /^experiments\/scene_understanding\/outputs\/stack_.*\//,
    suggestedIgnore: "experiments/scene_understanding/outputs/stack_*/",
    reason: "scene-understanding bakeoff generated runs",
  },
  { pattern: /^\.playwright-mcp\//, suggestedIgnore: ".playwright-mcp/", reason: "Playwright MCP runtime state" },
  { pattern: /(^|\/)\.governance-archive\//, suggestedIgnore: "apps/studio/.governance-archive/", reason: "local governance archive" },
  { pattern: /(^|\/)\.support-delivery\//, suggestedIgnore: "apps/studio/.support-delivery/", reason: "local support delivery archive" },
  { pattern: /(^|\/)\.support-ingest\//, suggestedIgnore: "apps/studio/.support-ingest/", reason: "local support ingest archive" },
  { pattern: /(^|\/)\.workspace-membership-archive\//, suggestedIgnore: "apps/studio/.workspace-membership-archive/", reason: "local workspace membership archive" },
  { pattern: /^sentineltwin-.*\.png$/i, suggestedIgnore: "sentineltwin-*.png", reason: "generated screenshots" },
  { pattern: /^sentinel-novel-.*\.png$/i, suggestedIgnore: "sentinel-novel-*.png", reason: "generated novel algorithm screenshots" },
  { pattern: /^.*-open-studio\.png$/i, suggestedIgnore: "*-open-studio.png", reason: "local studio screenshot captures" },
  { pattern: /^studio-wait-.*\.png$/i, suggestedIgnore: "studio-wait-*.png", reason: "local studio wait-state captures" },
  { pattern: /^\.codex-.*\.png$/i, suggestedIgnore: ".codex-*.png", reason: "agent-generated screenshot artifacts" },
  { pattern: /(^|\/)node_modules\//, suggestedIgnore: "node_modules/", reason: "dependency install output" },
  { pattern: /(^|\/)\.next\//, suggestedIgnore: ".next/", reason: "Next.js build output" },
  { pattern: /(^|\/)coverage\//, suggestedIgnore: "coverage/", reason: "test coverage output" },
  { pattern: /\.tsbuildinfo$/i, suggestedIgnore: "*.tsbuildinfo", reason: "TypeScript incremental build state" },
  { pattern: /\.log$/i, suggestedIgnore: "*.log", reason: "runtime logs" },
];

function runGit(args: string): string {
  return execSync(`git ${args}`, { encoding: "utf8" }).trim();
}

function collectUntrackedFiles(): string[] {
  const output = runGit("status --porcelain --untracked-files=all");
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith("?? "))
    .map((line) => line.slice(3));
}

function main() {
  let repoRoot = "";
  try {
    repoRoot = runGit("rev-parse --show-toplevel");
  } catch {
    console.error("✖ Not inside a git repository.");
    process.exit(2);
  }

  const untracked = collectUntrackedFiles();

  if (untracked.length === 0) {
    console.log(`✔ Ignore audit clean in ${repoRoot}`);
    console.log("No untracked files detected.");
    process.exit(0);
  }

  const suspicious = untracked
    .map((filePath) => {
      const match = KNOWN_GENERATED_PATTERNS.find((entry) => entry.pattern.test(filePath));
      if (!match) return null;
      return {
        filePath,
        suggestedIgnore: match.suggestedIgnore,
        reason: match.reason,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  console.log(`ℹ Found ${untracked.length} untracked file(s).`);

  if (suspicious.length === 0) {
    console.log("No known generated artifact patterns detected. Review manually before commit.");
    process.exit(0);
  }

  console.error("✖ Potential generated artifacts are not ignored:");
  for (const item of suspicious) {
    console.error(`  - ${item.filePath} (${item.reason})`);
  }

  const uniqueSuggestions = Array.from(new Set(suspicious.map((item) => item.suggestedIgnore))).sort();
  console.error("\nSuggested .gitignore additions:");
  for (const suggestion of uniqueSuggestions) {
    console.error(`  ${suggestion}`);
  }

  process.exit(1);
}

main();
