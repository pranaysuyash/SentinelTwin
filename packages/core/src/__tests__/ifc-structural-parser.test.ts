import { describe, expect, it } from "vitest";
import { parseIfcToSecurityScene } from "../lib/ifc-structural-parser.js";

describe("parseIfcToSecurityScene", () => {
  it("extracts storeys, walls, doors, and windows from valid IFC STEP ASCII snippet", () => {
    const sampleIfc = `
ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#101 = IFCCARTESIANPOINT((0.0, 0.0, 0.0));
#102 = IFCCARTESIANPOINT((10.0, 0.0, 0.0));
#103 = IFCCARTESIANPOINT((5.0, 3.0, 3.5));
#201 = IFCBUILDINGSTOREY('1a2b3c', #2, 'Level 1', 'Ground Floor', $, #101, $, 'Ground Floor', .ELEMENT., 0.0);
#202 = IFCBUILDINGSTOREY('2b3c4d', #2, 'Level 2', 'First Floor', $, #103, $, 'First Floor', .ELEMENT., 3.5);
#301 = IFCWALL('3c4d5e', #2, 'Wall-001', 'Solid Concrete Wall 200mm', $, #101, #102, 'Wall-001');
#302 = IFCWALLSTANDARDCASE('4d5e6f', #2, 'Wall-002', 'Glass Partition', $, #101, #102, 'Wall-002');
#401 = IFCDOOR('5e6f7a', #2, 'Door-001', 'Single Door 900x2100', $, #101, #102, 'Door-001', 2.1, 0.9);
#501 = IFCWINDOW('6f7a8b', #2, 'Window-001', 'Double Glazed Window', $, #103, #102, 'Window-001', 1.4, 1.2);
ENDSEC;
END-ISO-10303-21;
`;

    const result = parseIfcToSecurityScene(sampleIfc);

    expect(result.stats.storeysFound).toBe(2);
    expect(result.stats.wallsFound).toBe(2);
    expect(result.stats.doorsFound).toBe(1);
    expect(result.stats.windowsFound).toBe(1);

    // Verify levels sorted by elevation
    expect(result.levels).toHaveLength(2);
    expect(result.levels[0]!.name).toBe("Level 1");
    expect(result.levels[0]!.elevation).toBe(0);
    expect(result.levels[1]!.name).toBe("Level 2");
    expect(result.levels[1]!.elevation).toBe(3.5);

    // Verify walls material mapping
    expect(result.walls).toHaveLength(2);
    expect(result.walls[0]!.material).toBe("solid");
    expect(result.walls[0]!.levelId).toBe(result.levels[0]!.id);
    expect(result.walls[1]!.material).toBe("glass");
    expect(result.walls[1]!.visionTransmission).toBe(0.85);

    // Verify door width and breach difficulty defaults
    expect(result.doors).toHaveLength(1);
    expect(result.doors[0]!.dimensions[0]).toBe(0.9);
    expect(result.doors[0]!.dimensions[2]).toBe(2.1);
    expect(result.doors[0]!.accessControl?.breachDifficulty).toBe(2);

    // Verify window properties and level association for elevation 3.5m
    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]!.id).toMatch(/^window_ifc_/);
    expect(result.windows[0]!.levelId).toBe(result.levels[1]!.id);
  });

  it("handles empty or malformed IFC strings gracefully with zero exceptions", () => {
    const result = parseIfcToSecurityScene("NOT AN IFC FILE AT ALL");
    expect(result.levels).toHaveLength(0);
    expect(result.walls).toHaveLength(0);
    expect(result.stats.storeysFound).toBe(0);
  });
});
