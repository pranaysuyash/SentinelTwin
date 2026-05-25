# Temporal Security Simulation

**Status:** Design — 2026-05-25
**Build phase:** V0.3 (after core coverage engine and adversarial path are working)

---

## The Problem With "Day / Night" Modes

Most security tools offer two lighting states: day and night.

Reality is more complex. A site's security posture varies continuously over 24 hours:

- Exterior natural lighting changes from sunrise through sunset
- Interior lighting follows business schedules (open hours, after-hours, cleaning crews)
- Access control changes (which doors are locked at which times)
- Occupancy varies (morning rush, quiet period, night cleaning)
- Guard patrol schedules create coverage windows and gaps
- Seasonal variation changes exterior lighting significantly

A static "night mode" misses all of this.

---

## What Temporal Simulation Answers

```
"When is your site most vulnerable?"
"Your peak-risk window is 1:45 AM – 3:15 AM when:
  - Exterior perimeter lights are on a timer that cuts out at 2 AM
  - Camera 3's IR range doesn't cover the loading bay gate
  - Guard patrol skips Bay 3 during the 2–4 AM window
  - The cleaning crew prop the service door open between 1:30 and 2:30 AM"
```

This is actionable intelligence that a static heatmap cannot produce.

---

## Data Model

### TimeSchedule

```typescript
type TimeSchedule = {
  // Lighting
  exteriorLightSchedule: LightSchedule[];
  interiorLightSchedule: LightSchedule[];

  // Access control
  doorLockSchedule: DoorSchedule[];
  gateLockSchedule: GateSchedule[];

  // Occupancy
  occupancySchedule: OccupancyPeriod[];

  // Guard patrols
  guardPatrolSchedule: PatrolSchedule[];

  // Season
  location?: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  month?: number;   // 1–12, for sunrise/sunset calculation
};

type LightSchedule = {
  lightId: string;
  periods: TimePeriod[];   // when this light is on
};

type TimePeriod = {
  startHour: number;   // 0–23
  endHour: number;     // 0–23
  daysOfWeek?: number[];  // 0=Sunday, 1=Monday...
};

type OccupancyPeriod = {
  level: "empty" | "low" | "medium" | "high";
  timeRange: TimePeriod;
  // High occupancy = people blocking camera views, more false-positive detection
  cameraObstructionMultiplier: number;  // 0 = no effect, 0.3 = 30% more occlusion
};

type PatrolSchedule = {
  guardId: string;
  patrolRouteId: string;
  intervalMinutes: number;     // how often they complete the route
  durationMinutes: number;     // how long each patrol takes
  firstPatrolHour: number;     // when first patrol starts
};
```

### TemporalSecurityProfile (Output)

```typescript
type TemporalSecurityProfile = {
  hoursAnalyzed: number;           // 24
  resolutionMinutes: number;       // time steps (default: 15min)

  hourlySnapshots: HourlySecuritySnapshot[];

  // Aggregated findings
  peakVulnerabilityWindows: VulnerabilityWindow[];
  safestPeriods: TimePeriod[];
  criticalZoneCoverageByHour: Record<string, number[]>;  // zoneId → coverage % per hour
};

type HourlySecuritySnapshot = {
  hour: number;                     // 0–23
  minute: number;                   // 0, 15, 30, 45
  overallCoveragePct: number;
  criticalZonePassCount: number;
  criticalZoneTotalCount: number;
  activeCameraCount: number;
  activeLightCount: number;
  adversarialPathExposureScore: number;  // if adversarial sim is enabled
  issues: string[];
};

type VulnerabilityWindow = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  severity: "high" | "medium" | "low";
  reasons: string[];
  criticalZonesFailing: string[];
  adversarialRouteAvailable: boolean;
};
```

---

## Computation Strategy

### Naive: Simulate Every Time Step

For each 15-minute step across 24 hours (96 steps):
1. Apply lighting state for that time step
2. Apply access control state
3. Apply occupancy model
4. Recompute coverage
5. Optionally run adversarial path sim

96 × coverage computation = potentially slow.

**Optimization: only recompute on state changes.**

Build a change timeline first:
```
00:00  Interior lights off, exterior lights on timer
06:00  Interior lights on (business hours start)
08:00  Occupancy: medium (staff arrive)
12:00  Occupancy: high (peak)
17:00  Occupancy: medium (closing)
18:00  Occupancy: low (cleaning crew)
19:00  Service door propped open (cleaning routine)
20:30  Service door closed
22:00  Interior lights off
23:00  Cleaning crew leaves, occupancy: empty
02:00  Exterior perimeter lights on timer cut out
06:00  ... repeat
```

Only recompute coverage when state actually changes — typically 10–15 transitions per day.
This makes temporal sim feasible even without a Web Worker.

---

## UI

### Temporal Profile View

A 24-hour timeline bar at the bottom of the screen.

```
00:00        06:00        12:00        18:00        24:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
████████░░░░░░░░████████████████████████░░░░░███████████
  LOW       OK       GOOD        GOOD    CRIT   LOW
```

Color coding:
- Green: good coverage across all critical zones
- Yellow: some zones marginal
- Orange: critical zone failing
- Red: multiple critical zones failing + adversarial route available

Clicking a time period jumps the 3D scene to that state: lights change, coverage heatmap
updates, adversarial path shows for that time.

### Vulnerability Window Cards

```
⚠️ HIGH RISK: 2:00 AM – 4:00 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exterior perimeter lights cut out at 2:00 AM
Camera 3 IR range does not cover Loading Bay Gate
Guard patrol skips Bay 3 during this window
Cleaning crew service door: open 1:30–2:30 AM

Critical zones failing: Loading Bay Gate, Side Entrance
Adversarial route available: Front Entry → Storage Room
Exposure score: 8.2 / 10 (critical)

Fixes:
→ Add IR flood light at Loading Bay Gate ($0 if existing)
→ Adjust guard patrol to include Bay 3
→ Install door sensor on service door
```

---

## Seasonal Lighting (Advanced)

For sites with location data, compute real sunrise/sunset times using the sun position formula.

```typescript
function getSunriseSunsetHours(
  latitude: number,
  longitude: number,
  month: number,
  day: number,
): { sunrise: number; sunset: number } {
  // Use NOAA solar calculation or a lightweight sun-position library
  // Returns hours in local time
}
```

This makes the temporal simulation location-aware: a warehouse in Bengaluru has different
exterior lighting windows than one in Stockholm in January.

---

## Connection to Guard Patrol Scheduling

Guard patrols intersect with the temporal sim in an interesting way.

A guard patrolling creates a moving "coverage bump" — areas the guard can see are temporarily
covered at recognition/identification quality (human visual acuity >> camera).

The adversarial path simulation can factor guard positions:

```typescript
type PatrolPosition = {
  guardId: string;
  position: [number, number];
  timeS: number;
  visibilityRadiusM: number;
  qualityAtRadius: DORIQuality;
};
```

The adversarial actor must time their movement to avoid guard intersections.

This creates a genuinely interesting simulation: the optimal evasion route changes depending
on the guard's position. "The window of opportunity is between patrol passes — approximately
8 minutes when the guard is in the back corridor."

---

## Build Priority

Temporal simulation is a V0.3 feature. Do not block V0.1 on it.

V0.1 should have simple day/night toggle with flat penalty application.
V0.2 should add basic schedule input (interior lights on/off times, guard patrol interval).
V0.3 should add full 24h temporal profile with vulnerability windows and charts.
