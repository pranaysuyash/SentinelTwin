# Scene Understanding Bakeoff — Comparison Report
**Generated:** 2026-05-29

## Summary

| Model | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | P50 Lat (ms) | Score* |
|---|---|---|---|---|---|---|---|
| **GPT-4o** (prompt v2) | **0.964** | **0.400** | **0.700** | **0.417** | **0.200** | 5,058 | **2.681** |
| **GPT-5.4 Nano** | 0.931 | 0.400 | 0.100 | 0.178 | 0.200 | **4,853** | 1.809 |

\*Score = wall + door + window + obs F1 + CZ recall (simple unweighted).

## Key Takeaways

1. **GPT-4o is the clear winner** for structural element extraction (2.68 vs 1.81 composite)
2. **GPT-5.4 Nano is faster** (4.9s vs 5.1s median) but trades accuracy for speed — windows and obstructions suffer
3. **Door detection is equal** — both get 2/5 correct. The 3 failures are genuine model errors (wrong wall or wrong position)
4. **Critical zone detection is still weak** for both — only 1/5 matched. The prompt addition helped (was 0/5) but more work needed
5. **Smart matcher fixed the coordinate convention gap** — Wall F1 went from 0.436 to 0.964 (GPT-4o) after switching from endpoint-distance to collinearity+overlap matching

## Detailed Per-Image

### GPT-4o
| Image | Walls | Doors | Windows | Obs | CZ | Notes |
|---|---|---|---|---|---|---|
| retail_01_small_shop | 4/4 ✓ | 0/1 ✗ | 1/1 ✓ | 2/3 ✓ | 0/1 ✗ | Door on wrong wall |
| retail_02_grocery | 4/4 ✓ | 1/1 ✓ | 1/1 ✓ | 3/5 ✓ | 0/1 ✗ | CZ just outside centroid threshold |
| retail_03_pharmacy | 5/6 ✓ | 0/1 ✗ | 1/1 ✓ | 2/3 ✓ | 1/1 ✓ | Perfect CZ |
| warehouse_01_racking | 4/4 ✓ | 1/1 ✓ | — | 6/9 ✓ | — | No CZ in GT |
| corridor_01_lobby | 5/6 ✓ | 0/1 ✗ | 2/2 ✓ | 0/4 ✗ | 0/1 ✗ | Obs completely missed |

### GPT-5.4 Nano
| Image | Walls | Doors | Windows | Obs | CZ | Notes |
|---|---|---|---|---|---|---|
| retail_01_small_shop | 4/4 ✓ | 0/1 ✗ | 0/1 ✗ | 0/3 ✗ | 0/1 ✗ | Barely detected anything |
| retail_02_grocery | 4/4 ✓ | 1/1 ✓ | 0/1 ✗ | 4/5 ✓ | 0/1 ✗ | CZ just outside threshold |
| retail_03_pharmacy | 7/6 ✗ | 0/1 ✗ | 1/1 ✓ | 0/3 ✗ | 1/1 ✓ | Over-detected walls |
| warehouse_01_racking | 4/4 ✓ | 1/1 ✓ | — | 0/9 ✗ | — | Missed all obs |
| corridor_01_lobby | 7/6 ✗ | 0/1 ✗ | 3/2 ✗ | 0/4 ✗ | 0/1 ✗ | Over-detected walls+windows |
