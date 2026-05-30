import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const errorBoundaryPath = join(import.meta.dir, "../error.tsx");

describe("Studio error boundary", () => {
  test("uses the shared error fallback and divider utilities", () => {
    const source = readFileSync(errorBoundaryPath, "utf8");

    expect(source).toContain("ErrorFallback");
    expect(source).toContain("HorizontalDivider");
    expect(source).toContain("The studio hit a runtime error");
    expect(source).toContain("Retry will re-enter the canonical shell");
  });
});
