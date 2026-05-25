# Demo Script — SentinelTwin V0.1

**Purpose:** The canonical story of what the product shows, in what order, and why.
This script defines what "done" looks like for the V0.1 build. Agents building features
should use this to understand how their piece fits into the end-to-end flow.

**Scene:** Small Retail Shop (small_retail_shop.json)

---

## The Story

A shop owner has two cameras installed. They believe their shop is covered.
SentinelTwin shows them what their cameras actually see — and what a motivated actor
would actually do given that coverage. Then it shows them exactly what to change.

This is not a hypothetical. It is the daily reality in thousands of small shops.

---

## Step 1: Load the scene

User opens SentinelTwin. The small retail shop scene loads.

They see:
- A 10m × 7m floor plan rendered in 3D
- Two cameras visible as mounted cones
- Shelves and a cupboard blocking part of the floor
- A cash counter near the back

What the UI shows:
- Coverage heatmap on the floor (green = high quality, red = blind)
- Two obvious blind zones: behind Shelf 1, and between the cupboard and the counter
- Metrics panel: "Total coverage: 71% | Blind zones: 29% | Critical zones passing: 1/2"

Narration:
> "This shop looks covered. Two cameras, both running."

---

## Step 2: Switch to Camera 1 view

User clicks "Camera 1" in the camera wall panel.

They see:
- Camera 1's perspective — entry door visible, but counter is partially blocked
- A "recognition quality" indicator showing the zone near the counter as observation-only
- The cupboard edge cuts across the bottom-right of the frame

Narration:
> "Camera 1 sees the entry. But the cash counter? Observation quality only.
> Not enough to identify someone on this footage."

---

## Step 3: Run threat analysis

User clicks "Run Threat Analysis." Entry point: Front Door. Target: Cash Counter Zone.

They see:
- A glowing orange path appearing on the floor
- The path moves from the front door → behind Shelf 1 → along the west wall →
  crouches near the cupboard → reaches the cash counter
- The path is almost entirely in blind zones
- Metrics: "Exposure score: 2.8 (HIGH RISK) | Route found in 0.3s |
  Time under detection: 2.1s | Time undetected: 11.4s"

Narration:
> "This is the path. 11 seconds to reach the counter. Barely visible the entire way."

---

## Step 4: Toggle to night mode

User clicks "Night Mode."

Coverage heatmap shifts. Green zones turn orange and red.

Metrics update:
- "Total coverage: 51% | Critical zones passing: 0/2"
- Cash Counter Zone: "Fails — observation only at night, IR range insufficient"

Threat path recomputes. The exposure score drops further — the path is even safer at night.

Narration:
> "At night, even that 29% coverage gap gets worse. Camera 2's IR doesn't reach the counter."

---

## Step 5: Ask what can be changed

User types in the AI command box:
> "Camera 1 cannot be moved. What is the cheapest fix?"

AI agent responds with three candidate changes ranked by cost:
1. Move Shelf 1 east by 1.2m — removes the main blind zone
2. Rotate Camera 2 left by 20° — improves counter coverage
3. Add one ceiling light above the counter — restores night coverage

User selects: Apply all three.

---

## Step 6: See the before/after

Scene updates. Heatmap recomputes.

Before/after comparison appears:
```
                    Before    After
Total coverage:      71%      89%
Blind zones:         29%      11%
Critical zones:      1/2      2/2
Cash counter:    Observation  Recognition
Night coverage:       51%      78%
Exposure score:       2.8      8.7
```

Threat path recomputes. The new path now crosses recognition-quality zones.
Panel shows: "High-risk route blocked. No viable low-exposure path to Cash Counter."

Narration:
> "Three changes. No new cameras. The coverage failure is closed."

---

## Step 7: Generate report

User clicks "Generate Report."

Report-lite panel shows:
```
SentinelTwin Security Audit
Small Retail Shop — 2026-05-25

Summary
Coverage improved from 71% to 89% with three low-cost changes.
Critical zones now fully covered day and night.
No viable low-exposure threat route remains to Cash Counter Zone.

Changes Applied
1. Shelf 1 moved 1.2m east — eliminates blind zone near counter
2. Camera 2 rotated 20° left — adds recognition coverage at counter
3. Light added above counter — restores night visibility

Assumptions
Camera height: 2.8m | Person height: 1.7m | Wall height: 3.0m
Night mode: IR active | Camera clarity: Good
All values are estimated planning indicators under stated assumptions.
Verify against actual installation before relying on this report.

Standards
Coverage quality per IEC 62676-4:2025 (simplified DORI model).
```

---

## The Closing Line

> "SentinelTwin found the gap before the incident did."

---

## What This Script Tests

Every step maps to a buildable component:

| Step | Component needed |
|---|---|
| 1 | SecurityScene load, R3F render, coverage heatmap, metrics panel |
| 2 | Secondary canvas camera view, quality overlay |
| 3 | Adversarial path (Dijkstra), path visualization, exposure metrics |
| 4 | Night mode toggle, lighting penalty model, heatmap update |
| 5 | AI command box, counterfactual agent, scene patch apply |
| 6 | Before/after snapshot comparison, delta metrics panel |
| 7 | Report-lite generator, assumptions display |

This is the V0.1 acceptance test. When all 7 steps work end-to-end on the small retail shop
scene, V0.1 is complete.
