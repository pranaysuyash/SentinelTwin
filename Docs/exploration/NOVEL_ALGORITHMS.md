# Novel Algorithms and Original Ideas — SentinelTwin

**Status:** Partially implemented — append as ideas develop
**Updated:** 2026-05-28
**Purpose:** Document SentinelTwin's own original algorithmic and product ideas.
Not references to other tools. Our work.

---

## Principle

The coverage heatmap exists elsewhere. The adversarial path simulation is new. What else
can we invent? This file captures algorithmic ideas that don't exist in any current
security planning tool, would be worth building regardless of external references, and
extend the simulation's analytical power in ways no competitor has done.

Every idea here starts from the geometry we already have. None requires external AI calls
to compute — all are deterministic, geometric, and testable.

---

## Algorithm 1: Coverage Fragility Field

**Status:** Implemented in V0.1.4 studio simulation, live panel, and report handoff.

**What it is:**
The current heatmap shows what DORI quality each cell achieves. But it doesn't show
how stable that quality is. A cell at 126 PPM (barely recognition) is functionally
identical to a cell at 249 PPM (barely below identification) on the current heatmap —
both show as "recognition." But one camera becoming dirty drops the first cell to
observation, while the second cell survives.

Fragility = how close each cell is to the nearest DORI threshold boundary.

**Algorithm:**
For each cell with computed PPM:
```
lower_threshold = threshold for current quality level
upper_threshold = threshold for next quality level
fragility = 1 - min(ppm - lower_threshold, upper_threshold - ppm) / (upper_threshold - lower_threshold)
```
Result: 0 = robust (far from any threshold), 1 = fragile (right on a threshold boundary).

**Visualization:**
A separate "Fragility Mode" heatmap. Green = robust coverage. Red/amber = one small change
will degrade this zone below its required quality. Makes the brittleness of a setup visible.

**Why it matters:**
A zone that "passes" recognition quality at 126 PPM will fail with a dirty lens, a slight
camera shake, or a moved obstruction. The client shouldn't be told "this zone passes" without
knowing whether it passes robustly or barely.

**Related:** Coverage entropy metric (EXPLORATION_MAP Thread 8). This is a more specific and
implementable version of that idea.

---

## Algorithm 1.5: Coverage Entropy

**Status:** Implemented in the live Novel Algorithms panel and report handoff.

**What it is:**
Coverage entropy measures how concentrated the scene's quality distribution is across
all sampled cells. A low value means the scene is dominated by one or two bands
(for example, mostly blind or mostly recognition), while a higher value means the
quality landscape is more mixed.

**Algorithm:**
1. Count how many cells fall into each DORI / OODPCVS quality band.
2. Compute Shannon entropy over the observed distribution.
3. Normalize the entropy by the maximum possible entropy for the observed bands.
4. Report the dominant band and its share so the score is interpretable.

**Why this matters:**
Entropy is a compact way to describe whether the scene is concentrated, uniform, or
mixed. It complements the existing average-quality metrics by showing how varied the
coverage landscape is, without replacing the actual zone pass/fail results.

**Current implementation:**
The live Novel Algorithms panel and report handoff now show the normalized entropy,
raw entropy bits, dominant quality band, and the current quality distribution.

---

## Algorithm 2: Blind Spot Topology Analysis

**Status:** Implemented in V0.1.4 studio simulation and report surfaces.

**What it is:**
Currently we report blindspot % — "22% of the floor is blind." But this hides the critical
question: are those blind spots scattered isolated islands, or are they a connected corridor
from entry to critical zone?

A 4% blind corridor from the front door to the cash counter is infinitely more dangerous
than a 30% scattered blind area in the storage room corner.

**Algorithm:**
1. Run flood-fill on blind cells (quality == "none") to find connected blind regions.
2. For each connected region:
   - Compute area (m²)
   - Check: does it touch any entry point? (entry reachability)
   - Check: does it touch or contain any critical zone? (target reachability)
   - Compute: is there a connected path through blind cells from entry to critical zone?
3. Classify each region:
   - "Entry-to-Target corridor" — CRITICAL: path exists from entry through blind to target
   - "Entry-connected" — HIGH: blind zone reachable from entry, no coverage until deep in
   - "Isolated" — MEDIUM: blind zone not reachable from entry without crossing covered area
   - "Dead end" — LOW: small isolated blind spot in non-critical area

**Output:**
```
Blind Spot Analysis
━━━━━━━━━━━━━━━━━━━
Connected regions: 3
CRITICAL: 1 corridor from Front Entry → Cash Counter (4.2m², 6.8m traversal)
HIGH: 1 blind zone east of Shelf 2 accessible from entry (2.1m²)
LOW: 2 isolated blind spots in storage corner (0.8m² each)
```

**Why this matters:**
Changes the report from "22% blind" to "there is one critical blind corridor that connects
your main entry directly to your highest-risk zone without any detection-quality coverage."
That is a finding that motivates action.

---

## Algorithm 3: Camera Placement Oracle (Marginal Coverage Map)

**Status:** Implemented in V0.1.4 studio simulation and novel panel.

**What it is:**
Given the current camera setup, where should the NEXT camera go to maximize coverage
improvement? Instead of a planner guessing, SentinelTwin computes a placement heatmap
on all mountable surfaces (walls at standard heights, ceiling) showing the marginal
coverage gain from each possible position.

**Algorithm:**
```
for each candidate position P on wall/ceiling grid (0.5m resolution):
  compute_coverage(current_scene + hypothetical_camera_at_P)
  marginal_gain[P] = new_coverage - current_coverage
  weighted_gain[P] = sum over critical zones of: zone_improvement * zone_priority
```

Display as a heatmap projected onto wall and ceiling surfaces in the 3D view.
The brightest spots are the most valuable camera locations.

**Optimization:**
Per candidate position, don't recompute the full coverage grid — compute only the delta:
which currently-uncovered cells fall within the new camera's FOV and have line of sight?

**Output:**
The Oracle heatmap highlights the top 3–5 candidate positions with their expected delta:
```
Recommended Placement: Ceiling at [4.8, 2.9, 3.2]
Expected improvement: +18% coverage, Cash Counter → Recognition (from Observation)
Cost: ceiling mount only, no rewiring needed
```

**Why this matters:**
Converts "where should I put another camera?" from a guessing exercise into a
computed, verifiable recommendation. First tool that answers this question geometrically.

---

## Algorithm 4: Adversarial K-Robustness

**Status:** Implemented in V0.1.4 studio simulation and report surfaces.
**Builds on:** Existing adversarial path (adversarial-path.ts).

**What it is:**
Our existing adversarial path shows the minimum-exposure route given the current camera
configuration. But it doesn't answer: how many cameras can fail simultaneously before
an undetected route opens?

K-Robustness: the minimum number of cameras that, if simultaneously offline, enables
a viable adversarial route below a detection threshold.

**Algorithm:**
```
for K = 1 to N_cameras:
  for each subset S of cameras with |S| = K:
    disable cameras in S
    run adversarial path
    if route found with exposure_score < threshold:
      return K, S as the critical failure set
```

Brute force is O(2^N) for N cameras. But for typical scenes (2–6 cameras), this is
fast enough. For larger scenes, use greedy: start with the camera that, when offline,
most improves the adversarial route, and repeat.

**Output:**
```
K-Robustness Analysis
━━━━━━━━━━━━━━━━━━━━━
Current setup K-robustness: K=1
Any single camera failure opens a viable route.

Critical failure: Camera 1 offline
Route: Front Entry → Shelf 1 blindspot → Cash Counter
Exposure score: 1.8 (very low)

Fix: Adding one camera at position [4.8, 2.9, 3.2] raises K-robustness to K=2.
No single camera failure enables a viable route.
```

**Why this matters:**
Changes the security conversation from "we have 2 cameras" to "this setup survives
any single camera failure, but not two." That's a meaningful engineering specification.

---

## Algorithm 5: Coverage Time Budget

**Status:** Implemented in the live Novel Algorithms panel and simulation helper.

**What it is:**
Current path replay answers: "how long is the subject visible at each quality level?"
The Coverage Time Budget inverts this: "at what speed must an actor move to stay below
a given detection quality for the duration of the path?"

**Algorithm:**
For a given path:
```
For each path segment (between two waypoints):
  compute quality at midpoint
  compute length of segment
  if quality >= target_threshold:
    maximum_safe_speed = +infinity (they can't avoid being visible here)
  else:
    maximum_safe_speed[segment] = segment_length / minimum_time_window_above_threshold
```

Also computes: "minimum dwell time before becoming visible" — if someone stands at
position P, how long before they are captured at recognition quality by any camera?

**Output:**
```
Coverage Time Budget — Cash Counter Approach Path
Target: stay below observation quality
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Segment 0–3.2m: undetected. No minimum speed required.
Segment 3.2–6.1m: must cross in < 2.4s (≥ 1.25 m/s run pace) to avoid observation.
Segment 6.1–end: observation quality unavoidable. Cannot be faster than identification.
```

**Why this matters:**
Changes the defender's mental model from "is this area covered?" to "how many seconds
does a determined actor have to act in each zone?" Has direct applications in guard
patrol design (Q-019 multi-sensor direction).

**Current implementation:**
The live Novel Algorithms tab now computes a thresholded path time budget from the
active authored path, highlights visible bands, and flags when the current path speed
misses the selected exposure budget.

---

## Algorithm 6: Occlusion Blame Attribution

**Status:** Implemented in V0.1.4 studio simulation and report surfaces.

**What it is:**
When a critical zone fails its required quality, the system currently shows the failure.
But why? Which specific obstruction is responsible for how much of the failure?

**Algorithm:**
For each critical zone that fails:
```
baseline_quality = zone_result.actualQuality
for each obstruction O in scene:
  temporarily remove O
  recompute zone quality
  quality_with_O_removed = new zone quality
  blame[O] = quality_improvement from removing O
  normalize: blame_fraction[O] = blame[O] / sum(all blame)
```

**Output:**
```
Cash Counter coverage failure — Occlusion Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cupboard Blocker: 67% responsible — removing this alone raises to Recognition quality
Shelf 1 (east): 18% responsible — minor contributor
Back Wall obstruction: 15% responsible — low priority

Priority fix: Move Cupboard Blocker → Cash Counter passes (verified)
```

This is the "why failed" explainer from spec section 23.5. Now with a precise algorithm.

**Implementation:**
Run the coverage engine N+1 times (baseline + once per obstruction).
For a typical scene with 3–8 obstructions, this is fast.

---

## Algorithm 7: Monte Carlo Coverage Uncertainty

**Status:** Implemented in the live Novel Algorithms panel and report handoff.

**What it is:**
The simulation uses fixed parameters. But real installations have uncertainty:
- Camera mounting position: ±5–10cm
- Camera yaw after installation: ±3–5°
- Camera pitch and range tolerance
- Camera specifications from manufacturer: real-world performance varies

Monte Carlo: run N simulations (N=100–500) with parameters sampled from Gaussian
distributions around the nominal values. Report the distribution of outcomes.

**Algorithm:**
```
for i in range(N):
  perturbed_scene = add_gaussian_noise(scene, uncertainty_params)
  result_i = compute_coverage(perturbed_scene)
  samples.append(result_i)

report:
  mean_coverage = mean(samples.total_coverage_pct)
  p5_coverage = percentile(5, samples)
  p95_coverage = percentile(95, samples)
  for each critical zone:
    pass_rate[zone] = fraction of samples where zone passes
```

**Output:**
```
Coverage with Installation Uncertainty
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Assumptions: ±5cm position uncertainty, ±4° angle uncertainty
Simulations: 200

Mean coverage: 78% (95% CI: 71%–84%)
Cash Counter: passes recognition in 82% of simulations
Worst case (p5): 71% coverage, Cash Counter fails in some cases

Recommendation: rotate Camera 2 left 8° to center the cash counter in
the FOV — reduces sensitivity to installation angle variation.
```

**Why this matters:**
Makes the product honest about what it's computing. A 78% coverage estimate is a
model under assumptions. This shows users when coverage is genuinely robust vs when
a small installation error changes the outcome. Critical for the evidence/compliance
use case (Thread 24).

**Current implementation:**
The live panel and report handoff now sample perturbed camera installs, summarize the
mean and 95% band, and show the most fragile zone pass rates as a practical preview
of installation sensitivity.

---

## Algorithm 8: Coverage Under Posture Variation

**Status:** Implemented in the live Novel Algorithms panel and report handoff.

**What it is:**
Current simulation uses a fixed 1.7m target height. But real people are:
- Standing (1.7m)
- Crouching / crawling (0.5–0.9m)
- Seated (1.0–1.2m — especially behind counters)
- Child (1.0–1.3m)
- Tall (1.9–2.0m)
- In vehicle (varies)

For a cash counter zone, the transaction happens at counter height (0.8–1.0m for the
upper body while seated). A camera aimed at 1.7m standing height may miss seated activity.

**Algorithm:**
Parameterize existing coverage engine with `targetHeightM` (currently hardcoded to 1.2m
in the raycast end point). Run at multiple heights and show the delta.

**Current implementation:**
The live panel and report handoff now compare crouching, seated, child, and standing
target heights and surface the worst posture, biggest standing-to-posture coverage drop,
and the weakest zone for each posture profile.

**Output:**
```
Coverage by Posture
━━━━━━━━━━━━━━━━━━━
Standing (1.7m): Cash Counter — Recognition ✓
Seated (0.9m): Cash Counter — Observation ✗ (below requirement)
Crouching (0.6m): Cash Counter — Detection ✗

Camera 1 is aimed for standing targets. Seated activity at the counter is
not at recognition quality under current camera angle.
```

**Implementation:**
Simple: parameterize the raycast target y-coordinate. The rest of the engine is unchanged.
Cost: ~3× more raycasts. Negligible for 40×40 grid.

---

## Algorithm 9: Blind Spot Fingerprinting

**Status:** Implemented in the live Novel Algorithms panel and report handoff; dataset clustering remains future work.

**What it is:**
Every camera configuration produces a unique "blind spot signature" — the spatial
distribution of uncovered and degraded areas. As we build a dataset of SecurityScenes,
we can cluster scenes by blind spot signature similarity.

This enables:
- "Your setup has the same coverage failure pattern as these 12 other similar setups"
- "The most common fix for this failure pattern is: move the counter-angle camera"
- Pattern-based recommendations from a library of verified fixes

This requires the camera dataset (CAMERA_DATASET.md) and multiple SecurityScene instances.
The deterministic fingerprint/symmetry step is now live; the dataset clustering layer
remains a future extension.

**Related:** Camera dataset (CAMERA_DATASET.md exploration).

---

## Algorithm 10: Reflective Bounce Vision

**Status:** Implemented in the live novelty panel and report handoff.

**What it is:**
Glass walls, polished floors, and reflective surfaces create secondary virtual cameras.
A camera viewing a glass door at the right angle partially sees the reflection of the
space outside the door's direct view cone. This is physically real and exploited in
real security design (placing a mirror at a blind corner).

**Algorithm:**
For each material with visionTransmission < 1.0 AND glareRisk:
- Compute the reflected camera position/direction using the mirror plane equation
- Weight the reflected camera's coverage by the surface's reflectivity coefficient
- Add reflected cells to coverage (at reduced quality due to reflection loss)

Also computable: "convex mirror effect" for curved reflective surfaces (warehouse dome mirrors).

**Why this matters:**
Currently: reflective material = glare penalty (reduces quality).
Extended: reflective material = glare penalty + potential bonus indirect coverage.
This models how security professionals actually use mirrors and reflective surfaces.

**Status:** Implemented as a deterministic first-pass mirror proxy that uses the
reflective window plane, visibility checks, and an ignored-surface bounce pass.
Future work can refine the reflection coefficient model and angle-of-incidence
math, but the live panel and report now already expose the effect.

---

## Summary Table

| Algorithm | Novelty | Complexity | Value | Status |
|---|---|---|---|---|
| Coverage Fragility Field | High | Medium | High | Unexplored |
| Coverage Entropy | Medium | Low | Medium | Implemented in live panel and report handoff |
| Blind Spot Topology | Very High | Medium | Very High | Unexplored |
| Placement Oracle | High | Medium | High | Implemented in live panel and report handoff |
| Adversarial K-Robustness | Very High | Medium | High | Partially designed |
| Coverage Time Budget | High | Low | High | Implemented in live panel |
| Monte Carlo Coverage Uncertainty | High | Medium | High | Implemented in live panel |
| Occlusion Blame Attribution | High | Low | Very High | Unexplored |
| Coverage Under Posture Variation | Medium | Low | Medium | Implemented in live panel |
| Blind Spot Fingerprinting | High | High | Medium | Implemented in live panel and report handoff |
| Reflective Bounce Vision | Very High | High | Medium | Implemented in live panel and report handoff |

**Build priority for maximum differentiation:**
1. Occlusion Blame Attribution (low effort, high user value, directly answers "why failed")
2. Blind Spot Topology (medium effort, changes the quality of security insight completely)
3. Adversarial K-Robustness (builds on existing adversarial path, very novel output)
4. Coverage Fragility Field (makes the heatmap honest, directly supports evidence twin framing)
5. Placement Oracle (AI-assistable, answers the most common planner question)

---

## Connection to Generative 3D References

**Trellis.2 (Microsoft, May 2026):** Generative 3D object prior.
Used by GenRecon for scene-level reconstruction. Independently usable for:
- Given a SAM-masked image of an obstruction → generate a 3D block model of it
- Improves the "scan → obstruction node" pipeline in V0.4

**Pixal3D (concurrent work, May 2026):** Similar conditioning approach to GenRecon for
3D generation. Watch for code/model release. Could offer an alternative to Trellis.2.

Neither of these affects the simulation algorithms above. They affect the capture pipeline
(how scenes enter SentinelTwin), not the security analysis (what we do once they're in).
Both live in CAPTURE_PIPELINE_AND_GENRECON.md. Simulation algorithms are ours independently.
