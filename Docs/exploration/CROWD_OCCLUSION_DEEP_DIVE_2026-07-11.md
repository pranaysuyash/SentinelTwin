# Crowd Occlusion & NPC Simulation — Deep Dive

**Thread:** 147  
**Date:** 2026-07-11  
**Status:** Documentation complete  

---

## 1. System Overview

The crowd occlusion system computes **dynamic coverage penalties** caused by people and objects moving through a scene. Unlike static obstruction occlusion (handled by `occlusion-blame.ts`), this system models **time-varying agent density** across critical zones using a Poisson-process probability model.

**Core equation:**
```
occlusion_probability = 1 - e^(-λ · A_agent)
```
Where:
- `λ` = agent density (agents/m²) in the zone
- `A_agent` = π · bodyRadius² (cross-sectional area of an agent)

**Key insight:** This is a **statistical model**, not a spatial simulation. It doesn't track individual agent positions — it computes the *probability* that a camera's line-of-sight to a cell is blocked by *any* agent in the zone at a given density.

---

## 2. Core Algorithm (`crowd-sim.ts`)

### 2.1 Input Processing

```
computeCrowdOcclusion(scene, coverageCells, crowdProfiles, hour)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `scene` | `SecurityScene` | Provides `criticalZones` with polygon boundaries |
| `coverageCells` | Cell array | Output from geometric coverage simulation |
| `crowdProfiles` | `CrowdProfile[]` | Agent archetypes with 24h count arrays |
| `hour` | `0–23` | Time slot to evaluate |

### 2.2 Density Computation

For each enabled profile and each archetype:

1. **Read count** from `countByHour[hour]`
2. **Distribute agents** across preferred zones (or all zones if empty)
3. **Compute density** per zone: `count_per_zone / zone_area`
4. **Accumulate** across all profiles

**Zone area calculation:**
- Uses polygon shoelace formula (`polygonArea()`)
- Minimum 0.5 m² to prevent divide-by-zero on degenerate polygons

**Ambient density:**
- Cells outside all zones receive 10% of mean zone density
- Prevents zero occlusion in transition areas

### 2.3 Per-Cell Occlusion

For each active coverage cell:

1. **Point-in-polygon test** against all critical zones
2. **Sum density** from all overlapping zones
3. **Compute occlusion probability** via Poisson model
4. **Track effective coverage** = geometric coverage × (1 - occlusionP)

### 2.4 Chokepoint Detection

A cell is flagged as a **chokepoint** when:
- It is geometrically covered (quality ≠ "none")
- Occlusion probability > **0.4** (40%)

Chokepoints are sorted by severity and capped at **top 10** in output.

---

## 3. Agent Archetypes

### 3.1 Schema (`agentArchetypeSchema`)

```typescript
{
  archetypeId: string;        // Unique identifier
  label: string;              // Display name
  bodyRadiusM: number;        // Cross-section radius (default 0.3m)
  heightM: number;            // Agent height (default 1.7m)
  preferredZones: string[];   // Zone IDs (empty = all zones)
  countByHour: number[24];    // Agent count per hour
}
```

### 3.2 Default Retail Archetypes

| Archetype | Body Radius | Peak Hour | Peak Count | Notes |
|-----------|-------------|-----------|------------|-------|
| **Customer** | 0.30m | 12:00 | 32 | Retail traffic curve |
| **Staff** | 0.30m | 08:00–18:00 | 5 | Consistent during business hours |
| **Stocking Cart** | 0.55m | 06:00–08:00 | 3 | Wider radius blocks more view |
| **Loiterer** | 0.30m | 16:00–17:00 | 4 | Peaks when staff density drops |

**Key design choices:**
- **Stocking cart** has 0.55m radius (cart + operator side-by-side)
- **Loiterer** peaks in late afternoon — the "detection-gap window"
- All counts are **zero** during 22:00–05:00 (typical retail closure)

### 3.3 Crowd Profile Structure

```typescript
{
  id: string;
  label: string;
  archetypes: AgentArchetype[];
  enabled: boolean;  // Toggle entire profile
}
```

Multiple profiles can coexist (e.g., "Weekday" vs "Weekend" crowd patterns).

---

## 4. Density Mapping

### 4.1 Zone-Based Density

Density is computed **per zone**, not per cell:

```
density[zone] = Σ (count_per_zone[archetype] / zone_area)
```

| Factor | Effect |
|--------|--------|
| More agents in zone | Higher density → higher occlusion |
| Smaller zone area | Same agents → higher density |
| Multiple preferred zones | Agents spread evenly across zones |
| No preferred zones | Agents distributed across ALL zones |

### 4.2 Ambient Density

Cells outside all critical zones receive ambient density:
```
ambient_density = mean_zone_density × 0.1
```

This models the reality that people don't vanish outside defined zones — they still partially block cameras in transition areas.

### 4.3 Density Visualization

The `CrowdOcclusionResult` includes:
```typescript
{
  agentDensityByZone: Record<string, number>;  // agents/m² per zone
  totalAgentCount: number;                      // sum across all archetypes
}
```

---

## 5. Chokepoint Detection

### 5.1 Definition

A **chokepoint** is a coverage cell where:
- The cell is geometrically covered (quality ≠ "none")
- Occlusion probability > **40%**

### 5.2 Detection Algorithm

```typescript
if (occlusionP > 0.4 && isCovered) {
  chokepoints.push({ x, z, occlusionProbability, qualityWithCrowd });
}
```

### 5.3 Output Structure

```typescript
type CrowdChokepointEntry = {
  x: number;                    // Cell X coordinate
  z: number;                    // Cell Z coordinate
  occlusionProbability: number; // 0–1, higher = worse
  qualityWithCrowd: string;     // Quality tier before crowd adjustment
};
```

### 5.4 Usage

- Top 10 chokepoints returned (sorted by severity)
- Displayed on coverage heatmap as red warning markers
- Used by temporal anomaly detection to identify time-slot transitions

---

## 6. Integration with Simulation Engine

### 6.1 Coverage Pipeline

```
geometric coverage → crowd occlusion → effective coverage
```

In `simulate-studio.ts`:
```typescript
const crowdOcclusion = (scene.crowdProfiles?.length ?? 0) > 0
  ? computeCrowdOcclusion(scene, coverageCells, scene.crowdProfiles, currentTime?.hour ?? 12)
  : null;
```

### 6.2 Temporal Integration

The crowd system feeds into the 24h temporal profile:

1. **Change timeline** identifies when crowd counts change
2. **Per-transition snapshots** include crowd-adjusted coverage
3. **Vulnerability windows** account for peak crowd density periods

### 6.3 Posture Score Impact

Crowd occlusion affects the **temporal resilience** component of the posture score (20% weight):

- Scenes with high peak crowd density → lower temporal resilience
- Consistent low crowd → higher temporal resilience

---

## 7. UI Components

### 7.1 CrowdProfileEditor (`CrowdProfileEditor.tsx`)

**Features:**
- Add/remove crowd profiles
- One-click "Retail Preset" loads `DEFAULT_RETAIL_ARCHETYPES`
- Per-archetype editing:
  - Label, body radius, height
  - **24-hour count scrubber** (click bar to edit)
  - Preferred zone picker (multi-select)

**Zone Picker:**
- "All zones" is default (empty array)
- Toggle individual zones
- Visual indicators for active zones

**Peak Hour Scrubber:**
- Bar chart showing 24-hour distribution
- Click any bar to set agent count
- Normalized to peak value

### 7.2 Integration with Schedule Editor

`CrowdProfileEditor` is embedded within `ScheduleEditor.tsx`:
```tsx
<ScheduleEditor>
  {/* Light schedules, guard patrols... */}
  <CrowdProfileEditor />
</ScheduleEditor>
```

---

## 8. Test Coverage

### 8.1 Test File: `crowd-sim.test.ts`

| Test | Coverage |
|------|----------|
| Zero penalty when no profiles enabled | ✓ |
| Zero penalty when profiles array empty | ✓ |
| Geometric coverage counts correctly | ✓ |
| Poisson model reduces effective coverage under high density | ✓ |
| Chokepoints only reported for >40% occlusion | ✓ |
| Output fields in valid ranges | ✓ |
| DEFAULT_RETAIL_ARCHETYPES have valid 24-element arrays | ✓ |
| DEFAULT_RETAIL_ARCHETYPES peak customers at midday | ✓ |

### 8.2 Edge Cases Tested

- Empty profiles array
- Disabled profiles
- Sparse crowd (1 agent in large zone)
- Dense crowd (100 agents in 400m² zone)
- Cells outside all zones (ambient density)

---

## 9. Performance Characteristics

| Metric | Value |
|--------|-------|
| Complexity | O(zones × cells) |
| Raycasting | None |
| Thread safety | Main thread safe |
| Typical runtime | <1ms for 100 cells, 5 zones |

The system is designed for **main-thread execution** — no Web Worker required.

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Poisson model** | Physically grounded; models random agent positions |
| **Zone-based density** | Simpler than cell-based; agents congregate in zones |
| **40% chokepoint threshold** | Empirically chosen; balances sensitivity vs noise |
| **10% ambient density** | Prevents zero occlusion in transition areas |
| **0.5 m² minimum zone area** | Prevents divide-by-zero on degenerate polygons |
| **Top 10 chokepoints** | UI limit; prevents information overload |
| **Body radius as parameter** | Different archetypes (carts vs people) have different cross-sections |

---

## 11. File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `packages/simulation/src/crowd-sim.ts` | 250 | Core algorithm |
| `packages/simulation/src/__tests__/crowd-sim.test.ts` | 140 | Unit tests |
| `packages/core/src/schema/security-scene.ts` | 1700+ | Schema definitions |
| `apps/studio/src/components/inspector/CrowdProfileEditor.tsx` | 200+ | UI editor |
| `apps/studio/src/components/inspector/ScheduleEditor.tsx` | 360+ | Parent editor |
| `apps/studio/src/store/slices/core/scene-slice.ts` | 1300+ | Store actions |
| `packages/simulation/src/simulate-studio.ts` | 700+ | Integration point |
| `packages/simulation/src/temporal.ts` | 660 | Temporal integration |

---

## 12. Limitations & Future Work

### Current Limitations

1. **Statistical, not spatial** — No individual agent trajectories
2. **Zone-averaged density** — Doesn't model clustering within zones
3. **Static body radius** — Doesn't account for agent orientation
4. **No agent-agent interaction** — Agents don't avoid each other

### Potential Enhancements

1. **Spatial agent placement** — Monte Carlo sampling within zones
2. **Dynamic density fields** — Heatmap-style density distribution
3. **Agent trajectories** — Path-based crowd flow simulation
4. **Camera-specific occlusion** — Per-camera occlusion computation
5. **Real-time crowd data** — Integration with occupancy sensors

---

*Document generated by Buffy (SentinelTwin AI agent)*
*Thread 147 — Crowd Occlusion & NPC Simulation*
