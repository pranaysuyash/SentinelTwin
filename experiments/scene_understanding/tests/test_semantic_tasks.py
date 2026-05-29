from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts import evaluate_semantic_tasks as semantic_tasks


def test_extract_classification_label_handles_explanatory_text():
    assert semantic_tasks.extract_classification_label("This looks like a retail_grocery store.") == "retail_grocery"


def test_score_classification_requires_exact_category_match():
    assert semantic_tasks.score_classification("retail_small_shop", "retail_small_shop")
    assert not semantic_tasks.score_classification("retail_small_shop", "warehouse")


def test_infer_scene_label_from_outputs_uses_semantic_hints():
    assert (
        semantic_tasks.infer_scene_label_from_outputs(
            "warehouse",
            '{"name": "Shelf 1", "type": "Shelf"}, {"name": "Counter", "type": "Counter"}',
            "The floor plan depicts a retail or exhibition area with shelves and a counter.",
        )
        == "retail_grocery"
    )
    assert (
        semantic_tasks.infer_scene_label_from_outputs(
            "retail_small_shop",
            '{"name": "Room 1", "type": "unknown"}',
            "The floor plan depicts a rectangular space with four distinct zones and two entrances on the left.",
        )
        == "corridor_lobby"
    )


def test_summarize_results_aggregates_classification_accuracy(monkeypatch):
    monkeypatch.setattr(
        semantic_tasks,
        "IMAGES",
        [
            Path("/tmp/retail_01_small_shop.png"),
            Path("/tmp/warehouse_01_racking.png"),
        ],
    )
    results = {
        "classification": {
            "retail_01_small_shop_minicpm_classification": "retail_small_shop",
            "warehouse_01_racking_minicpm_classification": "warehouse",
        },
        "ocr": {},
        "rooms": {},
        "adjacency": {},
        "description": {},
    }
    timings = {
        ("retail_01_small_shop", "minicpm", "classification"): 100.0,
        ("warehouse_01_racking", "minicpm", "classification"): 200.0,
    }

    summary = semantic_tasks.summarize_results(results, timings)

    assert summary["classification"]["minicpm"]["accuracy"] == 1.0
    assert summary["classification"]["minicpm"]["consensus_accuracy"] == 1.0
    assert summary["classification"]["minicpm"]["avg_latency_ms"] == 150.0
    assert summary["ocr"]["minicpm"]["non_empty_rate"] == 0.0
