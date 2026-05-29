# Floorplan Understanding Model Matrix

**Status:** Active exploration
**Date:** 2026-05-29
**Scope:** V0.2 floorplan photo / scan understanding for `SecurityScene` extraction
**Related:** `Docs/experiments/V0_2_FLOORPLAN_UNDERSTANDING_BAKEOFF_PLAN.md`, `Docs/exploration/AI_MODEL_PIPELINE.md`, `Docs/decisions/OPEN_QUESTIONS.md` Q-006, Q-007, Q-009

## Purpose

This document breaks the floorplan-understanding flow into concrete pipeline parts with:
- at least 4 local/open candidates per part,
- cloud fallbacks using OpenAI and Gemini,
- stage-specific evaluation metrics,
- selection criteria for the bakeoff harness.

The goal is not to crown a universal winner. The goal is to produce an implementation-ready harness that can pick the best stage combination for `SecurityScene` extraction and keep a deterministic simulation gate behind it.

## Pipeline Map

1. OCR and label reading
2. Layout and scene understanding
3. Open-vocab grounding and detection
4. Segmentation and mask extraction
5. Structured repair and `SecurityScene` mapping
6. Cloud fallback policy

## 1) OCR and Label Reading

**Job:** extract room names, dimensions, symbols, annotations, and label text from floorplan images.

**Best-fit local/open candidates:**
- `lightonai/LightOnOCR-2-1B-base`
- `PaddlePaddle/PaddleOCR-VL`
- `microsoft/trocr-base-printed`
- `naver-clova-ix/donut-base`

**Why these are relevant:**
- LightOnOCR and PaddleOCR-VL are current doc-centric OCR models optimized for dense pages and scans.
- TrOCR is a stable printed-text OCR baseline.
- Donut gives OCR-free document understanding and can act as a useful structured-text baseline when OCR plumbing is noisy.

**Eval metrics:**
- character error rate on floorplan labels,
- symbol/legend recall,
- room-name exact match,
- measurement extraction accuracy,
- runtime per image.

**Failure modes to watch:**
- missing tiny labels near wall lines,
- misreading dimension units,
- hallucinating text where the plan is just a hatch pattern.

## 2) Layout and Scene Understanding

**Job:** interpret the full image as a spatial scene, infer walls, room boundaries, doors, windows, and candidate block objects.

**Best-fit local/open candidates:**
- `Qwen/Qwen2.5-VL-7B-Instruct` — evaluated (wall F1=0.661, very slow on MPS at 86s/image)
- `openbmb/MiniCPM-V-4.6` — evaluated (wall F1=0.094, too small for floor plans)
- `Qwen/Qwen3.5-4B` — natively multimodal (4B, Apache 2.0), MPS-infeasible (>15min/image)
- `openbmb/MiniCPM-o-4.5` — strongest open-source near 9B (Apache 2.0), needs CUDA
- `google/gemma-4-e4b-it` — MoE (4B active, ~30B total), needs quantization
- `mistralai/Pixtral-12B-2409`
- `OpenGVLab/InternVL3-8B`

**Why these are relevant:**
- Qwen2.5-VL explicitly advertises visual localization and structured outputs.
- MiniCPM-V 4.6 is compact enough to be an efficient baseline while still strong on general visual reasoning.
- Pixtral handles natural-resolution images and long-context multimodal reasoning well.
- InternVL3 is a strong open multimodal family for higher-ceiling scene understanding.

**Eval metrics:**
- wall topology F1,
- door/window F1,
- room adjacency accuracy,
- normalized wall endpoint error,
- object class accuracy for broad scene labels.

**Failure modes to watch:**
- inventing impossible wall connections,
- confusing internal partitions with outer walls,
- misclassifying aisles or counters as walls.

## 3) Open-Vocab Grounding and Detection

**Job:** find specific floorplan entities from prompts, like "cash counter", "shelf", "door", "window", "pillar", "storage block".

**Best-fit local/open candidates:**
- `microsoft/Florence-2-base`
- `IDEA-Research/grounding-dino-base`
- `google/owlv2-base-patch16-ensemble`
- `openmmlab-community/mm_grounding_dino_base_all`

**Why these are relevant:**
- Florence-2 gives prompt-controlled grounding and structured post-processing.
- Grounding DINO is strong open-vocabulary zero-shot detection.
- OWLv2 is a robust zero-shot text-conditioned detector.
- MM Grounding DINO is a newer multimodal grounding path worth benchmarking alongside standard Grounding DINO.

**Eval metrics:**
- prompt-conditioned box precision/recall,
- box IoU on annotated entities,
- mAP@0.5 for critical object prompts,
- top-k recall for rare object classes.

**Failure modes to watch:**
- missing small but important objects,
- overfitting to common furniture shapes,
- poor box alignment on rotated plans.

## 4) Segmentation and Mask Extraction

**Job:** produce masks for regions and objects when box-level grounding is not enough, especially for partitions, shelves, and large obstructions.

**Best-fit local/open candidates:**
- `facebook/sam3`
- `facebook/sam2-hiera-large`
- `facebook/mask2former-swin-large-coco-instance`
- `shi-labs/oneformer_coco_swin_large`

**Why these are relevant:**
- `facebook/sam3` is the new promptable concept segmentation model and the best future-facing segmentation candidate.
- `facebook/sam2-hiera-large` is still the safe promptable segmentation baseline.
- `facebook/mask2former-swin-large-coco-instance` and `shi-labs/oneformer_coco_swin_large` are strong universal segmentation frameworks for semantic/instance/panoptic tasks.

**Eval metrics:**
- mask IoU,
- boundary F-score,
- instance coverage recall,
- user-correction efficiency after auto-mask generation.

**Failure modes to watch:**
- masks that bleed across walls or furniture,
- unstable small-object segmentation,
- over-segmentation on dense plans.

## 5) Structured Repair and `SecurityScene` Mapping

**Job:** convert OCR, detections, and masks into clean, schema-valid draft output for `SecurityScene` extraction.

**Best-fit local/open candidates:**
- `PaddlePaddle/PP-DocLayoutV3_safetensors`
- `microsoft/layoutlmv3-base`
- `microsoft/table-transformer-structure-recognition`
- `google/pix2struct-base`
- `naver-clova-ix/donut-base`

**Why these are relevant:**
- PP-DocLayoutV3 is a current layout-analysis model with instance segmentation and reading-order support.
- LayoutLMv3 is still a useful multimodal document-layout baseline.
- Table Transformer is good for structured region inference and serves as a reliable layout-structure check.
- Pix2Struct is useful for screenshot-style visual parsing into structured text.
- Donut remains a strong OCR-free structural extraction baseline.

**Eval metrics:**
- schema validity rate,
- orphan-reference rate,
- NaN / negative-coordinate rejection rate,
- coordinate normalization error,
- round-trip consistency after mapper normalization.

**Failure modes to watch:**
- valid-looking JSON with wrong geometry,
- skipped nodes during mapping,
- scale drift when plans are rotated or cropped.

## 6) Cloud Fallback Policy

**Primary cloud fallbacks:**
- OpenAI `gpt-4.1`
- OpenAI `gpt-4o`
- Gemini `gemini-2.5-flash`
- Gemini `gemini-2.5-pro`

**Why these are the right fallbacks:**
- OpenAI Responses API supports text and image inputs plus Structured Outputs.
- GPT-4.1 is strong on instruction following and tool use.
- GPT-4o is still the broad flagship multimodal fallback.
- Gemini 2.5 Flash gives a fast, price-performance fallback.
- Gemini 2.5 Pro is the higher-ceiling multimodal fallback for hard cases.

**How fallbacks should be used:**
- Keep local/open models as first-pass candidates for privacy, reproducibility, and cost control.
- Use cloud fallbacks as the quality ceiling and as a rescue path for ambiguous or noisy scans.
- Compare local vs cloud outputs with the same evaluator, not separate rubrics.
- Do not let cloud fallback skip human review or schema validation.

**Cloud eval metrics:**
- same stage metrics as local models,
- plus provider latency,
- dollar cost per successful extraction,
- schema pass rate under strict output format.

## 7) Evaluation Policy

The harness should score each candidate stage independently and then run the end-to-end mapper on the best combinations.

### Stage scores

- OCR stage: `0.30` label accuracy, `0.25` symbol recall, `0.20` CER, `0.15` latency, `0.10` cost
- Layout stage: `0.35` wall/door/window F1, `0.20` adjacency accuracy, `0.20` normalized geometry error, `0.15` latency, `0.10` cost
- Grounding stage: `0.40` prompt box recall, `0.25` IoU, `0.15` rare-class recall, `0.10` latency, `0.10` cost
- Segmentation stage: `0.40` mask IoU, `0.20` boundary score, `0.20` instance recall, `0.10` latency, `0.10` cost
- Repair stage: `0.45` schema validity, `0.25` normalized coordinate error, `0.15` round-trip consistency, `0.10` latency, `0.05` cost

### End-to-end gate

An image batch only passes V0.2 candidate acceptance when:
- schema validity is 100 percent on accepted outputs,
- wall topology F1 meets the plan threshold,
- door/window and obstruction thresholds meet the plan threshold,
- the ambiguity list is present for every uncertain object,
- the pipeline is stable on noisy scans, not just clean digital plans.

### Selection rule

- Pick the cheapest model that passes the threshold for a stage.
- If a local model fails on noisy scans, compare it to cloud fallback and note the delta.
- If multiple models pass, keep the one with the best combined score and the cleanest error profile.

## 8) Harness Implication

The bakeoff harness should treat these stages as separately swappable modules:
- `ocr`
- `layout_parser`
- `grounding`
- `segmentation`
- `repair`

This makes it possible to evaluate a hybrid stack instead of forcing one model to do everything.

Hybrid examples worth testing:
- `lightonai/LightOnOCR-2-1B-base` + `Qwen2.5-VL-7B-Instruct` + `facebook/sam2-hiera-large`
- `PaddlePaddle/PaddleOCR-VL` + `microsoft/Florence-2-base` + `shi-labs/oneformer_coco_swin_large`
- `OpenGVLab/InternVL3-8B` + `IDEA-Research/grounding-dino-base` + `PaddlePaddle/PP-DocLayoutV3_safetensors`
- `mistralai/Pixtral-12B-2409` + `google/owlv2-base-patch16-ensemble` + `microsoft/layoutlmv3-base`

## 9) Practical Recommendation

## 2026-05-29 Update: MPS Hardware Constraint

Local models >=4B params cannot run practically on Apple Silicon (MPS):
- Qwen2.5-VL-7B: 86s/image P50 — barely feasible
- MiniCPM-V 4.6 (1.3B): 96s/image P50 — surprisingly slow for its size  
- Qwen3.5-4B: >15min/image — not feasible
- MiniCPM-o 4.5 (9B): estimated >20min/image — not feasible
- Gemma 4 E4B (~30B): requires 4-bit quantization

**Recommendation:** Evaluate MPS-infeasible models via GGUF quantization (ollama/llama.cpp) or cloud API only.

For the first pilot, start with two local baselines and one cloud control:
- OCR: `lightonai/LightOnOCR-2-1B-base` and `PaddlePaddle/PaddleOCR-VL`
- Layout parsing: `Qwen2.5-VL-7B-Instruct`
- Grounding: `microsoft/Florence-2-base` and `IDEA-Research/grounding-dino-base`
- Segmentation: `facebook/sam2-hiera-large`
- Repair: `PaddlePaddle/PP-DocLayoutV3_safetensors`
- Cloud control: `gpt-4o` or `gemini-2.5-flash`

That gives the harness a cheap baseline, a strong open-source ceiling, and a cloud control to measure the gap.
