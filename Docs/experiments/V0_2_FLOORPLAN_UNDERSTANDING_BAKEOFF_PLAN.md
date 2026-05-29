# V0.2 Floorplan Understanding Bakeoff Plan

Status: Draft for immediate execution; harness upgraded with hybrid/cloud traces
Owner: Next implementation agent
Date: 2026-05-29
Related: D-015, D-021, Q-006, Q-007, Q-009
Model matrix companion: `Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md`

## 1) Why this bakeoff exists

SentinelTwin needs a practical floorplan-understanding stack that extracts a valid `SecurityScene` draft from floorplan images while preserving the canonical rule: AI proposes, deterministic simulation verifies.

This bakeoff does not pick a "best model" in the abstract. It picks the stack that most reliably produces edit-ready `SecurityScene` extraction with measurable geometry/semantic quality and acceptable latency/cost.

## 2) Scope of extraction for V0.2

Input:
- Raster floorplan image (`png`, `jpg`, `webp`) and optional user scale hint (one known length)

Output (draft SecurityScene fields only):
- `walls` (centerline or polygon projected to wall segments)
- `doors`
- `windows`
- `criticalZones` candidates (entry, counter/cash area, storage, aisle choke points)
- `obstructions` candidates (shelf, counter, pillar, partition, cupboard-like blocks)
- extraction metadata: confidence per object, provenance (`source: ai`), unresolved ambiguities

Explicitly out of scope for this bakeoff:
- direct camera placement optimization
- final simulation scores
- adversarial path output

## 3) Narrowed candidate stacks (implementation shortlist)

### Stack A (Baseline, strongly practical)
- Geometry + semantics: `Qwen/Qwen2.5-VL-7B-Instruct`
- Symbol OCR assist: `stepfun-ai/GOT-OCR2_0`
- Optional open-vocab detector pass: `IDEA-Research/grounding-dino-base`

Why shortlisted:
- Qwen2.5-VL is available in Transformers and supports robust multimodal prompting.
- GOT-OCR2 gives a unified OCR path for labels/room symbols often present in floorplans.
- Grounding DINO provides open-set detection for symbol prompts when VLM misses small elements.

### Stack B (Structured task prompting baseline)
- Main parser: `microsoft/Florence-2-base`
- Optional OCR pass: `stepfun-ai/GOT-OCR2_0`

Why shortlisted:
- Florence-2 supports prompt-controlled tasks (`<OD>`, `<OCR>`, region prompts) and built-in parsing utilities.
- Lower implementation complexity for deterministic staged prompts.

### Stack C (Floorplan-native research candidate)
- Vector reconstruction: `haopt/Raster2Seq` (CubiCasa5K checkpoint)
- Semantic repair pass: Qwen2.5-VL (text/image reconciliation)

Why shortlisted:
- Direct polygon-sequence floorplan reconstruction is highly aligned with SecurityScene geometry extraction.
- Useful as an "accuracy ceiling" candidate on clean floorplans.

## 3b) Stage-by-stage model matrix

The full stage breakdown, four-plus candidates per stage, and cloud fallback policy now live in:
- [Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md](/Users/pranay/Projects/SentinelTwin/Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md)

Use that document as the authoritative model matrix when implementing the harness. This bakeoff plan keeps the execution gate and acceptance criteria; the companion matrix keeps the per-stage candidate list fresh.

## 4) Candidates explicitly deprioritized for V0.2 harness

- Unvetted community fine-tunes without strong cards/evals as primary candidates
- Any model/toolchain with non-commercial or unclear licensing for product path
- Monolithic end-to-end agent-only parsing without intermediate artifacts (too hard to debug)

## 5) Fresh Hugging Face evidence snapshot (2026-05-26)

Primary evidence links:
- Qwen2.5-VL docs: https://huggingface.co/docs/transformers/main/en/model_doc/qwen2_5_vl
- Qwen2.5-VL-7B-Instruct card: https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct
- Florence-2 docs: https://huggingface.co/docs/transformers/model_doc/florence2
- Florence-2-base card: https://huggingface.co/microsoft/Florence-2-base
- GOT-OCR2 docs: https://huggingface.co/docs/transformers/model_doc/got_ocr2
- Grounding DINO docs: https://huggingface.co/docs/transformers/model_doc/grounding-dino
- Grounding DINO base card: https://huggingface.co/IDEA-Research/grounding-dino-base
- SAM2 docs/card (optional segmentation utility):
  - https://huggingface.co/docs/transformers/en/model_doc/sam2
  - https://huggingface.co/facebook/sam2-hiera-large
- WAFFLE paper page: https://huggingface.co/papers/2412.00955
- CubiCasa5K paper page: https://huggingface.co/papers/1904.01920
- Raster2Seq model page: https://huggingface.co/haopt/Raster2Seq
- FloorPlanCAD dataset page: https://huggingface.co/datasets/Voxel51/FloorPlanCAD
- FloorplanQA paper page: https://huggingface.co/papers/2507.07644

Evidence-derived constraints:
- Florence-2 output requires post-processing (`post_process_generation`) before structured scoring.
- Grounding DINO is open-set detection oriented, useful for targeted symbol finding.
- FloorPlanCAD indicates object-detection-ready floorplan data but is `cc-by-sa-4.0`; treat as eval-only unless product licensing policy confirms usage boundaries.
- FloorplanQA reinforces that generic LLM spatial reasoning is inconsistent without structure; scoring must emphasize geometry validity, not just label extraction.

## 6) Acceptance criteria tied to SecurityScene extraction

A run is "V0.2-acceptable" only if ALL pass:

1. Schema validity
- 100% of accepted outputs parse against draft extraction schema and SecurityScene subset mapper.
- No orphan references, NaN coordinates, negative dimensions.

2. Geometry fidelity (room/wall/door/window)
- Wall topology F1 >= 0.88 on curated eval split.
- Door/window detection F1 >= 0.80.
- Mean normalized wall endpoint error <= 0.04 of plan diagonal.

3. Semantic fidelity (security-relevant objects)
- Obstruction class macro-F1 >= 0.75 for subset: `shelf`, `counter`, `pillar`, `partition`, `cupboard`, `other`.
- Critical zone candidate recall >= 0.85 for mandatory zones (entry, cash/counter when present).

4. Operational quality
- P95 end-to-end parse latency <= 12s on target inference setup.
- Per-image failure rate (hard parse fail) <= 5%.
- Cost envelope documented and predictable per image.

5. Reviewability and correction readiness
- Every object carries confidence and provenance.
- Output includes explicit ambiguity list for human review UI (Q-007 compatibility).

## 7) Dataset plan for bakeoff

Curate `n=60` floorplans for V0.2 bakeoff:
- 30 clean digital plans
- 20 noisy scans/photos
- 10 cluttered/annotated broker-style plans

Split:
- dev: 20
- validation: 20
- test: 20

Annotation contract:
- Ground truth stored in `experiments/scene_understanding/data/annotations/` as canonical JSON with room scale metadata.
- At least 2-reviewer adjudication for walls/doors/windows on test split.

## 8) Experiment workflow (harness contract)

For each candidate stack:
1. Run parser -> intermediate artifacts (`detections`, `ocr`, `polygons`, `json_draft`)
2. Map to SecurityScene subset schema
3. Run evaluator against annotations
4. Emit:
- per-image metrics
- aggregate metrics
- failure taxonomy
- latency/cost profile
- per-image `trace.json` artifacts documenting OCR, grounding, and fallback choices

Required output files per run:
- `outputs/<run_id>/metrics_summary.json`
- `outputs/<run_id>/per_image_metrics.jsonl`
- `outputs/<run_id>/failure_cases.md`
- `outputs/<run_id>/sample_visual_overlays/`

## 9) Decision gate for D-015

Promote a stack to default V0.2 only if:
- It meets all acceptance criteria in Section 6 on test split
- It has a clear, acceptable license path for SentinelTwin
- It demonstrates stable behavior on noisy scans, not only clean CAD-like images

If no stack passes:
- choose best geometry stack + best semantic stack hybrid and re-run targeted round
- do not ship model-only output without human review gating

## 10) Immediate next implementation tasks

1. Extend the config-driven harness in `experiments/scene_understanding/scripts/` with stage traces and cloud/local fallback dispatch.
2. Implement `SecuritySceneSubset` schema + mapper.
3. Add deterministic evaluator for geometry + semantics metrics.
4. Harden the visual critical-zone repair stage so the extracted polygons survive into saved predictions and metric evaluation.
5. Run pilot on 5 images to validate pipeline reliability before full 60-image bakeoff.

Completed in the current run:
- The visual repair stage is now implemented in `runner.py`.
- The repair path is regression-tested in `experiments/scene_understanding/tests/test_visual_critical_zone.py`.
- The 5-image dev pilot has been executed and the comparison report was regenerated from real runs.
