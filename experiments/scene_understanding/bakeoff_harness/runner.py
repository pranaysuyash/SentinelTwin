import json
import os
import time
from pathlib import Path
from typing import Optional
from .schema import SecuritySceneSubset, CandidateConfig, RunConfig, RunManifest, WallPrediction, DoorPrediction, WindowPrediction, ObstructionPrediction, CriticalZonePrediction

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = BASE_DIR / "data" / "images"
SPLITS_DIR = BASE_DIR / "data" / "splits"
OUTPUTS_DIR = BASE_DIR / "outputs"


def _build_scene_extraction_prompt() -> str:
    return """You are a floor plan analyzer. Given an image of a retail/commercial floor plan, extract the spatial layout into structured JSON.

Return ONLY valid JSON with this exact structure:
{
  "walls": [{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0}],
  "doors": [{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0, "class": "entry"}],
  "windows": [{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0, "class": "storefront"}],
  "obstructions": [{"x1": 0.0-1.0, "y1": 0.0-1.0, "x2": 0.0-1.0, "y2": 0.0-1.0, "class": "shelf|rack|counter|desk"}],
  "critical_zones": [{"polygon": [x1,y1,x2,y2,x3,y3,x4,y4], "zone_type": "cash_register|safe|server_room"}]
}

Rules:
- All coordinates in [0,1] normalized to image dimensions (0,0 = top-left, 1,1 = bottom-right)
- Walls are the building perimeter and any interior dividing walls
- Doors are gaps in walls with a door symbol (arc or line)
- Windows are thin blue/cyan lines on walls
- Obstructions are furniture, shelves, racks, counters, desks
- Critical zones are high-value areas marked with labels
- If a section has no items, use an empty array []
- Return ONLY the JSON object, no markdown, no explanation
"""


def _run_gpt4o_extraction(image_path: str, openai_api_key: str) -> SecuritySceneSubset:
    from openai import OpenAI
    import base64

    client = OpenAI(api_key=openai_api_key)

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    mime = "image/png"
    if image_path.endswith(".jpg") or image_path.endswith(".jpeg"):
        mime = "image/jpeg"

    start = time.time()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You extract structured spatial data from floor plan images."},
            {"role": "user", "content": [
                {"type": "text", "text": _build_scene_extraction_prompt()},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"}},
            ]},
        ],
        response_format={"type": "json_object"},
        temperature=0.0,
        max_tokens=4096,
    )
    elapsed = (time.time() - start) * 1000

    raw = response.choices[0].message.content or "{}"
    return _parse_response(raw, image_path, elapsed)


def _parse_response(raw: str, image_path: str, elapsed_ms: float) -> SecuritySceneSubset:
    img_id = Path(image_path).stem
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return SecuritySceneSubset(image_id=img_id, parse_error=f"JSON decode error: {e}", timing_ms=elapsed_ms)

    try:
        walls = [WallPrediction(**w) for w in data.get("walls", [])]
        def _parse_boxes(cls, items: list[dict]) -> list:
            result = []
            fields = {f.name for f in __import__("dataclasses").fields(cls)}
            for item in items:
                filtered = {}
                for k, v in item.items():
                    if k in fields:
                        filtered[k] = v
                    elif k == "class" and "class_" in fields:
                        filtered["class_"] = v
                if "x1" in filtered and "x2" in filtered:
                    result.append(cls(**filtered))
            return result

        doors = _parse_boxes(DoorPrediction, data.get("doors", []))
        windows = _parse_boxes(WindowPrediction, data.get("windows", []))
        obstructions = _parse_boxes(ObstructionPrediction, data.get("obstructions", []))
        critical_zones = [CriticalZonePrediction(**z) for z in data.get("critical_zones", [])]
    except (TypeError, KeyError) as e:
        return SecuritySceneSubset(image_id=img_id, parse_error=f"Schema mismatch: {e}", timing_ms=elapsed_ms)

    result = SecuritySceneSubset(
        image_id=img_id,
        walls=walls,
        doors=doors,
        windows=windows,
        obstructions=obstructions,
        critical_zones=critical_zones,
        raw_response=raw,
        timing_ms=elapsed_ms,
    )
    return result


def _run_local_transformer_extraction(image_path: str, candidate: CandidateConfig) -> SecuritySceneSubset:
    img_id = Path(image_path).stem
    from PIL import Image
    import transformers
    import torch

    model_id = candidate.components.get("vlm", {}).get("model_id", "")

    try:
        pipe = transformers.pipeline("image-to-text", model=model_id)
        start = time.time()
        image = Image.open(image_path).convert("RGB")
        result = pipe(image, generate_kwargs={"max_new_tokens": 2048, "temperature": 0.0})
        elapsed = (time.time() - start) * 1000
        generated_text = result[0]["generated_text"] if isinstance(result, list) and len(result) > 0 else str(result)
        return _parse_response(generated_text, image_path, elapsed)
    except Exception as e:
        return SecuritySceneSubset(image_id=img_id, parse_error=f"Inference error: {e}", timing_ms=0.0)


def run_candidate(config: RunConfig) -> RunManifest:
    candidate_id = config.candidate_id
    split = config.split
    output_dir = OUTPUTS_DIR / config.output_dir

    split_path = SPLITS_DIR / f"{split}.json"
    if not split_path.exists():
        raise FileNotFoundError(f"Split file not found: {split_path}")

    with open(split_path) as f:
        split_data = json.load(f)
    image_ids = split_data.get("images", [])
    if config.max_images > 0:
        image_ids = image_ids[: config.max_images]

    image_dir = IMAGES_DIR / split
    if not image_dir.exists():
        raise FileNotFoundError(f"Image directory not found: {image_dir}")

    from .candidates import get_candidate_config
    candidate = get_candidate_config(candidate_id)

    predictions: list[SecuritySceneSubset] = []
    os.makedirs(output_dir / "artifacts", exist_ok=True)

    api_key = os.environ.get("OPENAI_API_KEY", "")
    for img_id in image_ids:
        img_path = image_dir / f"{img_id}.png"
        if not img_path.exists():
            img_path = image_dir / f"{img_id}.jpg"
        if not img_path.exists():
            print(f"  [SKIP] {img_id}: image not found")
            continue

        print(f"  Processing {img_id}...")

        if candidate_id == "stack_b_gpt4o" and api_key:
            pred = _run_gpt4o_extraction(str(img_path), api_key)
        else:
            pred = _run_local_transformer_extraction(str(img_path), candidate)

        predictions.append(pred)

        art_dir = output_dir / "artifacts" / img_id
        os.makedirs(art_dir, exist_ok=True)
        with open(art_dir / "prediction.json", "w") as f:
            json.dump(pred.to_dict(), f, indent=2)

        status = "OK" if not pred.parse_error else f"FAIL ({pred.parse_error[:60]})"
        print(f"    -> {status}  ({pred.timing_ms:.0f}ms, {len(pred.walls)} walls, {len(pred.doors)} doors, {len(pred.obstructions)} obs)")

    succeeded = sum(1 for p in predictions if not p.parse_error)
    failed = sum(1 for p in predictions if p.parse_error)
    total_ms = sum(p.timing_ms for p in predictions)

    import uuid
    run_id = f"{candidate_id}_{split}_{uuid.uuid4().hex[:8]}"

    manifest = RunManifest(
        run_id=run_id,
        candidate_id=candidate_id,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        split=split,
        images_processed=len(predictions),
        images_succeeded=succeeded,
        images_failed=failed,
        total_timing_ms=total_ms,
    )

    with open(output_dir / "run_manifest.json", "w") as f:
        json.dump(manifest.to_dict(), f, indent=2)
    with open(output_dir / "predictions.jsonl", "w") as f:
        for p in predictions:
            f.write(json.dumps(p.to_dict()) + "\n")

    print(f"  Run complete: {run_id}")
    print(f"  {succeeded} succeeded, {failed} failed, {total_ms:.0f}ms total")
    return manifest
