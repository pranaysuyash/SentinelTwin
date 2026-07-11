# Temporal Simulation System — Deep Dive

**Date:** 2026-07-11  
**Thread:** 162  
**Status:** Documentation complete

---

## Executive Summary

SentinelTwin's temporal simulation engine computes a **24-hour security profile** by building a change timeline of state transitions (lighting, occupancy, door state, guard patrol) and running the coverage simulation **only at transition points** — not every 15-minute step. This yields 10–15 coverage computations per day instead of 96, while still producing a full 96-snapshot timeline via state-label interpolation.

**Core insight:** Security posture is not constant. A camera that provides identification-quality coverage at noon may only provide detection-quality at 3 AM when exterior lights are on a timer cutout and interior lights are off.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEMPORAL SIMULATION ENGINE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Time        │  │   Seasonal   │  │   Guard      │             │
│  │   Schedule    │  │   Lighting   │  │   Patrol     │             │
│  │              │  │   (SunCalc)  │  │   Deterrence │             │
│  │  interior    │  │              │  │              │             │
│  │  exterior    │  │  sunrise/    │  │  35% per     │             │
│  │  occupancy   │  │  sunset      │  │  active guard│             │
│  │  door lock   │  │  twilight    │  │              │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Change Timeline Builder                         │   │
│  │                                                             │   │
│  │  collectScheduleTransitionHours() → sorted transition list  │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Time Slice State Computation                    │   │
│  │                                                             │   │
│  │  computeTimeSliceState(hour, minute, scene) → TimeSliceState│   │
│  │  patchSceneForTimeSlice(scene, state) → patched scene       │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Coverage Simulation (per transition)            │   │
│  │                                                             │   │
│  │  simulateStudio(patchedScene) → SimulationResult            │   │
│  │  + guard patrol deterrence adjustment                       │   │
│  │  + crowd occlusion adjustment                               │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Post-Processing                                 │   │
│  │                                                             │   │
│  │  1. Fill 15-min gaps via state-label interpolation          │   │
│  │  2. detectVulnerabilityWindows()                            │   │
│  │  3. findSafestPeriods()                                     │   │
│  │  4. detectTemporalAnomalies()                               │   │
│  │  5. build criticalZoneCoverageByHour                        │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                             ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              TemporalSecurityProfile                         │   │
│  │                                                             │   │
│  │  96 hourlySnapshots · vulnerabilityWindows · safestPeriods  │   │
│  │  anomalyWindows · anomalySummary · criticalZoneCoverageByHour│  │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Algorithm: Change Timeline Optimization

### The Problem

A naive approach would run coverage simulation at every 15-minute interval across 24 hours = 96 simulations. For a complex scene with BVH-accelerated raycasting, each simulation might take 50–200ms, totaling 5–20 seconds.

### The Solution

Most security-relevant state changes happen at **schedule boundaries** — when lights turn on/off, occupancy shifts, doors lock, or guards begin/end patrol. Between transitions, the security posture is constant.

```typescript
// From temporal.ts
function buildChangeTimeline(scene: SecurityScene): StateTransition[] {
  const hours = collectScheduleTransitionHours(scene);
  return hours.map((h) => ({ hour: h, minute: 0, label: `Transition ${h}:00` }));
}

function collectScheduleTransitionHours(scene: SecurityScene): number[] {
  const hours = new Set<number>();
  
  // 1. Interior light schedule boundaries
  for (const ls of ts.interiorLightSchedule) {
    addScheduleHours(ls.periods);
  }
  
  // 2. Exterior light schedule boundaries
  for (const ls of ts.exteriorLightSchedule) {
    addScheduleHours(ls.periods);
  }
  
  // 3. Occupancy schedule boundaries
  for (const op of ts.occupancySchedule) {
    hours.add(op.timeRange.startHour);
    hours.add(op.timeRange.endHour);
  }
  
  // 4. Guard patrol round start/end hours
  for (const patrol of ts.guardPatrolSchedule) {
    for (let start = firstStart; start < firstStart + dayMinutes; start += patrol.intervalMinutes) {
      hours.add(Math.floor((start % dayMinutes) / 60));
      hours.add(Math.floor(((start + patrol.durationMinutes) % dayMinutes) / 60));
    }
  }
  
  // 5. Event phase boundaries
  for (const phase of ec.phases) {
    hours.add(phase.startHour);
    hours.add(phase.endHour);
  }
  
  // 6. Default schedule boundaries (always present)
  for (const entry of DEFAULT_SCHEDULES.interiorLights) hours.add(entry.hour);
  for (const entry of DEFAULT_SCHEDULES.exteriorLights) hours.add(entry.hour);
  for (const entry of DEFAULT_SCHEDULES.occupancy) hours.add(entry.hour);
  
  hours.add(0); // Always include midnight
  return Array.from(hours).sort((a, b) => a - b);
}
```

### Typical Result

For a scene with default schedules + 1 guard patrol: **10–15 transitions** instead of 96 simulations.

### Interpolation

After computing snapshots at transition points, the engine fills the 15-minute gaps using **state-label interpolation**:

```typescript
// Build lookup: stateLabel → nearest computed snapshot
const snapshotByLabel = new Map<string, HourlySecuritySnapshot>();
for (const snap of hourlySnapshots) {
  if (!snapshotByLabel.has(snap.stateLabel)) {
    snapshotByLabel.set(snap.stateLabel, snap);
  }
}

// Fill gaps
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += resolutionMinutes) {
    if (transitionKeys.has(`${h}:${m}`)) continue; // Already computed
    
    const state = computeTimeSliceState(h, m, scene);
    const nearestSnapshot = snapshotByLabel.get(state.stateLabel);
    if (nearestSnapshot) {
      hourlySnapshots.push({ ...nearestSnapshot, hour: h, minute: m });
    }
  }
}
```

---

## Default Schedules

When no `timeSchedule` is configured, the engine uses built-in defaults:

### Interior Lights

| Hour | State | Label |
|------|-------|-------|
| 06:00–18:00 | ON | Business Hours |
| 18:00–22:00 | OFF | After Hours |
| 22:00–24:00 | ON | Cleaning |
| 00:00–06:00 | OFF | After Hours |

### Exterior Lights

| Hour | State | Label |
|------|-------|-------|
| 06:00–19:00 | OFF | Daylight |
| 19:00–02:00 | ON | Night |
| 02:00–05:00 | OFF | Timer Cutout |
| 05:00–06:00 | ON | Pre-Dawn |

**Key design choice:** Exterior lights have a **timer cutout** from 02:00–05:00. This creates a predictable vulnerability window in deep night — a realistic scenario where energy-saving timers disable security lighting.

### Occupancy

| Hour | Level | Label |
|------|-------|-------|
| 00:00–07:00 | empty | After Hours |
| 07:00–10:00 | medium | Staff Arrival |
| 10:00–15:00 | high | Peak Hours |
| 15:00–18:00 | medium | Afternoon |
| 18:00–22:00 | low | Closing |
| 22:00–24:00 | empty | After Hours |

### Day/Night Boundary

```typescript
function isNight(hour: number): SimState {
  return hour < 6 || hour >= 19 ? "night" : "day";
}
```

---

## Seasonal Lighting (SunCalc Integration)

**File:** `packages/simulation/src/seasonal-lighting.ts`

When `timeSchedule.location` (latitude/longitude) is configured, the engine uses **SunCalc** for astronomical twilight calculations instead of fixed hour boundaries.

### Twilight Phases

| Phase | Sun Altitude | Exterior Light | Label |
|-------|-------------|----------------|-------|
| Day | ≥ 0° | OFF | Daylight |
| Civil Twilight | -6° to 0° | ON | Civil Twilight |
| Nautical Twilight | -12° to -6° | ON | Nautical Twilight |
| Astronomical Twilight | -18° to -12° | ON | Astronomical Twilight |
| Night | < -18° | ON | Night |

### Lux Estimation

```typescript
export function estimateExteriorLux(hour, minute, schedule): number {
  const alt = seasonal.sunPosition.altitude;
  if (alt > 15) return 50000;  // Full sun
  if (alt > 5)  return 10000;  // Bright overcast
  if (alt > 0)  return 1000;   // Sunrise/sunset
  if (alt > -6) return 100;    // Civil twilight
  if (alt > -12) return 10;    // Nautical twilight
  if (alt > -18) return 1;     // Astronomical twilight
  return 0;                     // Deep night
}
```

### Resolution Priority

```typescript
// From temporal.ts — computeTimeSliceState()
const exterior = ts && hasLocation
  ? getExteriorLightStateSeasonal(hour, minute, ts)           // 1. SunCalc (if location set)
  : useScene && ts
    ? getExteriorLightStateFromSchedule(hour, minute, ts)     // 2. User schedule
    : getExteriorLightStateDefault(hour, minute);              // 3. Built-in defaults
```

---

## Guard Patrol Deterrence

### Patrol Schedule Schema

```typescript
interface PatrolSchedule {
  guardId: string;           // "guard_1"
  patrolRouteId: string;     // "route_entrance"
  intervalMinutes: number;   // 60 (patrol every hour)
  durationMinutes: number;   // 15 (each patrol takes 15 min)
  firstPatrolHour: number;   // 22 (first patrol starts at 10 PM)
}
```

### Active Guard Detection

```typescript
function getActiveGuardCount(hour, minute, scene): number {
  const patrols = scene?.timeSchedule?.guardPatrolSchedule;
  if (!patrols || patrols.length === 0) return 0;
  
  const currentMinutes = hour * 60 + minute;
  let count = 0;
  
  for (const patrol of patrols) {
    // Walk through every round in the 24h window
    for (let roundStart = firstStartMinutes; roundStart < firstStart + dayMinutes; roundStart += patrol.intervalMinutes) {
      const roundStartWrapped = roundStart % dayMinutes;
      const roundEnd = roundStartWrapped + patrol.durationMinutes;
      
      if (currentMinutes >= roundStartWrapped && currentMinutes < roundEnd) {
        count++;
        break; // This guard is active
      }
    }
  }
  
  return count;
}
```

### Deterrence Effect

Each active guard **reduces adversarial exposure by 35%**:

```typescript
// From computeTemporalProfile()
const rawExposure = result.adversarialPath?.totalExposureScore ?? 0;
const adjustedExposure = state.guardPatrolActive
  ? rawExposure * Math.max(0, 1 - 0.35 * state.activeGuardCount)
  : rawExposure;
```

**Example:** 2 guards on patrol → exposure reduced by `1 - 0.35 * 2 = 0.30` (70% of original).

### State Label

Guard patrol status is reflected in the state label:

```typescript
stateLabel: guardPatrolActive 
  ? `${baseLabel} (guard patrol)` 
  : baseLabel
```

This label is used for interpolation — all 15-minute snapshots within the same patrol window share the same coverage values.

---

## Vulnerability Detection

### Thresholds

```typescript
const COVERAGE_SAFETY_THRESHOLD = 60;      // Below = vulnerable
const ADVERSARIAL_EXPOSURE_WARNING = 5;    // Above = low-detection route exists
```

### Detection Algorithm

```typescript
function detectVulnerabilityWindows(snapshots): VulnerabilityWindow[] {
  let currentWindow = null;
  
  for (const snap of snapshots) {
    const isVulnerable = 
      snap.criticalZonePassCount < snap.criticalZoneTotalCount ||
      snap.overallCoveragePct < COVERAGE_SAFETY_THRESHOLD;
    
    if (isVulnerable && !currentWindow) {
      // Start new vulnerability window
      currentWindow = { startHour, startMinute, reasons, zonesFailing, adversarialAvailable };
    } else if (isVulnerable && currentWindow) {
      // Extend current window
      currentWindow.reasons.add(...snap.issues);
      currentWindow.zonesFailing.add(...failingZones);
    } else if (!isVulnerable && currentWindow) {
      // Close window with severity classification
      const severity = 
        currentWindow.reasons.size >= 3 || currentWindow.adversarialAvailable
          ? "high"
          : currentWindow.reasons.size >= 2
            ? "medium"
            : "low";
      
      windows.push({ ...currentWindow, severity, endHour: snap.hour });
      currentWindow = null;
    }
  }
  
  return windows;
}
```

### Severity Classification

| Severity | Condition |
|----------|-----------|
| **High** | ≥3 distinct reasons OR adversarial route available |
| **Medium** | 2 distinct reasons |
| **Low** | 1 reason (single zone failure or coverage drop) |

### VulnerabilityWindow Structure

```typescript
interface VulnerabilityWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  severity: "high" | "medium" | "low";
  reasons: string[];                    // Up to 5 issue descriptions
  criticalZonesFailing: string[];       // Zone labels that are not "pass"
  adversarialRouteAvailable: boolean;   // Exposure score > 5
}
```

---

## Temporal Anomaly Detection

**File:** `packages/simulation/src/temporal-anomaly.ts`

Detects **sudden changes** between consecutive snapshots — not just low coverage, but coverage that *dropped significantly* from the previous state.

### Detection Thresholds

```typescript
const ANOMALY_MIN_COVERAGE_DROP = 8;      // ≥8% drop = anomaly
const ANOMALY_MEDIUM_COVERAGE_DROP = 12;  // ≥12% = medium severity
const ANOMALY_HIGH_COVERAGE_DROP = 20;    // ≥20% = high severity
const ANOMALY_MIN_EXPOSURE_JUMP = 2.5;    // Exposure increase = anomaly
const ANOMALY_HIGH_EXPOSURE_JUMP = 5;     // Large exposure jump = high
```

### Anomaly Types

| Type | Trigger |
|------|---------|
| `coverage_drop` | Coverage decreased by ≥8% |
| `zone_flip` | Critical zone went from pass → fail |
| `adversarial_spike` | Exposure score increased by ≥2.5 |
| `mixed` | Multiple triggers simultaneously |

### Window Merging

Contiguous anomaly windows of the same severity and type are merged:

```typescript
function mergeWindows(windows): TemporalAnomalyWindow[] {
  const merged = [windows[0]];
  for (let i = 1; i < windows.length; i++) {
    const current = windows[i];
    const last = merged[merged.length - 1];
    
    const contiguous = last.endHour === current.startHour && last.endMinute === current.startMinute;
    const sameKind = last.severity === current.severity && last.anomalyType === current.anomalyType;
    
    if (contiguous && sameKind) {
      // Merge: extend time range, sum deltas, union affected zones
      last.endHour = current.endHour;
      last.coverageDeltaPct += current.coverageDeltaPct;
      last.affectedZones.push(...current.affectedZones.filter(z => !last.affectedZones.includes(z)));
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}
```

### AnomalySummary

```typescript
interface TemporalAnomalySummary {
  totalAnomalies: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  worstCoverageDropPct: number;    // Most negative delta
  worstExposureJump: number;       // Largest positive delta
}
```

---

## Crowd Occlusion Integration

### Event Phase Crowd Scaling

When an `eventConfig` is active, crowd profiles are scaled by phase occupancy:

```typescript
const OCCUPANCY_CROWD_SCALE = {
  empty: 0,
  low: 0.15,
  medium: 0.5,
  high: 0.8,
  peak: 1.0,
};

// In patchSceneForTimeSlice()
const activePhase = getActiveEventPhase(scene, state.hour);
if (activePhase && scene.eventConfig?.expectedPeakAttendance) {
  const scale = OCCUPANCY_CROWD_SCALE[activePhase.expectedOccupancy];
  const peakCount = scene.eventConfig.expectedPeakAttendance;
  
  patched.crowdProfiles = patched.crowdProfiles.map(profile => ({
    ...profile,
    archetypes: profile.archetypes.map(arch => ({
      ...arch,
      countByHour: arch.countByHour.map((count, h) => {
        if (h >= activePhase.startHour && h < activePhase.endHour) {
          return Math.round(peakCount * scale / archetypes.length);
        }
        return count;
      }),
    })),
  }));
}
```

### Effective Coverage

When crowd profiles are active, the temporal profile uses **crowd-adjusted effective coverage** instead of geometric coverage:

```typescript
const effectiveCoverage = result.crowdOcclusion
  ? result.crowdOcclusion.effectiveCoveragePct
  : result.totalCoveragePct;
```

---

## Posture Score Integration

The temporal profile feeds into the overall **Posture Score** (0–850 scale):

```typescript
function computeTemporalResilience(temporalProfile): number {
  if (!temporalProfile) return 0.5;
  
  const snapshots = temporalProfile.hourlySnapshots;
  const vulnerabilityWindows = temporalProfile.peakVulnerabilityWindows;
  
  const highSeverityCount = vulnerabilityWindows.filter(w => w.severity === "high").length;
  const mediumSeverityCount = vulnerabilityWindows.filter(w => w.severity === "medium").length;
  
  const avgCoverage = snapshots.reduce((sum, s) => sum + s.overallCoveragePct, 0) / snapshots.length;
  const coverageFactor = clamp01(avgCoverage / 100);
  
  const windowPenalty = clamp01(highSeverityCount * 0.15 + mediumSeverityCount * 0.05);
  
  return clamp01(coverageFactor * 0.7 + (1 - windowPenalty) * 0.3);
}
```

**Temporal Resilience** contributes 20% to the overall posture score.

---

## TimeSchedule Schema

```typescript
interface TimeSchedule {
  location?: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  seasonalDate?: string;                    // ISO date for SunCalc
  interiorLightSchedule: LightSchedule[];   // Per-light on/off periods
  exteriorLightSchedule: LightSchedule[];   // Per-light on/off periods
  doorLockSchedule: Array<{
    doorId: string;
    periods: TimePeriod[];
  }>;
  occupancySchedule: OccupancyPeriod[];     // Level + time range
  guardPatrolSchedule: PatrolSchedule[];    // Guard patrol rounds
}

interface LightSchedule {
  lightId: string;
  periods: TimePeriod[];
}

interface OccupancyPeriod {
  level: "empty" | "low" | "medium" | "high";
  timeRange: TimePeriod;
  cameraObstructionMultiplier: number;      // 0–1, crowd occlusion factor
}

interface TimePeriod {
  startHour: number;    // 0–23
  endHour: number;      // 0–24 (24 = midnight next day)
  daysOfWeek?: number[]; // 0=Sun, 6=Sat
}
```

---

## HourlySecuritySnapshot Structure

```typescript
interface HourlySecuritySnapshot {
  hour: number;
  minute: number;
  overallCoveragePct: number;
  geometricCoveragePct?: number;     // Before crowd adjustment
  crowdAgentCount?: number;          // Active crowd agents
  criticalZonePassCount: number;
  criticalZoneTotalCount: number;
  criticalZoneStatuses: Record<string, "pass" | "fail" | "partial">;
  activeCameraCount: number;
  activeLightCount: number;
  adversarialPathExposureScore: number;
  issues: string[];
  stateLabel: string;
}
```

---

## TemporalSecurityProfile Output

```typescript
interface TemporalSecurityProfile {
  hoursAnalyzed: 24;
  resolutionMinutes: 15;
  hourlySnapshots: HourlySecuritySnapshot[];        // 96 snapshots
  peakVulnerabilityWindows: VulnerabilityWindow[];  // Low-coverage periods
  safestPeriods: TimePeriod[];                      // High-coverage periods
  criticalZoneCoverageByHour: Record<string, number[]>; // Per-zone coverage timeline
  anomalyWindows: TemporalAnomalyWindow[];          // Sudden-change detections
  anomalySummary: TemporalAnomalySummary;
  computedAt: number;
}
```

---

## UI Integration

### TemporalProfileView (`TemporalProfileView.tsx`)

- **Coverage Timeline Bar:** 24-hour color-coded bar showing coverage at each 15-min slot
- **State Transition Map:** Shows lighting/occupancy/guard state at each hour
- **Vulnerability Cards:** Lists upcoming vulnerability windows with severity badges
- **Anomaly Cards:** Lists detected anomalies with affected zones
- **Temporal Scrubber:** Interactive hour/minute selector for time-of-day simulation

### Simulation Worker

The temporal profile is computed in a **Web Worker** to avoid blocking the main thread:

```typescript
// simulation.worker.ts
const { id, scene, includeTemporalProfile, currentTime } = event.data;
const result = simulateStudio(scene, currentTime);
const temporalProfile = includeTemporalProfile 
  ? computeTemporalProfileForResult(scene, result) 
  : null;
postMessage({ id, ok: true, result, temporalProfile });
```

---

## File Inventory

| File | Lines | Purpose |
|------|-------|---------|
| `packages/simulation/src/temporal.ts` | 660 | Core temporal engine, change timeline, state computation |
| `packages/simulation/src/temporal-anomaly.ts` | 150 | Anomaly detection between consecutive snapshots |
| `packages/simulation/src/seasonal-lighting.ts` | 180 | SunCalc integration for astronomical twilight |
| `packages/simulation/src/posture-score.ts` | 170 | Temporal resilience factor in posture scoring |
| `packages/simulation/src/crowd-sim.ts` | 250 | Crowd occlusion computation per time slot |
| `packages/core/src/schema/security-scene.ts` | 1,700+ | TimeSchedule, HourlySecuritySnapshot, VulnerabilityWindow schemas |
| `apps/studio/src/components/bottom-panel/TemporalProfileView.tsx` | 650+ | Temporal profile UI with timeline, anomalies, vulnerability cards |
| `apps/studio/src/components/inspector/ScheduleEditor.tsx` | 360+ | Schedule editing UI (lights, occupancy, patrols, doors) |
| `apps/studio/src/components/inspector/CrowdProfileEditor.tsx` | 200+ | Crowd profile editing with 24h count arrays |
| `apps/studio/src/workers/simulation.worker.ts` | 40 | Web Worker for async temporal computation |
| `packages/simulation/src/__tests__/temporal.test.ts` | 400+ | Unit tests for temporal engine |
| `packages/simulation/src/__tests__/seasonal-lighting.test.ts` | 220+ | Unit tests for SunCalc integration |

---

## Gaps & Future Work

| Gap | Impact | Priority |
|-----|--------|----------|
| No weekly schedule variation | Same profile every day of week | Medium |
| No weather-aware lighting | Clouds affect exterior light levels | Low |
| No seasonal sunrise/sunset drift | Uses fixed date, not actual calendar | Low |
| No multi-floor temporal profiles | Each level has same lighting schedule | Medium |
| No guard route visualization on temporal timeline | Can't see where guards are at each hour | Low |
| No crowd density heatmaps per time slot | Only aggregate agent counts | Low |
| No adaptive patrol scheduling | Patrols are fixed interval, not risk-adaptive | Medium |

---

## Related Exploration Threads

- Thread 157: Coverage Engine (simulation runs at each transition point)
- Thread 160: Rendering Pipeline (PathReplayView uses temporal data)
- Thread 156: Feature Deep Dives (adversarial path exposure at each hour)
