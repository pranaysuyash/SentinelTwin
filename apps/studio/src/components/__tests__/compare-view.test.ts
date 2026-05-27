import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const compareViewPath = "/Users/pranay/Projects/SentinelTwin/apps/studio/src/components/view/CompareView.tsx";

describe("CompareView", () => {
  test("exposes explicit scenario selectors and canonical snapshot saving", () => {
    const source = readFileSync(compareViewPath, "utf8");

    expect(source).toContain("const [comparisonAId, setComparisonAId] = useState<string | null>(null);");
    expect(source).toContain("const [comparisonBId, setComparisonBId] = useState<string | null>(null);");
    expect(source).toContain("Scenario A");
    expect(source).toContain("Scenario B");
    expect(source).toContain('const saveSnapshot = useStudioStore((s) => s.saveSnapshot);');
    expect(source).toContain('onClick={() => saveSnapshot(`Scenario ${snapshots.length + 1}`)}');
    expect(source).toContain("Add Scenario");
  });
});
