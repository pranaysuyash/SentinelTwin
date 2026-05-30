import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const pagePath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../app/page.tsx");

describe("Root routing contract", () => {
  test("keeps / as dashboard-first and ?studio=1 as explicit StudioShell bypass", () => {
    const source = readFileSync(pagePath, "utf8");

    expect(source).toContain('const shouldBypassLauncher = searchParams.get("studio") === "1";');
    expect(source).toContain("const [enterStudio, setEnterStudio] = useState(shouldBypassLauncher);");
    expect(source).toContain("const [showProjects, setShowProjects] = useState(true);");
    expect(source).toContain("if (enterStudio) {");
    expect(source).toContain("return <StudioShell />;");
    expect(source).toContain("if (shouldBypassLauncher) {");
    expect(source).toContain("setEnterStudio(true);");
  });
});
