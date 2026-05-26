# Harness Runbook (Implementation Target)

## Objective

Implement a reproducible, config-driven bakeoff harness with no hidden manual steps.

## Required script entrypoints

- `run_candidate.py --candidate <id> --split <dev|validation|test>`
- `evaluate_run.py --run-id <id>`
- `summarize_runs.py --glob "outputs/*"`

## Execution flow

1. Load candidate config from `configs/candidates.yaml`.
2. Load split manifest from `data/splits/*.json`.
3. For each image:
   - run parser stack
   - write intermediate artifacts (`detections.json`, `ocr.json`, `layout.json`)
   - map to `securityscene_subset.json`
4. Evaluate predictions against annotations.
5. Emit run outputs.

## Output contract

For run `outputs/<run_id>/`, generate:
- `run_manifest.json`
- `metrics_summary.json`
- `per_image_metrics.jsonl`
- `failure_cases.md`
- `artifacts/<image_id>/...`

## Reproducibility requirements

- Persist exact model ids, revisions (if pinned), and prompt templates used.
- Persist timing per stage (parse, map, eval).
- Log hard failures with stack trace and taxonomy label.
