# Coverage Entropy & Fragility — Implemented Metrics

**Thread:** Exploration Map Thread 7
**Status:** Implemented. Entropy wired into simulation pipeline. Fragility in production.
**Last updated:** 2026-06-30

---

## The Problem With "78% Coverage"

Standard coverage metrics tell you: "78% of the floor is covered at detection quality or better."

This hides a critical question: **how robust is that coverage?**

Two scenes can both show "78% coverage" but have very different security properties:

**Scene A (robust):**
- Camera 1 covers the entry at 450 PPM (identification threshold is 250 PPM)
- Camera 2 covers the counter at 380 PPM
- Most covered cells are well above their threshold
- Changing FOV ±5° or dimming lights 20% doesn't drop any critical zone below threshold

**Scene B (fragile):**
- Camera 1 covers the entry at 265 PPM (barely above identification threshold of 250)
- Camera 2 covers the counter at 135 PPM (just above recognition threshold of 125)
- A dirty lens, slight angle shift, or minor lighting change drops critical zones below threshold
- The "78%" is barely holding

Both show "78% covered." Only coverage entropy and fragility distinguish them.

---

## Implemented Metrics

### Coverage Fragility

For each grid cell, fragility measures how close the cell's PPM is to the nearest quality threshold boundary. A cell at the exact threshold has fragility 1.0 (maximally fragile). A cell at the midpoint between two thresholds has fragility near 0 (robust).

```typescript
// packages/simulation/src/coverage-fragility.ts
const FRAGILE_THRESHOLD = 0.2; // cells with fragility >= 0.2 are "fragile"

function computeFragilityWithOrder(ppm, quality, isOodpcvs): { fragility, ppmMargin } {
  // fragility = 1 - minDist / range
  // where minDist is distance to nearest threshold boundary
  // and range is the distance between current and next threshold
}
```

**Output:** `FragilitySummary` with `meanFragility`, `fragileCellCount`, `robustCellCount`, `totalCells`.

**Wired into:** `SimulationResult.fragilitySummary` via `simulate-studio.ts`.

**Heatmap mode:** `"fragility"` renders green-to-red gradient in the 3D viewport.

### Coverage Entropy

Shannon entropy over the coverage-cell quality distribution. Measures how concentrated or spread out the quality distribution is.

```typescript
// packages/simulation/src/coverage-entropy.ts
function computeCoverageEntropy(cells): CoverageEntropySummary | null {
  // Count cells per quality level
  // Compute H = -sum(p * log2(p))
  // Normalize by log2(number of observed levels)
}
```

**Output:** `CoverageEntropySummary` with `entropyBits`, `normalizedEntropy`, `dominantQuality`, `dominantQualityShare`, `qualityCounts`.

**Wired into:** `SimulationResult.coverageEntropy` via `simulate-studio.ts`.

### Coverage Uncertainty (Monte Carlo)

Monte Carlo simulation that perturbs camera parameters (position, yaw, pitch, range, FOV, resolution) with Gaussian noise and re-runs coverage to estimate confidence intervals.

```typescript
// packages/simulation/src/coverage-uncertainty.ts
function computeCoverageUncertainty(scene, options?): CoverageUncertaintySummary
```

**Output:** `CoverageUncertaintySummary` with `meanCoveragePct`, `p5CoveragePct`, `p95CoveragePct`, `zonePassRates`.

**Status:** Exported but not yet wired into the simulation pipeline. Available for standalone use.

### Coverage Posture Variation

Evaluates coverage at multiple target heights (crouching 0.7m, seated 1.0m, child 1.25m, standing 1.7m) to find posture-dependent blind spots.

```typescript
// packages/simulation/src/coverage-posture.ts
function computeCoveragePostureVariation(scene, options?): CoveragePostureVariationSummary
```

**Output:** Per-profile summaries, worst profile, largest drop delta.

**Status:** Exported but not yet wired into the simulation pipeline. Available for standalone use.

---

## Why It Matters for the Product

These metrics directly answer a question security professionals ask:
"Will this still work if conditions change slightly?" (camera ages, lens gets slightly dirty,
someone moves a small object, lighting changes seasonally)

They also make the counterfactual recommendations more nuanced:
- A move that increases coverage by 5% but improves fragility by 30 points is often better
  than a move that increases coverage by 8% but barely passes new zones.

---

## UI Considerations

**Risk of confusing users:** "Coverage 78%, Fragility 0.42" — what does 0.42 mean?
Security professionals might not intuitively understand fragility as a concept.

**Current UX:** Fragility is available as a heatmap overlay mode (green = robust, red = fragile).
Coverage entropy is included in report exports.

**Proposed UX:** Keep coverage % as the primary metric. Add fragility as a secondary badge:
```
Coverage: 78%  [Fragility: Low ⚠️]
```
Clicking "Low" expands an explanation: "23% of your covered area is near threshold. Small
changes to lighting or camera alignment could reduce actual coverage."

**Decision needed:** Surface fragility badge in V0.1 or V0.2? Show to target users first.
If a security professional finds it immediately valuable = V0.1.
If it requires explanation = V0.2 with tooltip.

---

## Connection to Other Features

**Temporal simulation:** Coverage fragility should factor into the temporal profile.
A space that is "covered" at 1 AM but only marginally is high-risk even though it "passes."

**Counterfactual ranking:** Rank candidate fixes not just by coverage improvement but by
fragility improvement. "This fix adds 5% coverage and brings the cash counter from fragile
to robust — far more valuable than a fix that adds 12% coverage of non-critical areas."

**Adversarial path:** The adversarial algorithm could use fragility-weighted detection
probability. A cell barely above detection threshold has low actual detection probability
in practice. This makes the adversarial path more realistic.

---

## Implementation Status

| Metric | Module | Wired into Pipeline | In Schema | In Reports | Heatmap |
|--------|--------|-------------------|-----------|------------|---------|
| Fragility | `coverage-fragility.ts` | Yes | Yes | Yes | Yes |
| Entropy | `coverage-entropy.ts` | Yes | Yes | Yes | No |
| Uncertainty | `coverage-uncertainty.ts` | No | No | No | No |
| Posture Variation | `coverage-posture.ts` | No | No | No | No |
