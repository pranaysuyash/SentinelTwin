# Temporal Security Profile — Deep Dive (2026-07-11)

**Thread 54 — Temporal Security Profile Algorithm & Integration**

---

## 1. Overview

The Temporal Security Profile runs a full 24-hour simulation at 15-minute resolution,
producing a security posture curve that shows how coverage, vulnerability, and risk
change across the day. No other physical security tool does this.

**Core insight:** Security posture is not static. A scene that is 90% covered at noon
may drop to 45% at night when exterior lights shut off, doors lock, and guard patrols
end. The temporal profile makes this visible.

---

## 2. Algorithm Architecture

### 2.1 Change-Timeline Optimization (NOT brute-force 96 steps)

**File:** `packages/simulation/src/temporal.ts`

The engine does NOT run 96 separate coverage simulations (24h × 4/hour). Instead:

1. **Collect transition hours** from all schedules (interior lights, exterior lights,
   occupancy, door locks, guard patrols, event phases, and built-in defaults).
2. **Build a change timeline** — typically 10–15 transitions per day.
3. **Run coverage simulation only at transition points** — `simulateStudio()` is called
   once per transition, not per 15-minute slot.
4. **Fill intermediate slots by state-label lookup** — non-transition slots inherit
   the nearest transition's results via a `Map<string, HourlySecuritySnapshot>`.

**Performance:** 10–15 coverage computations instead of 96. ~6–8× faster than brute-force.

### 2.2 Time-Slice State Resolution

Each time slot resolves a composite state:

```typescript
type TimeSliceState = {
  hour: number;
  minute: number;
  timeOfDay: "day" | "night";        // Binary: hour < 6 || >= 19 → night
  interiorLightsOn: boolean;          // Business hours (6–18), cleaning (22–24)
  exteriorLightsOn: boolean;          // Night (19–2), timer cutout (2–5), pre-dawn (5–6)
  occupancy: "empty" | "low" | "medium" | "high";
  stateLabel: string;                 // Composite label for state matching
  doorStates?: Record<string, "closed" | "locked">;
  guardPatrolActive: boolean;
  activeGuardCount: number;
};
```

**Schedule resolution order:**
1. `scene.timeSchedule` — user-configured per-light, per-occupancy, per-door schedules
2. `DEFAULT_SCHEDULES` — built-in demo schedule for scenes without `timeSchedule`

### 2.3 Scene Patching for Each Time Slice

`patchSceneForTimeSlice()` clones the scene and applies time-specific mutations:

- Sets `assumptions.timeOfDay` (day/night)
- Sets `assumptions.interiorLightLevel` (dark/dim/normal/bright) based on occupancy
- Toggles security light `status` (on/off) based on interior/exterior light state
- Locks doors per door lock schedule
- Scales crowd profiles per event phase expected occupancy

The patched scene is then passed to `simulateStudio()` which runs the full coverage
engine (raycasting, DORI quality, adversarial path) against the time-specific state.

---

## 3. Lighting Schedules

### 3.1 Interior Lights

**Default schedule:**
| Time | State | Label |
|------|-------|-------|
| 06:00–18:00 | ON | Business Hours |
| 18:00–22:00 | OFF | After Hours |
| 22:00–24:00 | ON | Cleaning |
| 00:00–06:00 | OFF | After Hours |

**Effect on coverage:** Interior lights affect the `interiorLightLevel` assumption,
which modulates the coverage engine's lighting penalty calculation. Dark interiors
increase night penalty for cameras without IR/thermal capabilities.

### 3.2 Exterior Lights

**Default schedule:**
| Time | State | Label |
|------|-------|-------|
| 06:00–19:00 | OFF | Daylight |
| 19:00–02:00 | ON | Night |
| 02:00–05:00 | OFF | Timer Cutout |
| 05:00–06:00 | ON | Pre-Dawn |

**Key design decision:** The 02:00–05:00 timer cutout models real-world energy
management where exterior lights shut off during deep night. This creates a
**vulnerability window** — the darkest period of the day.

**Seasonal integration:** When `timeSchedule.location` has latitude/longitude,
the engine uses `computeSeasonalLightState()` from `seasonal-lighting.ts` to
override the default exterior light state with actual sun position data.

### 3.3 Light → Coverage Engine Integration

In `coverage.ts`, `getLightingContext()` resolves per-cell illumination:

1. **Base light level** from `timeOfDay` assumption (day=1, night=0)
2. **Seasonal modulation** when location-aware schedule is available
3. **Security light contributions** — each active light adds illumination based on:
   - Brightness weight (dim=0.25, low=0.42, medium=0.62, high=0.82, very_high=1.0)
   - Distance falloff (linear, with sqrt beam correction)
   - Material transmission (glass=0.8, solid=0)
   - Cone coverage (directional lights)
   - Occlusion (shadowed by obstructions)
4. **Night penalty** — PPM degradation in low-light conditions:
   - lightLevel ≥ 0.65 → 10% penalty
   - lightLevel ≥ 0.35 → 24% penalty
   - lightLevel ≥ 0.12 → 42% penalty
   - Below 0.12 → camera night mode retention factor (thermal=8%, IR=22–68%, none=12%)

---

## 4. Guard Patrol Deterrence

### 4.1 Patrol Schedule Model

```typescript
{
  guardId: string;
  firstPatrolHour: number;      // When first patrol round starts
  intervalMinutes: number;      // Time between patrol rounds
  durationMinutes: number;      // How long each patrol lasts
}
```

**Active guard detection:** `getActiveGuardCount()` walks every round in the 24h
window, checking if the current time falls within any round's
`[roundStart, roundStart + duration)` window.

### 4.2 Deterrence Effect

Each active guard reduces adversarial path exposure by **35%**:

```typescript
const adjustedExposure = state.guardPatrolActive
  ? rawExposure * Math.max(0, 1 - 0.35 * state.activeGuardCount)
  : rawExposure;
```

**2 guards → 30% exposure** (1 - 0.35×2 = 0.30). **3+ guards → 0% exposure** (clamped).

This models the psychological deterrence effect: visible guard presence makes
adversarial routes riskier, reducing the computed exposure score.

### 4.3 Integration with Anomaly Detection

Guard patrol transitions are added to the change timeline, creating separate
snapshots at patrol start/end times. The anomaly detector can then identify
"guard leaves patrol" as a vulnerability trigger.

---

## 5. Peak Vulnerability Detection

### 5.1 Vulnerability Window Algorithm

`detectVulnerabilityWindows()` scans sorted snapshots for contiguous periods
where:

- **Critical zone pass count** < total zones (some zones failing), OR
- **Overall coverage** < 60% (IEC 62676-4 threshold)

**Severity classification:**
| Condition | Severity |
|-----------|----------|
| 3+ reasons OR adversarial route available | HIGH |
| 2+ reasons | MEDIUM |
| 1 reason | LOW |

### 5.2 Safest Period Detection

`findSafestPeriods()` identifies contiguous periods where:
- All critical zones pass, AND
- Overall coverage ≥ 80%

These are the "safe windows" — times when security posture is strongest.

### 5.3 Temporal Anomaly Detection

`detectTemporalAnomalies()` (in `temporal-anomaly.ts`) compares consecutive
snapshots for sudden changes:

**Anomaly types:**
| Type | Trigger |
|------|---------|
| `coverage_drop` | Coverage drops ≥ 8% between snapshots |
| `zone_flip` | Critical zone pass count decreases |
| `adversarial_spike` | Exposure score jumps ≥ 2.5 |
| `mixed` | Multiple triggers simultaneously |

**Severity:**
| Condition | Severity |
|-----------|----------|
| Coverage drop ≥ 20% OR zone flip ≥ 2 OR exposure jump ≥ 5 | HIGH |
| Coverage drop ≥ 12% OR any zone flip OR exposure jump ≥ 2.5 | MEDIUM |
| Coverage drop ≥ 8% | LOW |

**Window merging:** Contiguous anomalies of the same severity/type are merged
into single windows with cumulative deltas.

---

## 6. UI Integration

### 6.1 TemporalProfileView Component

**File:** `apps/studio/src/components/bottom-panel/TemporalProfileView.tsx`

- Renders in the bottom panel (tab: "Temporal Profile")
- Shows 24h timeline chart with coverage curve
- Highlights vulnerability windows (red) and safe periods (green)
- Shows per-zone coverage breakdown
- Displays anomaly markers with severity badges
- "Run Temporal Analysis" button triggers computation

### 6.2 Worker Integration

**File:** `apps/studio/src/workers/simulation.worker.ts`

Temporal profile computation runs in a Web Worker to avoid blocking the R3F canvas:

```typescript
const temporalProfile = includeTemporalProfile
  ? computeTemporalProfileForResult(scene, result)
  : null;
```

The worker sends incremental progress messages (`{ type: "progress", fraction }`)
back to the main thread during the async coverage computation.

### 6.3 Store Integration

**File:** `apps/studio/src/store/slices/core/simulation-slice.ts`

- `setTemporalProfile(profile)` — stores computed profile
- `computeTemporalProfile()` — triggers computation from current scene
- Profile is automatically computed after coverage simulation when
  `includeTemporalProfile: true`

---

## 7. Test Coverage

**File:** `packages/simulation/src/__tests__/temporal.test.ts`

| Test Area | Coverage |
|-----------|----------|
| Time-slice state resolution | 13 tests (midnight, noon, dawn, dusk, lighting, occupancy) |
| Temporal profile structure | 11 tests (snapshot count, sorting, ranges, zones) |
| Door lock schedule | 4 tests (lock/unlock timing, schedule detection) |
| Guard patrol deterrence | Covered via temporal profile tests |
| Vulnerability window detection | Covered via snapshot structure tests |

**Key assertions:**
- ~96 snapshots for 24h at 15-min resolution
- Night snapshots have lower/equal coverage than day
- Coverage values in [0, 100]
- Vulnerability windows have valid severity and zone lists

---

## 8. Known Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No seasonal lighting integration in temporal profile | Exterior light state ignores sun position | Medium |
| No crowd profile scaling in temporal profile | Occupancy effects not modeled | Medium |
| No guard patrol visualization in timeline | Users can't see when guards are active | Low |
| No "what-if" temporal comparison | Can't compare before/after temporal profiles | Medium |
| No export of temporal data to report | Reports don't include 24h security curve | High |
| No real-time clock mode | Can't sync simulation to actual wall clock | Low |

---

## 9. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Temporal Profile                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐    ┌──────────────────────┐       │
│  │  Schedule     │───▶│  Change Timeline      │       │
│  │  Collection   │    │  (10-15 transitions)  │       │
│  └──────────────┘    └──────────┬───────────┘       │
│                                  │                    │
│                                  ▼                    │
│  ┌──────────────┐    ┌──────────────────────┐       │
│  │  Scene Patch  │◀──│  For Each Transition   │       │
│  │  (clone+mutate)│   │  (day/night, lights,  │       │
│  └──────┬───────┘    │   doors, guards)      │       │
│         │             └──────────────────────┘       │
│         ▼                                            │
│  ┌──────────────┐    ┌──────────────────────┐       │
│  │  Coverage     │───▶│  Hourly Snapshot      │       │
│  │  Simulation   │    │  (coverage, zones,    │       │
│  │  (raycasting) │    │   exposure, issues)   │       │
│  └──────────────┘    └──────────┬───────────┘       │
│                                  │                    │
│         ┌────────────────────────┼───────────┐       │
│         ▼                        ▼           ▼       │
│  ┌──────────────┐    ┌──────────────┐ ┌──────────┐ │
│  │  Vulnerability│    │  Safest       │ │ Anomaly  │ │
│  │  Windows      │    │  Periods      │ │ Detection│ │
│  └──────────────┘    └──────────────┘ └──────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 10. Key Files Reference

| File | Purpose |
|------|---------|
| `packages/simulation/src/temporal.ts` | Core algorithm — change timeline, scene patching, profile computation |
| `packages/simulation/src/temporal-anomaly.ts` | Anomaly detection — snapshot comparison, window merging |
| `packages/simulation/src/coverage.ts` | Coverage engine — lighting context, night penalty, seasonal integration |
| `packages/simulation/src/seasonal-lighting.ts` | Sun position → exterior light state |
| `apps/studio/src/components/bottom-panel/TemporalProfileView.tsx` | UI — 24h timeline chart, vulnerability markers |
| `apps/studio/src/workers/simulation.worker.ts` | Web Worker — off-main-thread computation |
| `apps/studio/src/store/slices/core/simulation-slice.ts` | Zustand store — profile state management |
| `packages/simulation/src/__tests__/temporal.test.ts` | Test suite — 28+ tests |
| `Docs/architecture/06_TEMPORAL_SIMULATION.md` | Architecture documentation |
