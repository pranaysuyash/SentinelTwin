#!/usr/bin/env bun
/**
 * hex-drift-detect.ts — Baseline-aware raw hex color drift detection.
 *
 * Scans studio chrome files for raw hex color patterns (text-[#xxx], bg-[#xxx],
 * border-[#xxx], hover:bg-[#xxx], etc.) and compares the current count against
 * a saved baseline. Fails CI if the count increases (new raw hex added).
 * Allows the count to stay the same or decrease (migration in progress).
 *
 * Usage:
 *   bun tools/hex-drift-detect.ts              # Check against baseline
 *   bun tools/hex-drift-detect.ts --update     # Update baseline with current counts
 *   bun tools/hex-drift-detect.ts --verbose    # Show per-file breakdown
 *
 * The baseline file lives at tools/hex-drift-baseline.json and should be
 * committed. When a developer migrates hex colors, they run --update to
 * lower the ceiling. When a regression is introduced, CI catches it.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";

// ── Configuration ──

/** Directories to scan (chrome only — not canvas/map geometry, not token defs). */
const CHROME_DIRS = [
  "apps/studio/src/components/view",
  "apps/studio/src/components/bottom-panel",
  "apps/studio/src/components/bottom-row",
  "apps/studio/src/components/dock",
  "apps/studio/src/components/top-bar",
  "apps/studio/src/components/layout",
  "apps/studio/src/components/left-panel",
  "apps/studio/src/components/inspector",
  "apps/studio/src/components/shared",
  "apps/studio/src/components/launcher",
  "apps/studio/src/components/site-intake",
  "apps/studio/src/components/scan-to-scene",
  "apps/studio/src/components/product",
  "apps/studio/src/components/security-outcome",
  "apps/studio/src/components/command-bar",
  "apps/studio/src/components/workspace",
  "apps/studio/src/components/agents",
  "apps/studio/src/components/panels",
  "apps/studio/src/components/reconstruction",
  "apps/studio/src/components/demo",
  "apps/studio/src/components/map",
  "apps/studio/src/components/path-replay",
];

/** Files/patterns to skip. */
const SKIP_PATTERNS = [
  "studio-surface-tokens.ts",
  "design-tokens.ts",
  "map-colors.ts",
  "/__tests__/",
  ".test.ts",
  ".test.tsx",
];

/** Regex for raw hex patterns in Tailwind classes. */
const RAW_HEX_RE =
  /(?:text|bg|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-\[#([0-9a-fA-F]{6})\]/g;

/** Regex for hover-prefixed hex patterns. */
const HOVER_HEX_RE =
  /hover:(?:text|bg|border)-\[#([0-9a-fA-F]{6})\]/g;

// ── Types ──

interface Baseline {
  version: 2;
  timestamp: string;
  total: number;
  byDir: Record<string, number>;
  byFile: Record<string, number>;
}

// ── Helpers ──

function projectRoot(): string {
  return join(import.meta.dir, "..");
}

function baselinePath(): string {
  return join(projectRoot(), "tools", "hex-drift-baseline.json");
}

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((p) => filePath.includes(p));
}

function countHexInFile(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    let count = 0;
    // Count bare hex patterns
    const bareMatches = content.match(RAW_HEX_RE);
    if (bareMatches) count += bareMatches.length;
    // Count hover hex patterns
    const hoverMatches = content.match(HOVER_HEX_RE);
    if (hoverMatches) count += hoverMatches.length;
    return count;
  } catch {
    return 0;
  }
}

function scanChromFiles(): Baseline {
  const root = projectRoot();
  const byDir: Record<string, number> = {};
  const byFile: Record<string, number> = {};
  let total = 0;

  for (const dir of CHROME_DIRS) {
    const fullPath = join(root, dir);
    try {
      const output = execSync(
        `find "${fullPath}" -name '*.tsx' -o -name '*.ts' 2>/dev/null`,
        { encoding: "utf-8", timeout: 10_000 },
      );
      const files = output.trim().split("\n").filter(Boolean);
      let dirCount = 0;

      for (const file of files) {
        if (shouldSkip(file)) continue;
        const count = countHexInFile(file);
        if (count > 0) {
          const rel = relative(root, file);
          byFile[rel] = count;
          dirCount += count;
        }
      }

      if (dirCount > 0) {
        byDir[dir] = dirCount;
        total += dirCount;
      }
    } catch {
      // Directory might not exist — skip
    }
  }

  return {
    version: 2,
    timestamp: new Date().toISOString(),
    total,
    byDir,
    byFile,
  };
}

// ── Main ──

function main() {
  const args = process.argv.slice(2);
  const updateMode = args.includes("--update");
  const verbose = args.includes("--verbose");
  const root = projectRoot();

  console.log("🔍 Scanning studio chrome files for raw hex color patterns...\n");

  const current = scanChromFiles();
  const baselineFile = baselinePath();

  if (updateMode) {
    // Write new baseline
    writeFileSync(baselineFile, JSON.stringify(current, null, 2) + "\n");
    console.log(`✅ Baseline updated: ${current.total} raw hex patterns`);
    console.log(`   Saved to: ${relative(root, baselineFile)}`);
    console.log(`   Timestamp: ${current.timestamp}`);

    if (verbose) {
      console.log("\nPer-directory breakdown:");
      for (const [dir, count] of Object.entries(current.byDir).sort(
        (a, b) => b[1] - a[1],
      )) {
        console.log(`  ${String(count).padStart(4)}  ${dir}`);
      }
    }
    return;
  }

  // Check against baseline
  if (!existsSync(baselineFile)) {
    console.error(
      `⚠️  No baseline file found at ${relative(root, baselineFile)}`,
    );
    console.error("   Run: bun tools/hex-drift-detect.ts --update");
    process.exit(1);
  }

  const baseline: Baseline = JSON.parse(readFileSync(baselineFile, "utf-8"));
  const diff = current.total - baseline.total;

  console.log(`Baseline:  ${baseline.total} raw hex patterns`);
  console.log(`Current:   ${current.total} raw hex patterns`);
  console.log(`Timestamp: ${baseline.timestamp}`);

  if (diff > 0) {
    console.log(`\n❌ REGRESSION: +${diff} new raw hex patterns detected!\n`);
    console.log(
      "   Raw hex colors in studio chrome must use UI_SURFACES tokens.",
    );
    console.log("   See: apps/studio/src/lib/studio-surface-tokens.ts\n");

    if (verbose) {
      console.log("Per-directory delta:");
      const allDirs = new Set([
        ...Object.keys(baseline.byDir),
        ...Object.keys(current.byDir),
      ]);
      for (const dir of [...allDirs].sort()) {
        const b = baseline.byDir[dir] ?? 0;
        const c = current.byDir[dir] ?? 0;
        const d = c - b;
        if (d !== 0) {
          const sign = d > 0 ? "+" : "";
          console.log(`  ${sign}${String(d).padStart(4)}  ${dir}`);
        }
      }

      console.log("\nNew files with hex (not in baseline):");
      let found = 0;
      for (const [file, count] of Object.entries(current.byFile)) {
        if (!(file in baseline.byFile)) {
          console.log(`  ${String(count).padStart(4)}  ${file}`);
          found++;
        }
      }
      if (found === 0) console.log("  (none)");
    }

    console.log(
      "\n   To fix: migrate hex colors to UI_SURFACES tokens, then run:",
    );
    console.log("   bun tools/hex-drift-detect.ts --update");
    process.exit(1);
  } else if (diff < 0) {
    console.log(
      `\n✅ PASS: ${Math.abs(diff)} hex patterns migrated (count decreased).`,
    );
  } else {
    console.log("\n✅ PASS: No regression detected.");
  }

  if (verbose) {
    console.log("\nPer-directory breakdown:");
    for (const [dir, count] of Object.entries(current.byDir).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${String(count).padStart(4)}  ${dir}`);
    }
  }
}

main();
