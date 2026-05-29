# Floor Plan Understanding Pipeline Architecture

**Status:** Design proposal (2026-05-29)
**Based on:** Bakeoff results across 8 VLMs (geometry) + semantic task evaluation (MiniCPM vs GPT-4o)

## Key Finding

**Geometry extraction and scene understanding are different capability curves.**

Small VLMs (1.3B) are useless for precise geometry (wall F1=0.094) but genuinely useful for semantic tasks (scene classification, room detection, OCR, adjacency). Cloud VLMs (GPT-4o, Gemini) dominate geometry extraction but cost money and have latency.

The pipeline should exploit this gap.

## Proposed Two-Tier Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                     Input Image                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Local MiniCPM-V 4.6 (always runs)                  │
│                                                              │
│  Tasks:                                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Image Quality Assessment  ── blurry? → skip cloud │    │
│  │ 2. Scene Classification      ── retail/warehouse/... │    │
│  │ 3. OCR Text Extraction       ── room labels, dims    │    │
│  │ 4. Coarse Room Detection     ── zone count + layout  │    │
│  │ 5. Confidence Flag           ── "uncertain sections" │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Output: SemanticContext { scene_type, ocr_text,             │
│           room_count, zones[], confidence, quality_score }   │
│  Latency: ~5-15s (entirely on-device, no API cost)          │
└────────────────────┬────────────────────────────────────────┘
                     │  SemanticContext
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Gate Decision                                               │
│                                                              │
│  if quality_score < THRESHOLD: return "blurry, rescan"     │
│  if scene_type == "unknown": elevate to human review        │
│  if confidence == "low_clutter": force cloud geometry pass  │
│  else: proceed to Tier 2 with context                       │
└────────────────────┬────────────────────────────────────────┘
                     │  SemanticContext (enriched)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Tier 2: Cloud API (GPT-4o / Gemini 2.5 Flash)             │
│                                                              │
│  Prompt includes:                                            │
│  - Scene type from Tier 1 (e.g. "This is a warehouse")      │
│  - OCR text from Tier 1 ("Rooms: Office, Storage, Loading") │
│  - Ambiguity flags from Tier 1                              │
│                                                              │
│  Tasks:                                                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 1. Precise Wall Extraction     ── F1 ~0.95         │    │
│  │ 2. Door/Window Detection       ── F1 0.2-0.7      │    │
│  │ 3. Obstruction Detection       ── F1 0.4-0.9      │    │
│  │ 4. Critical Zone Identification                     │    │
│  │ 5. Detailed Adjacency Graph    ── 10-20 edges      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Output: SecuritySceneSubset (full structured geometry)      │
│  Latency: ~3-12s (cloud API cost varies)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-Processing                                              │
│                                                              │
│  - Validate cloud output against Tier 1 coarse room count    │
│    (if cloud says 15 walls but Tier 1 saw 3 zones → flag)   │
│  - Attach Tier 1 OCR text to relevant rooms/zones           │
│  - Verify adjacency consistency                             │
│  - Bundle into final SecuritySceneSubset                    │
└─────────────────────────────────────────────────────────────┘
```

## Performance Budget

| Stage | Model | P50 Latency | Cost | Quality |
|---|---|---|---|---|
| Tier 1: Classification | MiniCPM-V 4.6 | ~2s | $0 | 80% coarse accuracy |
| Tier 1: OCR | MiniCPM-V 4.6 | ~5-8s | $0 | Correct no-text detection |
| Tier 1: Room detection | MiniCPM-V 4.6 | ~7-16s | $0 | Conservative but consistent |
| Tier 1: Adjacency | MiniCPM-V 4.6 | ~2-5s | $0 | Sparse, directionally correct |
| Tier 1: Description | MiniCPM-V 4.6 | ~8-10s | $0 | Reasonable summaries |
| Tier 2: Geometry | GPT-4o | ~5-8s | ~$0.01 | Wall F1=0.964 |
| Tier 2: Adjacency | GPT-4o | ~2-4s | ~$0.005 | Dense, structured |
| **Total pipeline** | both | **~15-30s** | **~$0.015** | **Best of both** |

Without Tier 1 gating, every image costs $0.01-0.02 for the cloud API.
With Tier 1 gating, blurry/noisy images are rejected before reaching the cloud.

## What Local Models Actually Contribute

| Task | Value | Works? |
|---|---|---|
| Scene classification | ✓ | Biased but consistent. Coarse types work (warehouse vs retail). Fine-grained needs labels. |
| OCR / text extraction | ✓ | Correctly detects presence/absence of text. With real labels, would read room names/dimensions. |
| Coarse zone detection | ✓ | Identifies functional zones (9/9 on warehouse). Useful cross-check for cloud output. |
| Quality assessment | ✓ | Can detect "no text" → "this might be synthetic or missing labels" |
| Adjacency | ⚠ | Sparse but directionally correct. Better than nothing without cloud. |
| Precise geometry | ✗ | Wall F1=0.094. Cannot do this. Cloud required. |
| Detailed adjacency | ✗ | GPT-4o produces 3x more edges with structured JSON. |
| Critical zones | ✗ | CZ recall=0 for all local models. |

## Fallback Chain

```
Local MiniCPM-V 4.6
  ↓ (if structured output needed)
GPT-4o (primary cloud)
  ↓ (if GPT-4o fails or is rate-limited)
Gemini 2.5 Flash (fastest cloud fallback)
  ↓ (if max precision needed)
Gemini 2.5 Pro (highest ceiling)
  ↓ (if all fail)
Return SemanticContext only (coarse understanding, no geometry)
```

## Future Work

1. **GGUF quantization of Qwen3.5-4B** — could replace MiniCPM for Tier 1 with better accuracy at similar speed
2. **Couple MiniCPM's zone detection with SAM3** for zone-level segmentation masks
3. **Fine-tune MiniCPM on CubiCasa5K** for better room-type classification
4. **Add real-world training images** to replace synthetic-only evaluation

## References

- Bakeoff results: `experiments/scene_understanding/outputs/COMPARISON_REPORT.md`
- Semantic task evaluation: `experiments/scene_understanding/outputs/semantic_tasks/SEMANTIC_TASKS_REPORT.md`
- Model matrix: `Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md`
- Bakeoff plan: `Docs/experiments/V0_2_FLOORPLAN_UNDERSTANDING_BAKEOFF_PLAN.md`
