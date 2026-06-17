# Architecture: Perimeter & Outdoor Security Layer

**Decision:** D-318  
**Status:** Adopted — implemented in Thread 149  
**Date:** 2026-06-17

---

## 1. Why perimeter is a distinct architectural layer

The existing simulation models an **interior camera coverage problem**: given a room and cameras, which cells of the floor are covered at which quality? The perimeter is a different problem: given a site boundary, how hard is it for a threat to reach the interior at all?

These two layers interact but are not the same:
- Interior coverage: DORI quality, blind spots, path exposure
- Perimeter integrity: fence continuity, gate access, vehicle deterrence, boundary camera coverage

A physical security assessment without perimeter coverage misses the most common real-world attack vector — adversaries entering at unmonitored boundary points before reaching an interior camera's field of view.

---

## 2. New node types

### 2.1 FenceSegment (`fence_segment`)

A line segment representing a section of perimeter fencing or boundary wall.

**Key properties:**
- `start`, `end`: 2D positions in the scene coordinate system
- `heightM`: physical height (affects climb difficulty and line-of-sight)
- `material`: `chain_link` | `solid_metal` | `timber` | `brick` | `razor_wire` | `electric`
- `visionTransmission`: 0–1 (chain_link ≈ 0.7, solid_metal = 0)
- `integrityState`: `intact` | `damaged` | `breached`
- `climbDifficulty`: 1–5 (1 = easy, 5 = electric/razor wire)

**Simulation role:**
FenceSegments participate in the vision collider mesh the same way walls do — `visionTransmission < 1` allows cameras outside the fence to see through it at reduced quality. This lets the engine model chain-link fences correctly (cameras can partially see through them from outside, covering the entry approach).

**Adversarial path:** FenceSegments are barriers. An adversary cannot cross a fence segment (it is non-walkable in the Dijkstra grid) unless there is a GateNode gap in it. The adversarial path simulation will route through GateNode positions.

### 2.2 GateNode (`gate_node`)

A traversal point in a fence perimeter. Gates are access-controlled openings.

**Key properties:**
- `position`: 2D centroid of the gate opening
- `fenceSegmentId`: which fence segment this gate belongs to (optional reference)
- `gateType`: `pedestrian` | `vehicle` | `service`
- `state`: `open` | `closed` | `locked` | `restricted`
- `widthM`: gate opening width
- `accessControl`: same schema as `DoorNode.accessControl` — `type`, `breachDifficulty`, `breachTimeS`
- `hasCameraView`: whether a camera directly covers this gate opening
- `lprCameraId`: optional reference to the LPR-capable camera watching this gate

**Simulation role:**
GateNodes are adversarial path entry points for the perimeter layer — analogous to `EntryPoint` for the interior. The adversarial path simulation routes through the lowest-difficulty GateNode to enter the scene, then continues through the interior.

**Perimeter integrity scoring:** A gate with `hasCameraView: false` counts as a "blind entry point" — a site-level risk flag.

### 2.3 BollardLine (`bollard_line`)

A line of physical vehicle barriers between two positions.

**Key properties:**
- `start`, `end`: 2D endpoints
- `spacingM`: gap between bollards (affects vehicle passthrough — < 1.2m prevents standard vehicles)
- `bollardType`: `fixed` | `removable` | `retractable`
- `protectionClass`: `standard` | `pas68` | `iwa14_1`

**Simulation role:**
BollardLines modify adversarial path costs for vehicle-class threats only. In the current pedestrian-only Dijkstra model, bollardLines have no effect on path cost. They are surfaced in the report as physical hardening evidence.

Future work (V0.3+): vehicle-class threat model where BollardLines block vehicle-class paths but not pedestrian paths.

---

## 3. LPR capability on CameraNode

LPR (License Plate Recognition) is modeled as a capability on existing `CameraNode` rather than a separate node type.

**Rationale:** An LPR camera IS a camera. It has a frustum, a mount position, a DORI coverage contribution. Adding a separate `lpr_camera` node type would duplicate all camera rendering, inspector, and simulation logic. The capability delta is small: a read range, a max speed, and a mount angle preference.

**Schema extension on `cameraNodeSchema`:**
```typescript
lprCapable: z.boolean().default(false),
lprConfig: z.object({
  readRangeM: z.number().positive(),
  maxSpeedKph: z.number().nonneg(),
  mountAngle: z.enum(["front_on", "side_on", "angled"]),
}).optional(),
```

**Simulation role:**
LPR cameras that cover a GateNode contribute to the gate's `hasCameraView` flag in the perimeter integrity score. Future work: LPR plate-read quality scoring (separate from DORI).

---

## 4. Perimeter integrity score

`SimulationResult` gains an optional `perimeterIntegrity` field:

```typescript
perimeterIntegrity: {
  fenceSegmentCount: number,
  totalPerimeterM: number,
  coveredPerimeterM: number,          // segments with camera coverage
  integrityPct: number,               // coveredPerimeterM / totalPerimeterM * 100
  blindGates: { gateId, gateLabel }[],
  breachedSegments: { segmentId, label }[],
}
```

**Coverage check:** Sample N points evenly along all FenceSegments. For each point, cast a ray from each camera. If any camera covers the point at `detection` quality or better, the point is "covered." `integrityPct` is the fraction of covered points.

**This is a new simulation output dimension, not a replacement for existing DORI scoring.**

---

## 5. What is NOT changing

- The `SecurityScene` discriminated union (`AnyNode`) gains three new members: `FenceSegment | GateNode | BollardLine`
- All existing interior coverage, DORI, adversarial path, and temporal simulation logic is unchanged
- No new rendering infrastructure — fence segments render as lines in the 2D heatmap using the same wall rendering pipeline with different color/style
- The vision collider mesh builder gains fence segment support alongside wall support

---

## 6. Rule-5 compliance checklist

When fence/gate/bollard are added, ALL of the following must be updated in the same pass:

- [ ] `packages/core/src/schema/security-scene.ts` — schema definitions + types + scene base
- [ ] `apps/studio/src/schema/security-scene.ts` — identical mirror
- [ ] `packages/simulation/src/adversarial-path.ts` — GateNode as entry points
- [ ] `packages/simulation/src/vision-collider-mesh.ts` — FenceSegment as vision colliders
- [ ] `packages/simulation/src/simulate-studio.ts` — perimeterIntegrity in buildSimulationResult
- [ ] `apps/studio/src/store/slices/core/scene-slice.ts` — store actions + AnyEditableNode union
- [ ] `apps/studio/src/lib/scene-skeleton.ts` — empty arrays on blank scene
- [ ] Inspector panels: `FenceInspector.tsx`, `GateNodeInspector.tsx`, `BollardInspector.tsx`
- [ ] CameraInspector: LPR section in properties tab

---

## 7. Future work (not in Thread 149)

- **V0.3:** Vehicle-class threat model — BollardLines block vehicle paths in a separate vehicle Dijkstra pass
- **V0.3:** LPR plate-read quality scoring — separate PPM model for plate vs DORI person
- **V1.0:** Integration with access control hardware (ONVIF Profile A)
- **V1.0:** Perimeter camera patrol scheduling — guard patrol rounds along the perimeter fence
