# Coverage Entropy — Novel Metric Concept

**Thread:** Exploration Map Thread 7
**Status:** Concept. Not yet in formal design. Decision needed before V0.2.
**Last updated:** 2026-05-25

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

Both show "78% covered." Only coverage entropy distinguishes them.

---

## The Metric

### Coverage Margin

For each grid cell covered at quality level Q, compute the margin above the threshold for Q:

```typescript
function computeCellMargin(ppm: number): {
  quality: DORIQuality;
  margin: number;         // 0–1: 0 = barely passing, 1 = much higher than threshold
  fragile: boolean;       // margin < 0.2 = fragile
} {
  const thresholds = {
    identification: 250,
    recognition: 125,
    observation: 62.5,
    detection: 25,
  };

  let quality: DORIQuality = "none";
  let threshold = 0;

  if (ppm >= thresholds.identification) { quality = "identification"; threshold = thresholds.identification; }
  else if (ppm >= thresholds.recognition) { quality = "recognition"; threshold = thresholds.recognition; }
  else if (ppm >= thresholds.observation) { quality = "observation"; threshold = thresholds.observation; }
  else if (ppm >= thresholds.detection) { quality = "detection"; threshold = thresholds.detection; }

  if (quality === "none") return { quality: "none", margin: 0, fragile: false };

  // Margin relative to next threshold up
  const nextThreshold = threshold * 2; // roughly: each DORI level doubles PPM
  const margin = Math.min(1, (ppm - threshold) / (nextThreshold - threshold));

  return { quality, margin, fragile: margin < 0.2 };
}
```

### Coverage Robustness Score

```typescript
function computeCoverageRobustness(grid: GridCell[][]): {
  score: number;          // 0–100
  fragileCellPct: number; // % of covered cells that are "barely passing"
  robustCellPct: number;  // % of covered cells with margin > 0.5
  weakestZone?: string;   // critical zone with lowest average margin
} {
  const coveredCells = grid.flat().filter(c => c.finalQuality !== "none");
  if (coveredCells.length === 0) return { score: 0, fragileCellPct: 0, robustCellPct: 0 };

  const margins = coveredCells.map(cell => computeCellMargin(cell.effectivePPM).margin);
  const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
  const fragileCells = margins.filter(m => m < 0.2).length;
  const robustCells = margins.filter(m => m > 0.5).length;

  return {
    score: Math.round(avgMargin * 100),
    fragileCellPct: fragileCells / coveredCells.length,
    robustCellPct: robustCells / coveredCells.length,
  };
}
```

### Simple Output

```
Coverage: 78%   Robustness: 42/100

Fragile zones: 23% of covered area is near-threshold
→ Cash Counter: barely passing recognition (margin: 12%)
→ Entry Corridor: identification quality fragile (margin: 8%)

Robust zones: 34% of covered area has strong margin
→ Main Entry: identification quality robust (margin: 71%)
→ Back Storage: detection quality robust (margin: 88%)
```

---

## Why It Matters for the Product

Coverage entropy / robustness score directly answers a question security professionals ask:
"Will this still work if conditions change slightly?" (camera ages, lens gets slightly dirty,
someone moves a small object, lighting changes seasonally)

It also makes the counterfactual recommendations more nuanced:
- A move that increases coverage by 5% but improves robustness by 30 points is often better
  than a move that increases coverage by 8% but barely passes new zones.

---

## UI Considerations

**Risk of confusing users:** "Coverage 78%, Robustness 42" — what does 42 mean?
Security professionals might not intuitively understand entropy/robustness as a concept.

**Proposed UX:** Keep coverage % as the primary metric. Add robustness as a secondary badge:
```
Coverage: 78%  [Robustness: Low ⚠️]
```
Clicking "Low" expands an explanation: "23% of your covered area is near threshold. Small
changes to lighting or camera alignment could reduce actual coverage."

**Decision needed:** Surface in V0.1 or V0.2? Show to target users first.
If a security professional finds it immediately valuable = V0.1.
If it requires explanation = V0.2 with tooltip.

---

## Connection to Other Features

**Temporal simulation:** Coverage robustness should factor into the temporal profile.
A space that is "covered" at 1 AM but only marginally is high-risk even though it "passes."

**Counterfactual ranking:** Rank candidate fixes not just by coverage improvement but by
robustness improvement. "This fix adds 5% coverage and brings the cash counter from fragile
to robust — far more valuable than a fix that adds 12% coverage of non-critical areas."

**Adversarial path:** The adversarial algorithm could use robustness-weighted detection
probability. A cell barely above detection threshold has low actual detection probability
in practice. This makes the adversarial path more realistic.
