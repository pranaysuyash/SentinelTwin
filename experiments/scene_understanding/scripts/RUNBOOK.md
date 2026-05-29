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

### Pilot results

File: `outputs/COMPARISON_REPORT.md`

#### GPT-4o (improved prompt + smart matcher)

| Metric | Value |
|---|---|
| Wall F1 | 0.964 |
| Door F1 | 0.400 (2/5 doors matched; 3 are genuine model errors on wrong wall) |
| Window F1 | 0.700 (4/5 windows matched) |
| Obstruction F1 | 0.417 (corridor with 0/4 drags score down) |
| Critical Zone Recall | 0.200 (1/5 detected — prompt improvement helped but still weak) |
| P50 Latency | 5,058ms |
| Schema valid rate | 100% |
| Hard fail rate | 0% |

#### GPT-5.4 Nano

| Metric | Value |
|---|---|
| Wall F1 | 0.931 (marginally behind GPT-4o) |
| Door F1 | 0.400 (same 2/5 correct) |
| Window F1 | 0.100 (weak — only 1/5) |
| Obstruction F1 | 0.178 (misses most in crowded scenes) |
| Critical Zone Recall | 0.200 (same as GPT-4o) |
| P50 Latency | 4,853ms (faster than GPT-4o) |
| Schema valid rate | 100% |
| Hard fail rate | 0% |

### Matching algorithm

The evaluator uses collinearity + overlap matching (not endpoint distance). For each predicted wall/segment:
1. Classify as horizontal or vertical
2. Check position tolerance (pos_tol=0.08 for walls/doors/windows)
3. Compute 1D overlap ratio along the shared axis
4. Match if overlap ≥ threshold (0.20 for walls, 0.15 for doors/windows)

This handles the GT-inset vs GPT-perimeter coordinate convention mismatch. GT doors (2D boxes) are projected to their longer axis for line-to-line matching.

### Remaining gaps

1. **Critical zones**: Only 1/5 detected by either model. Need better prompt engineering or visual markers
2. **Obstructions in clutter**: Corridor scene (0/4 detected by either model) and gpt-5.4-nano's general weakness suggest the model needs scene-specific prompting for dense obstruction layouts
3. **Window/Obstruction tradeoff**: GPT-4o's improved prompt (adding "colored rectangular regions" for CZs) slightly degraded window/obstruction accuracy — suggest decoupling into separate extraction passes
4. **Run Florence-2 and Qwen candidates** for baseline comparison
5. **Source 5+ real-world floor plan images** for validation split

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
