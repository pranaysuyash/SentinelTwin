import json
from pathlib import Path
from .schema import MetricsSummary, PerImageMetrics


def _load_run_metrics(run_dir: Path) -> tuple[dict, list[PerImageMetrics], list[str]]:
    manifest_path = run_dir / "run_manifest.json"
    summary_path = run_dir / "metrics_summary.json"
    per_image_path = run_dir / "per_image_metrics.jsonl"
    failures_path = run_dir / "failure_cases.md"

    manifest = {}
    summary = None
    per_image = []
    failure_cases = []

    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)

    if summary_path.exists():
        with open(summary_path) as f:
            summary = json.load(f)

    if per_image_path.exists():
        with open(per_image_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    per_image.append(json.loads(line))

    if failures_path.exists():
        with open(failures_path) as f:
            failure_cases = [l for l in f.read().split("\n") if l.strip() and not l.startswith("#")]

    return manifest, summary, per_image, failure_cases


def summarize_runs(glob_pattern: str) -> str:
    output_dir = Path(__file__).resolve().parent.parent / "outputs"
    run_dirs = sorted(output_dir.glob(f"{glob_pattern}")) if output_dir.exists() else []

    if not run_dirs:
        return "No matching runs found."

    rows: list[str] = []
    rows.append("# Scene Understanding Bakeoff — Comparison Report\n")
    rows.append(f"**Runs found:** {len(run_dirs)}\n")
    rows.append("| Run ID | Candidate | Split | Images | ✅ Succeeded | ❌ Failed | Wall F1 | Door F1 | Window F1 | Obs F1 | CZ Recall | P50 Lat (ms) |\n")
    rows.append("|---|---|---|---|---|---|---|---|---|---|---|---|\n")

    for run_dir in run_dirs:
        manifest, summary, per_image, failures = _load_run_metrics(run_dir)
        if summary:
            rows.append(
                f"| {summary.get('run_id', '?')[:16]} "
                f"| {summary.get('candidate_id', '?')} "
                f"| {manifest.get('split', '?')} "
                f"| {manifest.get('images_processed', 0)} "
                f"| {manifest.get('images_succeeded', 0)} "
                f"| {manifest.get('images_failed', 0)} "
                f"| {summary.get('wall_f1_mean', 0):.3f} "
                f"| {summary.get('door_f1_mean', 0):.3f} "
                f"| {summary.get('window_f1_mean', 0):.3f} "
                f"| {summary.get('obstruction_f1_mean', 0):.3f} "
                f"| {summary.get('critical_zone_recall_mean', 0):.3f} "
                f"| {summary.get('p50_latency_ms', 0):.0f} |\n"
            )

    rows.append("\n### Key\n")
    rows.append("- **Wall F1**: F1 score for wall segment detection (IoU-based matching)\n")
    rows.append("- **Door/Window F1**: F1 for door/window detection (bounding box IoU ≥ 0.3)\n")
    rows.append("- **Obs F1**: F1 for obstruction detection (shelves, racks, counters)\n")
    rows.append("- **CZ Recall**: Critical zone detection rate\n")
    rows.append("- **P50 Latency**: Median processing time per image\n")

    return "".join(rows)
