# Scene Understanding Bakeoff Harness (V0.2)

This folder is the execution workspace for floorplan -> SecurityScene subset extraction experiments.

## Structure

- `configs/candidates.yaml`: model/tool stack definitions
- `configs/eval_rubric.yaml`: acceptance thresholds and metrics
- `data/`: inputs, annotations, splits
- `scripts/`: harness implementation entrypoints
- `outputs/`: run artifacts

## Standard run contract

1. Parse input floorplan image(s) with selected stack
2. Produce normalized intermediate artifacts
3. Map to SecurityScene subset JSON
4. Evaluate against ground truth
5. Emit reproducible run bundle under `outputs/<run_id>/`
6. Save `trace.json` alongside each image-level prediction so the next agent can inspect OCR, grounding, and fallback choices without re-running the model

## Required outputs per run

- `metrics_summary.json`
- `per_image_metrics.jsonl`
- `failure_cases.md`
- `run_manifest.json`

## Notes

- Keep deterministic simulation out of this folder; this harness produces candidate scene drafts only.
- Every extracted object must include `source: ai` and confidence metadata.
- All recommendations remain provisional until validated by simulation and human review.
- Cloud fallback stacks are first-class citizens in the config, but the same evaluator scores them so local and cloud results remain comparable.
