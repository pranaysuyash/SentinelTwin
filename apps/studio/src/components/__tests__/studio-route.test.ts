import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const studioRoutePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/studio/page.tsx");

describe("Studio route", () => {
  test("renders StudioShell for /studio", () => {
    const source = readFileSync(studioRoutePath, "utf8");

    expect(source).toContain("StudioShell");
    expect(source).toContain("export default function StudioRoutePage()");
    expect(source).toContain("return <StudioShell />;");
    expect(source).not.toContain("next/dynamic");
    expect(source).not.toContain("ssr: false");
    expect(source).not.toContain("Loading Studio");
  });
});
