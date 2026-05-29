from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bakeoff_harness.runner import _detect_colored_filled_regions


DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "images" / "dev"


def _zone_polygon(path: str) -> list[float]:
    zones = _detect_colored_filled_regions(str(DATA_DIR / path))
    assert zones, f"expected at least one critical-zone candidate for {path}"
    return zones[0]["polygon"]


def test_retail_critical_zone_is_detected():
    polygon = _zone_polygon("retail_01_small_shop.png")
    assert polygon == [
        0.13333333333333333,
        0.65,
        0.3333333333333333,
        0.65,
        0.3333333333333333,
        0.85,
        0.13333333333333333,
        0.85,
    ]


def test_grocery_critical_zone_is_detected():
    polygon = _zone_polygon("retail_02_grocery.png")
    assert polygon == [
        0.4,
        0.5833333333333334,
        0.8,
        0.5833333333333334,
        0.8,
        0.75,
        0.4,
        0.75,
    ]


def test_warehouse_does_not_emit_false_zone():
    zones = _detect_colored_filled_regions(str(DATA_DIR / "warehouse_01_racking.png"))
    assert zones == []
