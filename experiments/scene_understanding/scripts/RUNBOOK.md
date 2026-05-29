# Scene Understanding Bakeoff — RUNBOOK

## Quick Start

```bash
# Activate venv (Python 3.13)
source .venv/bin/activate

# Run a candidate on the dev split:
python scripts/run_candidate.py --candidate stack_b_gpt4o --split dev

# Evaluate a completed run:
python scripts/evaluate_run.py --candidate stack_b_gpt4o --split dev

# Regenerate comparison report:
python scripts/summarize_runs.py
```

## Candidates

| ID | Model | Pipeline | Description |
|---|---|---|---|
| `stack_a_qwen_ocr` | Qwen2.5-VL-7B + GOT-OCR2_0 | local (transformers) | Qwen VL parser with OCR assist |
| `stack_b_gpt4o` | GPT-4o | cloud (OpenAI) | GPT-4o direct floorplan parser |
| `stack_c_florence` | Florence-2-base | local (transformers) | Florence-2 prompt-task parser |
| `stack_d_gpt54_nano` | GPT-5.4-nano | cloud (OpenAI) | GPT-5.4 Nano floorplan parser |
| `stack_e_gpt41_structured` | GPT-4.1 | cloud (OpenAI) | GPT-4.1 structured-output fallback |
| `stack_f_gemini25_flash` | Gemini 2.5 Flash | cloud (Gemini) | Gemini 2.5 Flash fast cloud fallback |
| `stack_g_gemini25_pro` | Gemini 2.5 Pro | cloud (Gemini) | Gemini 2.5 Pro high-ceiling cloud fallback |

## Prerequisites

- Python 3.13
- API keys in environment: `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- For local models: PyTorch 2.12+, transformers 4.49.0

## Results (dev split, 5 images, smart matcher)

| Candidate | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | CZ Prec | P50 | P95 |
|---|---|---|---|---|---|---|---|---|
| GPT-4o | **0.964** | 0.400 | **0.700** | 0.417 | **0.200** | **0.200** | 5s | 8s |
| GPT-4.1 | 0.948 | 0.400 | 0.400 | **0.893** | 0.000 | 0.000 | 5s | 17s |
| Gemini 2.5 Flash | 0.948 | 0.200 | 0.600 | **0.893** | 0.000 | 0.000 | 6s | 8s |
| Gemini 2.5 Pro | 0.933 | 0.400 | 0.500 | 0.680 | 0.000 | 0.000 | 6s | 9s |
| GPT-5.4-nano | 0.931 | 0.400 | 0.100 | 0.178 | 0.200 | 0.200 | 5s | 7s |
| Qwen2.5-VL-7B | 0.661 | 0.000 | 0.000 | 0.100 | 0.000 | 0.000 | 86s | 258s |
| Florence-2-base | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 5s | 5s |

## Matching Algorithm

The evaluator uses collinearity + 1D overlap matching (not endpoint-distance):

1. **Classify orientation** — each segment is classified as horizontal or vertical
2. **Position tolerance** — segments must be within 0.08 (walls) or 0.05 (doors/windows) in the non-varying axis
3. **1D overlap threshold** — overlapping interval must exceed 0.20 (horizontal walls) or 0.15 (other elements)
4. **GT normalization** — ground-truth doors (2D boxes) are projected to their longer axis for line-to-line matching
5. **No penalty for GT-inset vs perimeter convention** — handles the margin mismatch between inset annotations and full-perimeter predictions

This replaced the original endpoint-distance matcher which produced wall F1 = 0.436.

## Extraction Prompt

The prompt includes:
- Strict JSON schema with x1/y1/x2/y2 normalized coordinates
- Confidence and source metadata per element
- Ambiguity reporting instead of invented precision
- Critical zone visual cue: "Pay special attention to colored rectangular regions"

## Architecture

```
scripts/
  run_candidate.py     — CLI entry point for running a candidate
  evaluate_run.py      — CLI entry point for evaluating completed runs
  summarize_runs.py    — aggregate comparison report

bakeoff_harness/
  __init__.py          — exports for CLI scripts
  schema.py            — dataclass definitions (WallPrediction, etc.)
  candidates.py        — candidate registry (model IDs, providers, metadata)
  runner.py            — extraction pipeline (OpenAI, Gemini, local transformers)
  evaluator.py         — smart matcher + metrics computation

data/
  images/dev/          — 5 synthetic floor plan images
  annotations/dev/     — ground-truth JSON annotations

outputs/
  <candidate>_<split>/ — per-candidate run outputs
  COMPARISON_REPORT.md — latest comparison report
```

## Hardware

Apple M3 Max (40-core GPU via MPS), 103GB unified memory.
Model inference for local models uses `torch.bfloat16` on MPS where available.

## Remaining Gaps

1. **CZ recall < 0.2 for all candidates** — decoupled CZ extraction pass needed
2. **Only synthetic images** — no real-world validation
3. **No temporal/simulation evaluation** — only static scene understanding measured
4. **No GOT-OCR2_0 integration** — OCR assist component for Qwen not wired in
5. **Door symbol detection weak** — thin arc symbols are hard for all models
