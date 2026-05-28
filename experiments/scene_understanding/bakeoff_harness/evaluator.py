import json
import math
from pathlib import Path
from typing import Optional
from .schema import SecuritySceneSubset, PerImageMetrics, MetricsSummary, WallPrediction, DoorPrediction, WindowPrediction, ObstructionPrediction


def _load_annotations(split: str) -> dict[str, dict]:
    annotations_dir = Path(__file__).resolve().parent.parent / "data" / "annotations" / split
    result = {}
    if annotations_dir.exists():
        for path in sorted(annotations_dir.glob("*.json")):
            with open(path) as f:
                ann = json.load(f)
            result[ann["image_id"]] = ann
    return result


def _line_distance(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) -> float:
    """Minimum distance between two line segments' endpoints (simple approx)."""
    dx = min(abs(ax1 - bx1), abs(ax1 - bx2), abs(ax2 - bx1), abs(ax2 - bx2))
    dy = min(abs(ay1 - by1), abs(ay1 - by2), abs(ay2 - by1), abs(ay2 - by2))
    return math.sqrt(dx * dx + dy * dy)


def _match_walls(pred_walls: list[WallPrediction], gt_walls: list[dict], threshold: float = 0.03) -> tuple[int, int, int]:
    tp = 0
    for pw in pred_walls:
        for gw in gt_walls:
            d = _line_distance(pw.x1, pw.y1, pw.x2, pw.y2, gw["x1"], gw["y1"], gw["x2"], gw["y2"])
            if d < threshold:
                tp += 1
                break
    fp = max(0, len(pred_walls) - tp)
    fn = max(0, len(gt_walls) - tp)
    return tp, fp, fn


def _match_boxes(pred_items: list, gt_items: list[dict], iou_threshold: float = 0.3) -> tuple[int, int, int]:
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
                wall_err = max(wall_err, _line_distance(pw.x1, pw.y1, pw.x2, pw.y2, gw["x1"], gw["y1"], gw["x2"], gw["y2"]))

        tp_d, fp_d, fn_d = _match_boxes(pred.doors, gt_doors)
        door_f1 = _f1(tp_d, fp_d, fn_d)

        tp_wi, fp_wi, fn_wi = _match_boxes(pred.windows, gt_windows)
        window_f1 = _f1(tp_wi, fp_wi, fn_wi)

        tp_o, fp_o, fn_o = _match_boxes(pred.obstructions, gt_obstructions)
        obstruction_f1 = _f1(tp_o, fp_o, fn_o)

        tp_z, fp_z, fn_z = _match_polygons(pred.critical_zones, gt_critical_zones)
        cz_recall = tp_z / (tp_z + fn_z) if (tp_z + fn_z) > 0 else 0.0
        cz_precision = tp_z / (tp_z + fp_z) if (tp_z + fp_z) > 0 else 0.0

        per_image.append(PerImageMetrics(
            image_id=pred.image_id, schema_valid=schema_valid,
            wall_precision=wall_prec, wall_recall=wall_rec, wall_f1=wall_f1,
            wall_endpoint_error=wall_err,
            door_f1=door_f1, window_f1=window_f1, obstruction_f1=obstruction_f1,
            critical_zone_recall=cz_recall, critical_zone_precision=cz_precision,
            timing_ms=pred.timing_ms,
        ))

    return per_image, failure_cases


def compute_summary(per_image: list[PerImageMetrics], candidate_id: str, run_id: str) -> MetricsSummary:
    n = len(per_image)
    if n == 0:
        return MetricsSummary(candidate_id=candidate_id, run_id=run_id, schema_valid_rate=0,
            wall_f1_mean=0, door_f1_mean=0, window_f1_mean=0, obstruction_f1_mean=0,
            critical_zone_recall_mean=0, critical_zone_precision_mean=0,
            wall_endpoint_error_mean=0, hard_fail_rate=0, p50_latency_ms=0, p95_latency_ms=0)

    latencies = sorted(p.timing_ms for p in per_image)
    p50 = latencies[len(latencies) // 2]
    p95 = latencies[int(len(latencies) * 0.95)]
    fails = sum(1 for p in per_image if p.parse_error)

    return MetricsSummary(
        candidate_id=candidate_id,
        run_id=run_id,
        schema_valid_rate=sum(1 for p in per_image if p.schema_valid) / n,
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
