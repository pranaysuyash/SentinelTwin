#!/usr/bin/env python3
"""
Evaluate a completed run against ground truth annotations.

Usage:
  python evaluate_run.py --run-id stack_b_gpt4o_dev_abc12345
"""
import sys
import os
import json
import argparse
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from bakeoff_harness.evaluator import evaluate_predictions, compute_summary
from bakeoff_harness.schema import SecuritySceneSubset, WallPrediction, DoorPrediction, WindowPrediction, ObstructionPrediction, CriticalZonePrediction


def _load_predictions(run_dir: Path) -> tuple[list[SecuritySceneSubset], str]:
    manifest_path = run_dir / "run_manifest.json"
    preds_path = run_dir / "predictions.jsonl"

    if not manifest_path.exists():
        raise FileNotFoundError(f"Run manifest not found: {manifest_path}")
    with open(manifest_path) as f:
        manifest = json.load(f)

    if not preds_path.exists():
        raise FileNotFoundError(f"Predictions not found: {preds_path}")

    predictions = []
    with open(preds_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            def _filter_fields(cls_name, items):
                cls_map = {"walls": WallPrediction, "doors": DoorPrediction, "windows": WindowPrediction, "obstructions": ObstructionPrediction}
                cls = cls_map[cls_name]
                valid = {f.name for f in __import__("dataclasses").fields(cls)}
                result = []
                for item in items:
                    filtered = {}
                    for k, v in item.items():
                        if k in valid:
                            filtered[k] = v
                        elif k == "class" and "class_" in valid:
                            filtered["class_"] = v
                    if any(k.startswith("x") for k in filtered):
                        result.append(cls(**filtered))
                return result

            data = json.loads(line)
            pred = SecuritySceneSubset(
                image_id=data["image_id"],
                walls=[WallPrediction(**w) for w in data.get("walls", [])],
                doors=_filter_fields("doors", data.get("doors", [])),
                windows=_filter_fields("windows", data.get("windows", [])),
                obstructions=_filter_fields("obstructions", data.get("obstructions", [])),
                critical_zones=[CriticalZonePrediction(**z) for z in data.get("critical_zones", [])],
                parse_error=data.get("parse_error"),
                timing_ms=data.get("timing_ms", 0),
            )
            predictions.append(pred)

    return predictions, manifest.get("split", "dev")


def main():
    parser = argparse.ArgumentParser(description="Evaluate a completed bakeoff run")
    parser.add_argument("--run-id", "-r", help="Run directory name under outputs/ (candidate_split or UUID)")
    parser.add_argument("--candidate", "-c", help="Candidate ID (alternative to full run-id)")
    parser.add_argument("--split", "-s", default="dev", help="Split name (used with --candidate)")
    args = parser.parse_args()
    if not args.run_id and not args.candidate:
        parser.error("Either --run-id or --candidate is required")

    outputs_dir = Path(__file__).resolve().parent.parent / "outputs"
    
    run_id = args.run_id
    if args.candidate:
        run_id = f"{args.candidate}_{args.split}"
    run_dir = outputs_dir / run_id

    if not run_dir.exists():
        print(f"Error: Run directory not found: {run_dir}")
        sys.exit(1)

    print(f"Evaluating run: {run_id}")
    predictions, split = _load_predictions(run_dir)
    print(f"  Loaded {len(predictions)} predictions, split={split}\n")

    per_image, failures = evaluate_predictions(predictions, split)

    manifest_path = run_dir / "run_manifest.json"
    with open(manifest_path) as f:
        manifest = json.load(f)

    candidate_id = manifest.get("candidate_id", "unknown")
    run_id_full = manifest.get("run_id", args.run_id)
    summary = compute_summary(per_image, candidate_id, run_id_full)

    # Write outputs
    with open(run_dir / "metrics_summary.json", "w") as f:
        json.dump(summary.to_dict(), f, indent=2)
    with open(run_dir / "per_image_metrics.jsonl", "w") as f:
        for m in per_image:
            f.write(json.dumps(m.to_dict()) + "\n")
    with open(run_dir / "failure_cases.md", "w") as f:
        f.write("# Failure Cases\n\n")
        for case in failures:
            f.write(f"- {case}\n")
        if not failures:
            f.write("No failures.\n")

    # Print summary
    print("Results:")
    print(f"  Images: {len(per_image)}")
    print(f"  Failures: {len(failures)}")
    print(f"  Schema valid rate: {summary.schema_valid_rate:.0%}")
    print(f"  Wall F1: {summary.wall_f1_mean:.3f}")
    print(f"  Door F1: {summary.door_f1_mean:.3f}")
    print(f"  Window F1: {summary.window_f1_mean:.3f}")
    print(f"  Obstruction F1: {summary.obstruction_f1_mean:.3f}")
    print(f"  Schema acceptance: {'PASS' if summary.accepted else 'FAIL'}")
    if summary.acceptance_failures:
        print("  Acceptance blockers:")
        for failure in summary.acceptance_failures:
            print(f"    - {failure}")
    print(f"  Critical Zone Recall: {summary.critical_zone_recall_mean:.3f}")
    print(f"  P50 Latency: {summary.p50_latency_ms:.0f}ms")
    print(f"  P95 Latency: {summary.p95_latency_ms:.0f}ms\n")

    per_image.sort(key=lambda m: m.wall_f1)
    for m in per_image[:3]:
        arrow = " ⚠" if m.wall_f1 < 0.5 else ""
        print(f"  {m.image_id}: wall_F1={m.wall_f1:.3f}, door_F1={m.door_f1:.3f}, obs_F1={m.obstruction_f1:.3f}{arrow}")
    print(f"\nReports saved to {run_dir}/")


if __name__ == "__main__":
    main()
