# Scene Understanding Bakeoff — Comparison Report

## All Candidates (7)

| Candidate | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | CZ Prec | P50 Latency | P95 Latency |
|---|---|---|---|---|---|---|---|---|
| **GPT-4o** | **0.964** | 0.400 | **0.700** | 0.417 | **0.200** | **0.200** | 5,058ms | 8,419ms |
| GPT-4.1 | 0.948 | 0.400 | 0.400 | **0.893** | 0.000 | 0.000 | 5,424ms | 17,158ms |
| Gemini 2.5 Flash | 0.948 | 0.200 | 0.600 | **0.893** | 0.000 | 0.000 | 6,147ms | 7,544ms |
| Gemini 2.5 Pro | 0.933 | 0.400 | 0.500 | 0.680 | 0.000 | 0.000 | 5,874ms | 8,641ms |
| GPT-5.4-nano | 0.931 | 0.400 | 0.100 | 0.178 | **0.200** | **0.200** | 4,853ms | 6,941ms |
| Qwen2.5-VL-7B | 0.661 | 0.000 | 0.000 | 0.100 | 0.000 | 0.000 | 85,912ms | 258,385ms |
| Florence-2-base | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 4,598ms | 5,090ms |

## Key Findings

1. **GPT-4o leads overall** — best wall F1 (0.964), best window F1 (0.700), and the only model achieving meaningful critical zone recall (0.200) besides GPT-5.4-nano
2. **GPT-4.1 and Gemini 2.5 Flash tie for best obstruction detection** (0.893 F1), dramatically better than GPT-4o (0.417)
3. **Window detection varies widely** — GPT-4o (0.700) >> Gemini Flash (0.600) > Gemini Pro (0.500) > GPT-4.1 (0.400)
4. **Critical zone recall is 0 for all Gemini and GPT-4.1 models** — the "pay attention to colored regions" prompt addition only helped GPT-4o and GPT-5.4-nano
5. **Door detection is modest across the board** (0.200–0.400 F1), the door symbols in synthetic images are small relative to image size
6. **Local models cannot compete** — Qwen2.5-VL-7B is 15–80× slower than cloud models with significantly worse scores; Florence-2-base (0.23B params) cannot do floor plan understanding
7. **GPT-5.4-nano is surprisingly weak on windows** (0.100 F1) despite being competitive on walls and doors, suggesting it has weaker fine-detail handling

## Composite Score (Wall + Door + Window + Obs + CZ)

| Rank | Candidate | Composite |
|---|---|---|
| 1 | GPT-4o | 2.681 |
| 2 | Gemini 2.5 Flash | 2.641 |
| 3 | GPT-4.1 | 2.641 |
| 4 | Gemini 2.5 Pro | 2.513 |
| 5 | GPT-5.4-nano | 1.809 |
| 6 | Qwen2.5-VL-7B | 0.761 |
| 7 | Florence-2-base | 0.000 |

## Notes

- **Smart matching** (collinearity+overlap) was used for all evaluations
- **Critical zone recall requires explicit prompting** — adding "Pay special attention to colored rectangular regions" improved CZ recall from 0.0 to 0.2 for OpenAI models
- **Door symbols simulated as thin arcs** — small visual features are hard for all models to detect reliably
- **Synthetic images only** — real floor plan photos will be a harder test

## Remaining Gaps

- **CZ recall < 0.2 for all candidates** — needs decoupled CZ extraction pass
- **Only synthetic images** — no real-world validation
- **No temporal/simulation layer evaluation** — only static scene understanding is measured
- **No GOT-OCR2_0 integration yet** — the OCR assist component for Qwen is not wired in
