# Phase 7: Temporal Security Simulation

**Status:** Complete — 2026-05-30 ✅
**Depends on:** Phases 0–6 (complete)
**Opens:** 24-hour security posture awareness, vulnerability windows, time-scrubbing in 3D scene

---

## Goal

Build the temporal simulation layer that models how security posture changes over 24 hours.
Moving beyond the static day/night toggle to a full time-aware simulation that answers:
*"When is your site most vulnerable?"*

---

## Data Model Additions

### TimeSchedule (on SecurityScene)
```typescript
{
  location?: { latitude: number; longitude: number; timezone: string };
  interiorLightSchedule: LightSchedule[];   // lightId → on/off periods
  exteriorLightSchedule: LightSchedule[];
  occupancySchedule: OccupancyPeriod[];
  guardPatrolSchedule: PatrolSchedule[];
}
```

### TemporalSecurityProfile (output from simulation)
```typescript
{
  hourlySnapshots: HourlySecuritySnapshot[];
  peakVulnerabilityWindows: VulnerabilityWindow[];
  safestPeriods: TimePeriod[];
  criticalZoneCoverageByHour: Record<string, number[]>;
}
```

### VulnerabilityWindow
```typescript
{
  startHour: number; startMinute: number;
  endHour: number; endMinute: number;
  severity: "high" | "medium" | "low";
  reasons: string[];
  criticalZonesFailing: string[];
  adversarialRouteAvailable: boolean;
}
```

---

## Implementation Plan

| # | Item | Files |
|---|------|-------|
| 1 | Add temporal types to schema | `security-scene.ts` |
| 2 | Build temporal simulation engine | new `simulation/temporal.ts` |
| 3 | Create TemporalProfileView component | new `components/bottom-panel/TemporalProfileView.tsx` |
| 4 | Create VulnerabilityWindowCards component | new `components/bottom-panel/VulnerabilityWindowCards.tsx` |
| 5 | Wire into BottomPanel tabs + store | `BottomPanel.tsx`, `studio-store.ts` |
| 6 | Wire time-scrubbing into 3D scene (environment mode auto-switch) | `WorkspaceCanvas.tsx` |
| 7 | Validation: typecheck + ESLint + tests | — |
| 8 | Documentation: DECISION_LOG, exploration | — |

---

## Computation Strategy

Build a **change timeline** of state transitions across 24h, then only recompute coverage at transition points (typically 10–15 per day, not 96).

Transition types:
- Light on/off events
- Occupancy level changes
- Door lock/unlock events
- Guard patrol start/end

At each transition, run the full coverage simulation and record the result.
After all transitions, interpolate coverage for intermediate time steps.

Output: array of `HourlySecuritySnapshot[96]` (every 15min) + aggregated `VulnerabilityWindow[]`.
