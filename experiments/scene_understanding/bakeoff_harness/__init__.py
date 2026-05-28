from .schema import CandidateConfig, WallPrediction, DoorPrediction, WindowPrediction, ObstructionPrediction, CriticalZonePrediction, RunConfig, RunManifest, MetricsSummary, PerImageMetrics, SecuritySceneSubset
from .candidates import load_candidate_configs, get_candidate_config, CANDIDATE_REGISTRY
from .runner import run_candidate
from .evaluator import evaluate_predictions
from .summarizer import summarize_runs
