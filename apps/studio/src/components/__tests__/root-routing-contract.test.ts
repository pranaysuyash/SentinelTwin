import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/page.tsx");

describe("Root routing contract", () => {
  test("keeps / as dashboard-first and /studio as the explicit workspace route", () => {
    const source = readFileSync(pagePath, "utf8");

    expect(source).toContain("const [enterStudio, setEnterStudio] = useState(false);");
    expect(source).toContain("if (enterStudio) {");
    expect(source).toContain("return <StudioShell />;");
    expect(source).not.toContain('searchParams.get("studio") === "1"');
    expect(source).not.toContain("shouldBypassLauncher");
  });
});
