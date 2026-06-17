import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const studioRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

function* walkBaks(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const s = statSync(full);
    if (s.isDirectory()) {
      yield* walkBaks(full);
    } else if (entry.endsWith(".bak")) {
      yield full;
    }
  }
}

describe("no stale .bak files in studio (I13)", () => {
  test("no .bak files exist under the apps/studio tree", () => {
    const baks = Array.from(walkBaks(studioRoot));
    expect(baks).toEqual([]);
  });
});