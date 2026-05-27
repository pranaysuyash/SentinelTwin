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
    expect(source).toContain("scene={snapshotA.scene}");
    expect(source).toContain("scene={snapshotB.scene}");
    expect(source).toContain("Use Latest Simulated");
    expect(source).toContain("Simulate Scenario B Now");
    expect(source).toContain("Changed Objects");
    expect(source).toContain("Capture Visual Evidence");
    expect(source).toContain("setCompareVisualEvidence");
    expect(source).toContain("Export Compare Report");
    expect(source).toContain("setCompareReportSelection");
  });
});
