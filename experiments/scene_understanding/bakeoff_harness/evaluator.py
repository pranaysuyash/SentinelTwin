import json
import math
from pathlib import Path
from typing import Optional
import yaml
from .schema import SecuritySceneSubset, PerImageMetrics, MetricsSummary


RUBRIC_DEFAULTS = {
    "acceptance_thresholds": {
        "schema_valid_rate": 1.0,
        "wall_topology_f1_min": 0.0,
        "door_window_f1_min": 0.0,
        "wall_endpoint_error_norm_max": 1.0,
        "obstruction_macro_f1_min": 0.0,
        "critical_zone_recall_min": 0.0,
        "p95_latency_seconds_max": float("inf"),
        "hard_fail_rate_max": 1.0,
    },
}


def _load_annotations(split: str) -> dict[str, dict]:
    annotations_dir = Path(__file__).resolve().parent.parent / "data" / "annotations" / split
    result = {}
    if annotations_dir.exists():
        for path in sorted(annotations_dir.glob("*.json")):
            with open(path) as f:
                ann = json.load(f)
            result[ann["image_id"]] = ann
    return result


def _classify_segment(x1, y1, x2, y2) -> str:
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    if dx < 1e-9 and dy < 1e-9:
        return "P"
    if dx >= dy:
        return "H"
    return "V"


def _overlap_ratio(a1: float, a2: float, b1: float, b2: float) -> float:
    lo = max(min(a1, a2), min(b1, b2))
    hi = min(max(a1, a2), max(b1, b2))
    if hi <= lo:
        return 0.0
    overlap = hi - lo
    a_len = abs(a2 - a1)
    b_len = abs(b2 - b1)
    return overlap / (a_len + b_len - overlap) if (a_len + b_len - overlap) > 0 else 0.0


def _segment_match_score(
    px1, py1, px2, py2, gx1, gy1, gx2, gy2, pos_tol: float, overlap_min: float = 0.2
) -> float:
    pk = _classify_segment(px1, py1, px2, py2)
    gk = _classify_segment(gx1, gy1, gx2, gy2)
    if pk == "P" or gk == "P":
        return 0.0
    if pk != gk:
        return 0.0
    if pk == "H":
        py_avg = (py1 + py2) / 2
        gy_avg = (gy1 + gy2) / 2
        if abs(py_avg - gy_avg) > pos_tol:
            return 0.0
        return _overlap_ratio(px1, px2, gx1, gx2)
    else:
        px_avg = (px1 + px2) / 2
        gx_avg = (gx1 + gx2) / 2
        if abs(px_avg - gx_avg) > pos_tol:
            return 0.0
        return _overlap_ratio(py1, py2, gy1, gy2)


def _normalize_gt_box_to_line(g: dict) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = g["x1"], g["y1"], g["x2"], g["y2"]
    dx = abs(x2 - x1)
    dy = abs(y2 - y1)
    if dx >= dy:
        y_mid = (y1 + y2) / 2
        return (x1, y_mid, x2, y_mid)
    else:
        x_mid = (x1 + x2) / 2
        return (x_mid, y1, x_mid, y2)


def _match_walls(
    pred_walls: list,
    gt_walls: list[dict],
    pos_tol: float = 0.08,
    overlap_min: float = 0.20,
) -> tuple[int, int, int]:
    tp = 0
    matched_gt = set()
    for pw in pred_walls:
        best = 0.0
        best_gi = -1
        for gi, gw in enumerate(gt_walls):
            if gi in matched_gt:
                continue
            s = _segment_match_score(
                pw.x1, pw.y1, pw.x2, pw.y2,
                gw["x1"], gw["y1"], gw["x2"], gw["y2"],
                pos_tol, overlap_min,
            )
            if s > best:
                best = s
                best_gi = gi
        if best >= overlap_min:
            tp += 1
            matched_gt.add(best_gi)
    fp = max(0, len(pred_walls) - tp)
    fn = max(0, len(gt_walls) - tp)
    return tp, fp, fn


def _match_doors_windows(
    pred_items: list,
    gt_items: list[dict],
    pos_tol: float = 0.08,
    overlap_min: float = 0.15,
) -> tuple[int, int, int]:
    tp = 0
    matched_gt = set()
    for p in pred_items:
        best = 0.0
        best_gi = -1
        for gi, g in enumerate(gt_items):
            if gi in matched_gt:
                continue
            gx1, gy1, gx2, gy2 = _normalize_gt_box_to_line(g)
            s = _segment_match_score(
                p.x1, p.y1, p.x2, p.y2,
                gx1, gy1, gx2, gy2,
                pos_tol, overlap_min,
            )
            if s > best:
                best = s
                best_gi = gi
        if best >= overlap_min:
            tp += 1
            matched_gt.add(best_gi)
    fp = max(0, len(pred_items) - tp)
    fn = max(0, len(gt_items) - tp)
    return tp, fp, fn


def _match_boxes(
    pred_items: list,
    gt_items: list[dict],
    iou_threshold: float = 0.15,
) -> tuple[int, int, int]:
    def iou(p, g):
        x1 = max(p.x1, g["x1"])
        y1 = max(p.y1, g["y1"])
        x2 = min(p.x2, g["x2"])
        y2 = min(p.y2, g["y2"])
        if x2 <= x1 or y2 <= y1:
            return 0.0
        inter = (x2 - x1) * (y2 - y1)
        p_area = (p.x2 - p.x1) * (p.y2 - p.y1)
        g_area = (g["x2"] - g["x1"]) * (g["y2"] - g["y1"])
        return inter / (p_area + g_area - inter) if (p_area + g_area - inter) > 0 else 0.0

    tp = 0
    matched_g = set()
    for p in pred_items:
        for i, g in enumerate(gt_items):
            if i in matched_g:
                continue
            if iou(p, g) >= iou_threshold:
                tp += 1
                matched_g.add(i)
                break
    fp = max(0, len(pred_items) - tp)
    fn = max(0, len(gt_items) - tp)
    return tp, fp, fn


def _f1(tp, fp, fn) -> float:
    p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    return 2 * p * r / (p + r) if (p + r) > 0 else 0.0


def _match_polygons(pred_zones: list, gt_zones: list[dict], centroid_threshold: float = 0.1) -> tuple[int, int]:
    def centroid(poly):
        xs = poly[0::2]
        ys = poly[1::2]
        return (sum(xs) / len(xs), sum(ys) / len(ys))

    tp = 0
    matched_g = set()
    for pz in pred_zones:
        pc = centroid(pz.polygon)
        for i, gz in enumerate(gt_zones):
            if i in matched_g:
                continue
            gc = centroid(gz["polygon"])
            d = math.sqrt((pc[0] - gc[0]) ** 2 + (pc[1] - gc[1]) ** 2)
            if d < centroid_threshold:
                tp += 1
                matched_g.add(i)
                break
    fp = max(0, len(pred_zones) - tp)
    fn = max(0, len(gt_zones) - tp)
    return tp, fp, fn


def _load_rubric(rubric_path: str | None = None) -> dict:
    config_dir = Path(__file__).resolve().parent.parent / "configs"
    path = Path(rubric_path) if rubric_path else config_dir / "eval_rubric.yaml"
    if not path.exists():
        return dict(RUBRIC_DEFAULTS)
    with open(path) as f:
        yaml_data = yaml.safe_load(f) or {}
    rubric = dict(RUBRIC_DEFAULTS)
    for section in ("acceptance_thresholds", "metrics", "failure_taxonomy", "securityscene_subset_required"):
        if section in yaml_data:
            rubric[section] = yaml_data[section]
    return rubric


def _evaluate_acceptance(summary: MetricsSummary, rubric: dict) -> tuple[bool, list[str]]:
    failures: list[str] = []
    thresholds = rubric.get("acceptance_thresholds", {})
    if summary.schema_valid_rate < thresholds.get("schema_valid_rate", 1.0):
        failures.append("schema_valid_rate below threshold")
    if summary.wall_f1_mean < thresholds.get("wall_topology_f1_min", 0.0):
        failures.append("wall_topology_f1 below threshold")
    if summary.door_f1_mean < thresholds.get("door_window_f1_min", 0.0):
        failures.append("door_f1 below threshold")
    if summary.window_f1_mean < thresholds.get("door_window_f1_min", 0.0):
        failures.append("window_f1 below threshold")
    if summary.wall_endpoint_error_mean > thresholds.get("wall_endpoint_error_norm_max", 1.0):
        failures.append("wall_endpoint_error_norm too high")
    if summary.obstruction_f1_mean < thresholds.get("obstruction_macro_f1_min", 0.0):
        failures.append("obstruction_f1 below threshold")
    if summary.critical_zone_recall_mean < thresholds.get("critical_zone_recall_min", 0.0):
        failures.append("critical_zone_recall below threshold")
    if (summary.p95_latency_ms / 1000.0) > thresholds.get("p95_latency_seconds_max", float("inf")):
        failures.append("p95_latency too high")
    if summary.hard_fail_rate > thresholds.get("hard_fail_rate_max", 1.0):
        failures.append("hard_fail_rate too high")
    return (len(failures) == 0, failures)


def evaluate_predictions(predictions: list[SecuritySceneSubset], split: str) -> tuple[list[PerImageMetrics], list[str]]:
    annotations = _load_annotations(split)
    per_image: list[PerImageMetrics] = []
    failure_cases: list[str] = []

    for pred in predictions:
        ann = annotations.get(pred.image_id, {})
        gt_walls = ann.get("walls", [])
        gt_doors = ann.get("doors", [])
        gt_windows = ann.get("windows", [])
        gt_obstructions = ann.get("obstructions", [])
        gt_critical_zones = ann.get("critical_zones", [])

        if pred.parse_error:
            per_image.append(PerImageMetrics(
                image_id=pred.image_id, schema_valid=False,
                ambiguity_present=bool(pred.ambiguities),
                wall_precision=0, wall_recall=0, wall_f1=0, wall_endpoint_error=1.0,
                door_f1=0, window_f1=0, obstruction_f1=0,
                critical_zone_recall=0, critical_zone_precision=0,
                parse_error=pred.parse_error, timing_ms=pred.timing_ms,
            ))
            failure_cases.append(f"{pred.image_id}: {pred.parse_error}")
            continue

        schema_valid = True
        tp_w, fp_w, fn_w = _match_walls(pred.walls, gt_walls)
        wall_f1 = _f1(tp_w, fp_w, fn_w)
        wall_prec = tp_w / (tp_w + fp_w) if (tp_w + fp_w) > 0 else 0.0
        wall_rec = tp_w / (tp_w + fn_w) if (tp_w + fn_w) > 0 else 0.0

        wall_err = 0.0
        for pw in pred.walls:
            for gw in gt_walls:
                w = _segment_match_score(
                    pw.x1, pw.y1, pw.x2, pw.y2,
                    gw["x1"], gw["y1"], gw["x2"], gw["y2"],
                    pos_tol=0.15,
                )
                if w > wall_err:
                    wall_err = 1.0 - w

        tp_d, fp_d, fn_d = _match_doors_windows(pred.doors, gt_doors)
        door_f1 = _f1(tp_d, fp_d, fn_d)

        tp_wi, fp_wi, fn_wi = _match_doors_windows(pred.windows, gt_windows)
        window_f1 = _f1(tp_wi, fp_wi, fn_wi)

        tp_o, fp_o, fn_o = _match_boxes(pred.obstructions, gt_obstructions)
        obstruction_f1 = _f1(tp_o, fp_o, fn_o)

        tp_z, fp_z, fn_z = _match_polygons(pred.critical_zones, gt_critical_zones)
        cz_recall = tp_z / (tp_z + fn_z) if (tp_z + fn_z) > 0 else 0.0
        cz_precision = tp_z / (tp_z + fp_z) if (tp_z + fp_z) > 0 else 0.0

        per_image.append(PerImageMetrics(
            image_id=pred.image_id, schema_valid=schema_valid,
            ambiguity_present=bool(pred.ambiguities),
            wall_precision=wall_prec, wall_recall=wall_rec, wall_f1=wall_f1,
            wall_endpoint_error=wall_err,
            door_f1=door_f1, window_f1=window_f1, obstruction_f1=obstruction_f1,
            critical_zone_recall=cz_recall, critical_zone_precision=cz_precision,
            timing_ms=pred.timing_ms,
        ))

    return per_image, failure_cases


def compute_summary(per_image: list[PerImageMetrics], candidate_id: str, run_id: str, rubric_path: str | None = None) -> MetricsSummary:
    n = len(per_image)
    if n == 0:
        return MetricsSummary(candidate_id=candidate_id, run_id=run_id, schema_valid_rate=0,
            ambiguity_rate=0, wall_f1_mean=0, door_f1_mean=0, window_f1_mean=0, obstruction_f1_mean=0,
            critical_zone_recall_mean=0, critical_zone_precision_mean=0,
            wall_endpoint_error_mean=0, hard_fail_rate=0, p50_latency_ms=0, p95_latency_ms=0)

    latencies = sorted(p.timing_ms for p in per_image)
    p50 = latencies[len(latencies) // 2]
    p95 = latencies[int(len(latencies) * 0.95)]
    fails = sum(1 for p in per_image if p.parse_error)
    ambiguity_cases = sum(1 for p in per_image if p.ambiguity_present)

    summary = MetricsSummary(
        candidate_id=candidate_id,
        run_id=run_id,
        schema_valid_rate=sum(1 for p in per_image if p.schema_valid) / n,
        ambiguity_rate=ambiguity_cases / n,
        wall_f1_mean=sum(p.wall_f1 for p in per_image) / n,
        door_f1_mean=sum(p.door_f1 for p in per_image) / n,
        window_f1_mean=sum(p.window_f1 for p in per_image) / n,
        obstruction_f1_mean=sum(p.obstruction_f1 for p in per_image) / n,
        critical_zone_recall_mean=sum(p.critical_zone_recall for p in per_image) / n,
        critical_zone_precision_mean=sum(p.critical_zone_precision for p in per_image) / n,
        wall_endpoint_error_mean=sum(p.wall_endpoint_error for p in per_image) / n,
        hard_fail_rate=fails / n,
        p50_latency_ms=p50,
        p95_latency_ms=p95,
    )

    rubric = _load_rubric(rubric_path)
    accepted, failures = _evaluate_acceptance(summary, rubric)
    summary.accepted = accepted
    summary.acceptance_failures = failures
    summary.acceptance_thresholds = rubric.get("acceptance_thresholds", {})
    return summary
