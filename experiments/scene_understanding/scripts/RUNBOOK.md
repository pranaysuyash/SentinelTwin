# Harness Runbook

## Objective

Implement a reproducible, config-driven bakeoff harness with no hidden manual steps.

## Status: IMPLEMENTED (2026-05-28)

The harness is built and a GPT-4o pilot run has completed successfully.

### Script entrypoints

| Script | Purpose | Status |
|---|---|---|
| `run_candidate.py` | Run a model stack against floor plan images | ✅ Implemented |
| `evaluate_run.py` | Evaluate predictions against ground truth | ✅ Implemented |
| `summarize_runs.py` | Compare all runs into a report | ✅ Implemented |

### Execution flow

1. `run_candidate.py --candidate <id> --split <dev|validation|test>` → runs model, writes predictions
2. `evaluate_run.py --candidate <id> --split <dev>` → compares predictions to annotations, emits metrics
3. `summarize_runs.py` → generates comparison table across all runs

### Supported candidates

| ID | Model | Access | Status |
|---|---|---|---|
| `stack_b_gpt4o` | GPT-4o (OpenAI) | `OPENAI_API_KEY` env var | ✅ Pilot complete |
| `stack_a_qwen_ocr` | Qwen2.5-VL-7B + GOT-OCR2_0 | Local transformers (GPU recommended) | 🔲 Not yet run |
| `stack_c_florence` | Florence-2-base | Local transformers | 🔲 Not yet run |

### Data

- **Images:** 5 synthetic floor plans in `data/images/dev/` (retail shop, grocery, pharmacy, warehouse, corridor lobby)
- **Annotations:** Ground truth JSON in `data/annotations/dev/`
- **Splits:** Split manifests in `data/splits/`

### Pilot results (GPT-4o, 5 images)

File: `outputs/COMPARISON_REPORT.md`

| Metric | Value |
|---|---|
| Wall F1 | 0.436 (inset GT vs full-perimeter GPT — matching needs tuning) |
| Door F1 | 0.000 (detected but polyline format mismatch with box matching) |
| Window F1 | 0.000 (same format mismatch) |
| Obstruction F1 | 0.467 |
| Critical Zone Recall | 0.000 (not detected — needs prompt tuning) |
| P50 Latency | 5,686ms |
| Schema valid rate | 100% |
| Hard fail rate | 0% |

### Recommendation

Scores are low due to matching algorithm strictness (GT uses inset walls with door gaps, GPT returns full perimeter). The pipeline is sound. Next steps:
1. Tune the matching algorithm for better tolerance of coordinate conventions
2. Add explicit critical zone prompting to the extraction prompt
3. Run Florence-2 and Qwen candidates
4. Source 5 more real-world floor plan images for the validation split

### Required outputs per run

- `metrics_summary.json` ✅ (written by evaluate_run.py)
- `per_image_metrics.jsonl` ✅
- `failure_cases.md` ✅
- `run_manifest.json` ✅
- `predictions.jsonl` ✅ (written by run_candidate.py)

### Reproducibility

- Exact model ID, temperature, max_tokens persisted in run_manifest.json
- Timing per image stored in per_image_metrics.jsonl
- Hard failures logged with error taxonomy in failure_cases.md
