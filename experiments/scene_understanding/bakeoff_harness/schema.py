from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime
import json


@dataclass
class WallPrediction:
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass
class DoorPrediction:
    x1: float
    y1: float
    x2: float
    y2: float
    class_: str = "door"


@dataclass
class WindowPrediction:
    x1: float
    y1: float
    x2: float
    y2: float
    class_: str = "window"


@dataclass
class ObstructionPrediction:
    x1: float
    y1: float
    x2: float
    y2: float
    class_: str = "obstruction"


@dataclass
class CriticalZonePrediction:
    polygon: list[float]
    zone_type: str = "general"


@dataclass
class SecuritySceneSubset:
    image_id: str
    walls: list[WallPrediction] = field(default_factory=list)
    doors: list[DoorPrediction] = field(default_factory=list)
    windows: list[WindowPrediction] = field(default_factory=list)
    obstructions: list[ObstructionPrediction] = field(default_factory=list)
    critical_zones: list[CriticalZonePrediction] = field(default_factory=list)
    raw_response: str = ""
    parse_error: Optional[str] = None
    timing_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            "image_id": self.image_id,
            "walls": [asdict(w) for w in self.walls],
            "doors": [asdict(d) for d in self.doors],
            "windows": [asdict(w) for w in self.windows],
            "obstructions": [asdict(o) for o in self.obstructions],
            "critical_zones": [asdict(z) for z in self.critical_zones],
            "raw_response": self.raw_response[:500] if self.raw_response else "",
            "parse_error": self.parse_error,
            "timing_ms": round(self.timing_ms, 1),
        }


@dataclass
class CandidateConfig:
    id: str
    description: str
    components: dict
    expected_strengths: list[str] = field(default_factory=list)
    known_risks: list[str] = field(default_factory=list)


@dataclass
class RunConfig:
    candidate_id: str
    split: str
    output_dir: str
    max_images: int = 0


@dataclass
class RunManifest:
    run_id: str
    candidate_id: str
    timestamp: str
    split: str
    images_processed: int
    images_succeeded: int
    images_failed: int
    total_timing_ms: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PerImageMetrics:
    image_id: str
    schema_valid: bool
    wall_precision: float
    wall_recall: float
    wall_f1: float
    wall_endpoint_error: float
    door_f1: float
    window_f1: float
    obstruction_f1: float
    critical_zone_recall: float
    critical_zone_precision: float
    parse_error: Optional[str] = None
    timing_ms: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class MetricsSummary:
    candidate_id: str
    run_id: str
    schema_valid_rate: float
    wall_f1_mean: float
    door_f1_mean: float
    window_f1_mean: float
    obstruction_f1_mean: float
    critical_zone_recall_mean: float
    critical_zone_precision_mean: float
    wall_endpoint_error_mean: float
    hard_fail_rate: float
    p50_latency_ms: float
    p95_latency_ms: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class EvaluationResult:
    summary: MetricsSummary
    per_image: list[PerImageMetrics]
    failure_cases: list[str]
