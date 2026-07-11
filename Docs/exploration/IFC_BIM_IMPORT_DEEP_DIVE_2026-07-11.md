# IFC/BIM Import Pipeline — Deep Dive (2026-07-11)

## Overview

The IFC/BIM import pipeline converts Building Information Modeling (BIM) IFC/STEP ASCII files into SentinelTwin SecurityScene nodes. It is a headless, zero-dependency parser that extracts structural geometry (walls, doors, windows, storeys) from ISO-10303-21 ASCII format and maps materials to simulation-relevant properties.

---

## Core Architecture: 3-Pass Headless STEP ASCII Parser

```
IFC/STEP ASCII → Tokenize → 3-Pass Parse → IfcParseResult → SiteCompilerResult → SiteTwinDraft
```

### Stage 1: STEP Tokenizer (`ifc-structural-parser.ts`)

**Zero-dependency regex-based entity extraction** from ISO-10303-21 ASCII:

```typescript
function tokenizeStepEntities(content: string): Map<number, StepEntity> {
  // 1. Strip IFC comments (/* ... */)
  const clean = content.replace(/\/\*[\s\S]*?\*\//g, "");
  
  // 2. Split on semicolons
  const lines = clean.split(";\n");
  
  // 3. Match #ID = TYPE(ARGS); pattern
  const regex = /^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)\s*$/i;
  
  for (const stmt of lines) {
    const match = trimmed.match(regex);
    if (match) {
      map.set(id, { id, type, argsString });
    }
  }
}
```

### Stage 2: 3-Pass Entity Extraction

**Pass 1: IFCCARTESIANPOINT → Point Map**
```typescript
// Extract 3D coordinates for geometry reference
for (const entity of entities.values()) {
  if (entity.type === "IFCCARTESIANPOINT") {
    const coords = cleanCoords.split(",").map(s => parseFloat(s.trim()) * scale);
    pointMap.set(entity.id, [x, y, z]);
  }
}
```

**Pass 2: IFCBUILDINGSTOREY → Levels**
```typescript
// Extract storeys with elevation ordering
for (const entity of entities.values()) {
  if (entity.type === "IFCBUILDINGSTOREY") {
    const name = cleanString(args[2] ?? args[7] ?? `Level ${stats.storeysFound}`);
    const elevation = parseFloat(args[9] ?? args[8] ?? "0") * scale;
    levels.push({ id, name, elevation, height: defaultHeight, order: i });
  }
}
// Sort ascending by elevation
levels.sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
```

**Pass 3: IFCWALL/IFCDOOR/IFCWINDOW → Spatial Nodes**
```typescript
for (const entity of entities.values()) {
  if (entity.type === "IFCWALL" || entity.type === "IFCWALLSTANDARDCASE") {
    // Material detection via keyword matching
    const materialDesc = cleanString(args[3] ?? "").toLowerCase();
    let material = options.defaultWallMaterial ?? "solid";
    let visionTransmission = 0;
    
    if (materialDesc.includes("glass") || materialDesc.includes("glaz")) {
      material = "glass";
      visionTransmission = 0.85;
    } else if (materialDesc.includes("grill") || materialDesc.includes("mesh")) {
      material = "grill";
      visionTransmission = 0.50;
    } else if (materialDesc.includes("partition")) {
      material = "partial";
      visionTransmission = 0.20;
    }
    
    // Geometry extraction from referenced points
    const geomPoints = extractReferencedPoints(entity.argsString, pointMap);
    if (geomPoints.length >= 2) {
      start = [geomPoints[0][0], geomPoints[0][1]];
      end = [geomPoints[geomPoints.length - 1][0], geomPoints[geomPoints.length - 1][1]];
    }
    
    // Level assignment by elevation
    const levelId = getLevelIdForElevation(elevationZ);
  }
}
```

---

## Material Mapping System

**Keyword-based detection** from IFC material descriptions:

| Keyword Match | Material | Vision Transmission | Simulation Effect |
|---------------|----------|--------------------|--------------------|
| glass, glaz | glass | 0.85 | Partial occlusion, light passes through |
| grill, mesh | grill | 0.50 | Partial occlusion, visible through gaps |
| partition | partial | 0.20 | Mostly opaque, slight visibility |
| (default) | solid | 0.00 | Full occlusion |

**4 material options with RF attenuation values** for future wireless planning:
- Solid: 20 dB attenuation
- Glass: 3 dB attenuation
- Grill: 6 dB attenuation
- Partial: 10 dB attenuation

---

## Multi-Floor Support

**IFCBUILDINGSTOREY entities** define floor levels:
- Each storey has an elevation (Z coordinate)
- Walls/doors/windows are assigned to floors based on their Z position
- Level switching in the UI allows viewing individual floors
- Coverage computation runs per-floor with floor-specific camera assignments

---

## Integration with Scene Compiler (`site-compiler.ts`)

The IFC parser feeds into the site compiler pipeline:

```typescript
function compileIfcToSiteTwinDraft(
  parseResult: IfcParseResult,
  options: CompileOptions
): SiteTwinDraft {
  // 1. Convert storeys → SecurityScene levels
  // 2. Convert walls → WallNode[] with material mapping
  // 3. Convert doors → DoorNode[] with state defaults
  // 4. Convert windows → WindowNode[] with state defaults
  // 5. Apply material transmission values
  // 6. Generate SiteTwinDraft with quality warnings
}
```

**Import/merge modes:**
- **Import**: Replace entire scene with IFC data
- **Merge**: Add IFC data to existing scene, preserving manual edits

---

## IfcImportModal UI (`IfcImportModal.tsx`)

- File picker for IFC/STEP ASCII files
- Level filtering: select which storeys to import
- Material override: default material for walls without keyword matches
- Preview: shows extracted geometry before commit
- Import/merge mode selection
- Progress indicator for large files

---

## Parser Statistics

The parser tracks:
- `storeysFound`: Number of IFCBUILDINGSTOREY entities
- `wallsExtracted`: Number of wall segments
- `doorsExtracted`: Number of door nodes
- `windowsExtracted`: Number of window nodes
- `pointsProcessed`: Number of IFCCARTESIANPOINT entities
- `materialOverrides`: Number of manual material assignments

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `packages/core/src/lib/ifc-structural-parser.ts` | STEP ASCII parser | 400+ |
| `packages/core/src/__tests__/ifc-structural-parser.test.ts` | Parser tests | 100+ |
| `apps/studio/src/components/workspace/modals/IfcImportModal.tsx` | Import UI | 300+ |
| `apps/studio/src/lib/site-compiler.ts` | Scene compiler | 1,200+ |
| `packages/core/src/index.ts` | Parser exports | — |

---

## Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No IFC4 support | Only IFC2x3 ASCII supported | Medium |
| No binary STEP parsing | Binary STEP files not supported | Low |
| No IfcRelContainedInSpatialStructure | Cannot follow IFC hierarchy | Medium |
| No material property sets | Only keyword detection, not IFCMATERIAL | Medium |
| No curve/arc wall geometry | Only linear walls extracted | Low |
| No IfcOpeningElement | Door/window positions may be approximate | Medium |

---

## Related Exploration Threads

- Thread 15: BIM / Pre-Construction Security
- Thread 34: IFC.js / That Open Company — BIM Import Viability
- Thread 158: IFC/BIM Import Pipeline (this document's index in EXPLORATION_MAP.md)
