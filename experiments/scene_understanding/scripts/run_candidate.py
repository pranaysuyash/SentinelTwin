#!/usr/bin/env python3
"""
Run a candidate model stack against a split of floor plan images.

Usage:
  python run_candidate.py --candidate stack_d_gpt54_nano --split dev [--max-images 2]
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from bakeoff_harness import load_candidate_configs, get_candidate_config, run_candidate
from bakeoff_harness.schema import RunConfig


def main():
    parser = argparse.ArgumentParser(description="Run a scene understanding bakeoff candidate")
    parser.add_argument("--candidate", "-c", required=True, help="Candidate ID (e.g. stack_b_gpt4o)")
    parser.add_argument("--split", "-s", default="dev", help="Data split (dev, validation, test)")
    parser.add_argument("--max-images", "-n", type=int, default=0, help="Limit number of images to process")
    parser.add_argument("--config", help="Path to candidates.yaml (optional)")
    args = parser.parse_args()

    if args.config:
        load_candidate_configs(args.config)

    try:
        cfg = get_candidate_config(args.candidate)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    print(f"Candidate: {cfg.id}")
    print(f"  {cfg.description}")
    print(f"  Provider: {cfg.provider}")
    print(f"  Pipeline: {cfg.pipeline_kind}")
    print(f"  Components: {list(cfg.components.keys())}")
    if cfg.stage_roles:
        print(f"  Stage roles: {cfg.stage_roles}")
    if cfg.cloud_fallbacks:
        print(f"  Cloud fallbacks: {cfg.cloud_fallbacks}")
    print(f"  Split: {args.split}")
    print()

    config = RunConfig(
        candidate_id=args.candidate,
        split=args.split,
        output_dir=f"{args.candidate}_{args.split}",
        max_images=args.max_images,
    )

    manifest = run_candidate(config)
    print(f"\nRun manifest saved to outputs/{config.output_dir}/run_manifest.json")


if __name__ == "__main__":
    main()
