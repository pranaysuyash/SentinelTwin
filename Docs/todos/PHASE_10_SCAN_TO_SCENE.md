# Phase 10: Scan-to-Scene — Import and Scene Builder

## Goal
Enable users to create SecurityScenes from floor plan images, photos, or manual room-by-room specification. Currently the only way to get a scene is via the demo scene or blank canvas. This phase adds import pipelines and a scene builder wizard.

## Current State
- `demo-scenes/small-retail-shop.ts`: static JSON demo scene
- `createBlankSecurityScene()`: creates empty 10x8m room and is the canonical blank-scene shell
- Schema supports `source: "floor_plan_import" | "scan_import"` at the scene level
- Floor-plan import exists, and a separate manual-assisted scan intake now compiles into the same `SecurityScene` path

## What We Built

### P0 — Floor Plan Import Pipeline
- [x] **`src/lib/floor-plan-import.ts`**: Image-to-room extraction
  - Parses floor plan image via canvas (client-side, no external API)
  - Detects wall segments using edge detection (simple gradient-based)
  - Extracts room dimensions from wall bounding box
  - Identifies door/window openings from gaps in wall lines
  - Returns structured `FloorPlanResult` with walls, doors, windows, dimensions
- [x] **Heuristic wall detection**: Converts image pixels to wall segments via threshold + contour tracing
- [x] **Dimension extraction**: Maps pixel coordinates to meter-based room dimensions (configurable scale)

### P1 — Scene Builder Wizard
- [x] **SceneBuilderWizard component**: Multi-step wizard UI
  - **Step 1 — Room Setup**: Room name, dimensions (width/depth/height), unit selection
  - **Step 2 — Import Method**: Choose between blank canvas, floor plan import, template preset
  - **Step 3 — Floor Plan Upload**: Drag-and-drop image upload, preview, wall detection review
  - **Step 4 — Configure Scene**: Set assumptions (wall height, person height, DORI standard)
  - **Step 5 — Review & Create**: Summary of what will be created, confirm button
- [x] **ImportReview component**: Shows detected walls on a canvas overlay, allows toggling detected elements on/off
- [x] **Template presets**: Room templates (retail shop, office, warehouse, school classroom, parking garage) with pre-configured sizes

### P1.5 — Guided Scan Intake
- [x] **Launcher scan entry point**: Start page and TopBar both expose `Scan a Site...`
- [x] **`ScanSiteWizard`**: Manual-assisted scan intake UI
  - Upload or sample site image
  - Tap-to-place candidates on the image
  - Manual classification via type chips and per-candidate controls
  - Review list with status, label, confidence, and deletion
  - Compile to the canonical `scan_import` SecurityScene
- [x] **Shared blank-scene skeleton**: `createBlankSecurityScene()` reused by new-scene and scan compile flows
- [x] **`scan-to-scene` compile helper**: Converts accepted scan candidates into real cameras, doors, windows, lights, obstructions, entry points, and critical zones
- [x] **Manual-assisted honesty**: UI labels the flow as manual-assisted and does not claim AI segmentation/classification yet

### P2 — Scene Template System
- [x] **Template definitions**: Pre-built scene configurations for common spaces
- [x] **Template categories**: Retail, Office, Industrial, Education, Residential
- [x] **One-click creation**: Select template → customize dimensions → create scene

### P3 — Import Validation
- [x] **Floor plan validation**: Checks image dimensions, scale reasonableness, wall connectivity
- [x] **Scene validation**: Validates the generated scene schema before saving
- [x] **Error handling**: User-friendly error messages for import failures

### P4 — Tests
- [x] **Floor plan import tests**: Wall detection, dimension extraction, edge cases (empty image, too complex)
- [x] **Scene builder tests**: Wizard navigation, template creation, scene validation
- [x] **Integration test**: Full import → create → validate flow

## Key Decisions
- **Client-side only**: No image upload to server. Floor plan processing happens in-browser via Canvas API.
- **Heuristic not ML-based**: Wall detection uses simple gradient + contour tracing rather than ML. Complex floor plans may need refinement, but the 80% case works.
- **Templates are code-generated**: Not JSON files — each template is a function that generates a SecurityScene with appropriate defaults.
- **Wizard pattern**: Multi-step wizard rather than single-page form — reduces cognitive load for complex task.

## Validation
- TypeScript clean
- ESLint 0 errors
- All import + builder tests pass
- Existing tests still pass

## Files Created/Modified
- `apps/studio/src/lib/floor-plan-import.ts` — floor plan image processing
- `apps/studio/src/lib/scene-templates.ts` — scene template definitions
- `apps/studio/src/lib/scene-skeleton.ts` — shared blank-scene constructor
- `apps/studio/src/lib/scan-to-scene.ts` — scan candidate/session types and compile helper
- `apps/studio/src/components/scan-to-scene/SceneBuilderWizard.tsx` — wizard component
- `apps/studio/src/components/scan-to-scene/ImportReview.tsx` — import result review
- `apps/studio/src/components/scan-to-scene/ScanSiteWizard.tsx` — guided manual-assisted scan intake
- `apps/studio/src/store/studio-store.ts` — `importFromFloorPlan`, `importFromTemplate` actions
- `apps/studio/src/components/layout/TopBar.tsx` — scene menu entries, including `Scan a Site...`
- `apps/studio/src/app/page.tsx` — launcher screen with direct scan entry point
- `apps/studio/src/lib/__tests__/floor-plan-import.test.ts` — import tests
- `apps/studio/src/lib/__tests__/scene-templates.test.ts` — template tests
- `apps/studio/src/lib/__tests__/scan-to-scene.test.ts` — scan compile tests
