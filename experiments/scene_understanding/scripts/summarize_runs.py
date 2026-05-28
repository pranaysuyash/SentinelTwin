#!/usr/bin/env python3
"""
Summarize all bakeoff runs into a comparison report.

Usage:
  python summarize_runs.py
  python summarize_runs.py --glob "*"
"""
import sys
import os
import argparse
from pathlib import Path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from bakeoff_harness.summarizer import summarize_runs


def main():
    parser = argparse.ArgumentParser(description="Summarize all bakeoff runs into a comparison report")
    parser.add_argument("--glob", default="*", help="Glob pattern to match run directories")
    parser.add_argument("--output", "-o", default="COMPARISON_REPORT.md", help="Output markdown file")
    args = parser.parse_args()

    report = summarize_runs(args.glob)
    print(report)

    output_dir = Path(__file__).resolve().parent.parent / "outputs"
    out_path = output_dir / args.output
    with open(out_path, "w") as f:
        f.write(report)
    print(f"\nReport saved to {out_path}")


if __name__ == "__main__":
    main()
