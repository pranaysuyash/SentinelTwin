# Contextual Panel Mapping (Adobe-style) — 2026-05-30

## Goal
When an object is clicked in canvas/map/camera wall, open the **right contextual panel** automatically with controls specific to that object class.

## Implemented behavior

### Dock behavior
- Any non-null selection auto-expands right dock (unless `focusMode` is active).
- Right-dock attention badge is cleared when auto-open happens.

### Node-to-panel mapping
- `camera` -> `camera_controls`
- `path` -> `inspector` (path controls surfaced in inspector + scenario/path section)
- `sensor` -> `inspector`
- `obstruction` -> `inspector`
- `security_light` -> `inspector`
- `wall` -> `inspector`
- `door` -> `inspector`
- `window` -> `inspector`
- `critical_zone` -> `inspector`
- `privacy_zone` -> `inspector`
- `entry_point` -> `inspector`
- unknown/non-node -> keep current panel mode

### Node-to-bottom-tab mapping
- `camera` -> `metrics`
- `path` -> `timeline`
- `sensor` -> `sensors`
- other node types -> keep current bottom tab

## Source of truth in code
- Selection/context routing:
  - `apps/studio/src/store/studio-store.ts`
  - helpers:
    - `resolveSelectedNodeType(scene, id)`
    - `contextualRightPanelModeForNode(scene, id)`
  - applied in:
    - `selectNode`
    - `setSelectedNodes`
    - `addSelectedNode`
    - `toggleSelectedNode`
    - `setSelectedCameraId`

## Why this matches requested UX
- Mirrors Adobe-style contextual inspector behavior:
  - user action (selection) directly drives which panel opens,
  - no manual panel hunting required for common edit flows,
  - camera clicks land in camera-specific controls immediately.

## Remaining optional upgrades
- Path selection can optionally switch bottom drawer to `timeline` automatically.
- Multi-selection rules can prefer `bulk_camera` when all selected nodes are cameras.
- Add explicit UI hint (“Context switched to Camera Controls”) for first-run clarity.
