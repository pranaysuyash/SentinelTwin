# AI Model Pipeline — Deep Dive

**Thread:** Exploration Map Thread 4
**Status:** Candidates identified; floorplan bakeoff harness now wired for hybrid/cloud traces
**Last updated:** 2026-05-29

---

## Pipeline Architecture Philosophy

Do NOT build SentinelTwin as one giant model call.
Build it as specialized models + deterministic geometry + scene graph + simulation + reasoning.

```
Input
→ Scene understanding        (VLM: what is in this image?)
→ Segmentation               (SAM: what exactly is this object?)
→ Depth/reconstruction       (metric depth → approximate 3D)
→ Semantic block extraction  (point cloud → walls/doors/objects)
→ Security simulation        (deterministic geometry — NOT AI)
→ Counterfactual testing     (AI proposes → sim verifies)
→ Report/explanation         (strong reasoning model)
```

Use expensive frontier models only at the edges (command parsing, report generation).
Use cheap/specialized models for repeated vision tasks in the middle.

---

## Stage 1: Scene Understanding — "What is in this image?"

**Task:** Given a floor plan image or site photo, return JSON with object labels and bounding boxes.
Objects: wall, door, window, shelf, cupboard, counter, pillar, camera, light, gate, entry point.

### Candidates

**Qwen2.5-VL** (primary candidate)
- Localizes objects with bounding boxes and coordinates
- Returns stable JSON
- Handles long videos/events
- Strong at "find the door, find the shelf, find the camera"
- Runs via API or self-hosted (7B, 72B variants)
- Cost: ~$0.001–0.005 per image on API

**Gemini 2.5 Flash** (strong alternative)
- Best video understanding in current benchmarks
- Strong spatial reasoning
- Good for multi-image or video floor plan understanding
- Integrated with Google's infrastructure
- Cost: comparable to Qwen API

**MiniCPM-V 4.5** (cheap/local option)
- Device-friendly, fast thinking mode
- Good for prototyping without API costs
- Quality gap vs Qwen/Gemini on spatial localization

**Florence-2** (lightweight baseline)
- MIT license, runs locally
- Prompt-based: detection, captioning, segmentation, grounding
- Fast and compact
- Quality lower than Qwen/Gemini for complex floor plans
- Good as a cheap fallback or preprocessing step

**Molmo / MolmoPoint** (pointing specialist)
- Pointing-style interaction: "point to the shelf"
- Useful for interactive tap-to-segment flow
- Not ideal for batch JSON extraction

### Bakeoff Plan

Test images: 10 floor plan photos (3 retail, 2 warehouse, 2 lobby, 2 corridor, 1 outdoor)
Prompt: "Find all security-relevant objects in this image. Return JSON with label, bounding box [x1,y1,x2,y2], confidence, and security role (wall/door/window/obstruction/camera/light/entry)."

For the V0.2 floorplan-specific harness, use the companion model matrix in `Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md` and the run traces emitted under `experiments/scene_understanding/outputs/<run_id>/artifacts/<image_id>/trace.json`.

Score:
- Object recall: how many real objects detected / total
- Precision: how many detections are correct / total detections
- JSON quality: valid JSON, correct schema, reasonable coordinates
- Latency: time to first token + total
- Cost: per image
- Reliability: does it fail silently, hallucinate objects, mis-label?

**Location:** `experiments/scene_understanding/`

### V0.1 Decision

V0.1 uses manual scene input only. This stage is V0.2.
Build the bakeoff harness early so we can plug in results when ready.

---

## Stage 2: Object Segmentation — "Give me the exact mask"

**Task:** Given an image + a bounding box or text prompt, return a precise pixel mask for the object.
Use case: user taps a cupboard in site photo → system segments it → clips it → estimates 3D box.

### Candidates

**SAM 3 / SAM 3.1** (primary)
- Meta's unified detection + segmentation + tracking model
- Text, exemplar, and visual prompts
- Tracks objects through video
- "Segment the cupboard", "track the person", "find cameras"
- Maps directly to SentinelTwin's "tap object → segment → classify → add to scene"
- Setup: more complex (requires GPU hosting or Hugging Face Space)

**SAM 2** (mature fallback)
- Production-grade, widely deployed
- Image + video segmentation
- Promptable with points or boxes
- Easier to deploy than SAM 3
- Very strong quality

**Grounded-SAM** (text → box → mask)
- Florence-2 or DINO for grounding (text prompt → bounding box)
- SAM for mask generation
- Good for "segment the shelf near the door"
- Two-model pipeline but both are lightweight

**Florence-2 + SAM** (cheap pipeline)
- Florence-2 handles detection/grounding
- SAM handles mask
- All MIT/open, can run locally
- Lower quality on complex scenes

### Recommendation

Use SAM 2 in V0.2 (it's stable, well-documented, has hosted inference).
Test SAM 3 in parallel. If it's significantly better and not too complex, switch.
Keep Grounded-SAM as the text-prompt flow.

### Key Note

The tap-to-segment UX must work even if segmentation is imperfect:
1. User taps object
2. System shows mask (even rough)
3. User confirms or adjusts mask boundaries
4. System creates obstruction node from bounding box of confirmed mask

The mask doesn't need to be pixel-perfect. It needs to be good enough to estimate 3D dimensions.

---

## Stage 3: Depth Estimation — "How far is this object?"

**Task:** From a single image or video, estimate per-pixel depth to approximate object positions.

### Why This Matters

Without depth, a floor plan photo gives us 2D positions. We need approximate 3D placement.
Key insight: we don't need metric accuracy. We need:
- Relative depth ordering (shelf is closer than wall)
- Scale anchored to one known dimension (door width = 0.9m → full scale)
- Good enough to place objects in SecurityScene

### Candidates

**Depth Anything V2** (primary)
- Significantly improved over V1
- Fast, robust, works on challenging scenes
- Monocular depth (single image)
- Multiple model sizes (Small/Base/Large)
- Available on Hugging Face

**Video Depth Anything** (for video input)
- Consistent depth across video frames
- Important for guided scan mode (V0.4)

**UniDepth / UniDepthV2** (metric depth)
- Attempts metric (real-world scale) depth estimation
- More useful than relative depth if camera intrinsics are known
- Harder to use reliably

**Apple Depth Pro** (sharp edges)
- Very clean depth edges
- Strong for architectural scenes (sharp wall boundaries)
- Requires Apple environment

**ZoeDepth / Metric3D** (alternatives for metric depth)
- Multiple metric depth models worth comparing in bakeoff

### Recommended Pipeline

```
Site photo + one known dimension (door width 0.9m)
→ Depth Anything V2 → relative depth map
→ Scale with known dimension → approximate metric depth
→ User corrects obviously wrong object positions
→ Objects placed in SecurityScene
```

Do not trust depth alone. Always require user confirmation for object placement.

---

## Stage 4: Multi-Photo 3D Reconstruction

**Task:** From 5–20 photos of a space, reconstruct camera poses + point cloud + depth.
Useful for guided scan mode and site capture without a dedicated 3D scanner.

### Candidates

**VGGT** (Visual Geometry Grounded Transformer — primary)
- Directly infers camera intrinsics/extrinsics, point maps, depth maps, 3D tracks
- Works with 1 to hundreds of views
- Seconds to run
- Very new, needs evaluation
- Could be the magic piece for "take 10 photos → get 3D scene"

**DUSt3R** (mature, well-documented)
- Two-view → 3D reconstruction
- Scales to many views
- Strong community, good results on indoor scenes
- Well-tested on architecture/indoor scenarios

**MASt3R** (MASt3R = Matching And Stereo 3D Reconstruction)
- Extends DUSt3R with better matching
- Strong for feature correspondence across many views

**COLMAP** (classical baseline)
- Structure-from-Motion: proven, widely used
- Much slower than neural approaches
- Gold standard for accuracy but not real-time
- Good as comparison baseline for bakeoff

**GenRecon (upgrade candidate — code not yet released)**
- arXiv 2605.23888, TU Munich + Huawei (May 2026)
- Sparse smartphone video / ~8 images → complete PBR-ready indoor mesh
- Uses Trellis.2 (Microsoft) generative prior lifted to scene scale
- Outperforms VGGT/DUSt3R/COLMAP class by ~16% on indoor benchmarks
- Key differentiator: fills occluded/unobserved areas (critical for security use case)
- Produces editable PBR geometry (good visual layer for client demos)
- Status: code not released. Monitor https://github.com/kasothaphie/GenRecon
- License risk: depends on Trellis.2 — verify before integration
- When available: likely becomes the production-grade replacement for VGGT in V0.4+
- Architecture rule still holds: GenRecon mesh = visual layer only, never raycasts on it

### Experiment Plan

Input: 5-photo set of one test room
Expected output: point cloud (PLY or numpy array of XYZ), camera poses
Test VGGT and DUSt3R. Compare:
- Point cloud quality (do walls/objects show up clearly?)
- Alignment accuracy (do multiple views stitch correctly?)
- Processing time
- Setup difficulty

Once GenRecon releases: add to bakeoff as the high-quality baseline.

**Location:** `experiments/multi_photo_3d/`

---

## Stage 5: Point Cloud → Semantic Room Structure

**Task:** From raw point cloud, extract: walls, doors, windows, furniture bounding boxes.
This is the "scene compiler" stage — messy 3D → clean SecurityScene blocks.

### Candidates

**SpatialLM** (primary — potentially game-changing)
- Processes 3D point cloud data
- Outputs walls, doors, windows, oriented object bounding boxes with semantic categories
- Handles point clouds from monocular video, RGBD, or LiDAR
- This is almost exactly what we need: point cloud → SecurityScene blocks
- Need to evaluate: setup complexity, quality on real indoor scenes, GPU requirements

**Open3D** (fallback)
- Point cloud cleanup: RANSAC plane fitting, normal estimation
- Oriented bounding boxes
- More manual: we write the logic to extract wall planes and object boxes
- Very reliable and well-documented
- Good backup if SpatialLM is complex to set up

**Shapely** (2D polygon cleanup)
- After projecting 3D to 2D floor plan
- Clean up polygons, detect rooms, snap to grid

**Trimesh** (mesh processing)
- Convert point cloud to mesh
- Decimation, cleanup, export

### Recommendation

Test SpatialLM first. If it works on a real indoor point cloud with reasonable setup,
it becomes the central "scene compiler." If not, fall back to Open3D + custom logic.

---

## Stage 6: Camera Spec Extraction

**Task:** From a camera model number, spec sheet PDF, or pasted text, extract FOV, resolution, IR range, night mode.

### Approach

For V0.1: Manual presets library (7 presets, covers 90% of use cases).
For V0.2: LLM spec sheet parsing.

```typescript
// User pastes: "Hikvision DS-2CD2T47G2-L 4MP AcuSense fixed turret, 4mm lens, 100° FOV, 60m IR"
// LLM extracts:
{
  resolutionMP: 4,
  fovHorizontalDeg: 100,
  nightMode: "ir",
  irRangeM: 60,
  lensType: "fixed",
  focalLengthMm: 4,
}
```

**Model for this:** Any strong LLM with structured output. GPT-4o, Gemini Flash, or even a
small local model. Camera spec extraction is a simple information extraction task.

---

## Stage 7: Reasoning, Counterfactual, and Report

**Task:** Explain coverage results. Propose fixes. Generate client reports. Parse commands.

### Candidates

**GPT-4o** (primary for V0.1)
- Structured Outputs (JSON schema enforcement) — critical for reliable SceneOperation parsing
- Strong reasoning for counterfactual proposals
- Good English prose for reports
- Tool calling for agentic workflows

**Gemini 2.5 Pro** (strong alternative)
- Very strong reasoning
- Long context window (useful for large SecurityScene JSONs)
- Cheaper than GPT-4o for some tasks
- May be better for spatial reasoning

**Qwen / InternVL** (cheap reasoning)
- Good cost/performance for simpler tasks (command parsing)
- Local deployment possible

### Key Rule

The reasoning model is given **verified simulation numbers** to work with.
It never invents coverage metrics. It explains, reasons, and writes about numbers that
the coverage engine already computed.

---

## Stage 8: Voice

**Task:** User speaks → system responds with scene changes + spoken explanation.

### Candidates

**OpenAI Realtime API**
- Speech-to-speech with tool calling
- Low latency
- Natural for "move Camera 1 left" → scene updates → AI speaks back

**Gemini Live API**
- Similar capability
- Multimodal (can look at the scene while responding)

**Whisper + TTS (fallback)**
- Whisper for STT
- Any TTS for response
- Not as natural but reliable and cheap

### V0.1 Plan

Text commands only. Voice is a polish feature for demo.
If adding voice for demo: OpenAI Realtime API with tool calling for SceneOperation.

---

## Model Bakeoff Summary Table

| Stage | V0.1 | V0.2+ | Bakeoff needed? |
|---|---|---|---|
| Scene understanding | Manual only | Qwen2.5-VL / Gemini Flash / local OCR+grounding stack | Yes — experiments/scene_understanding/ and `Docs/exploration/FLOORPLAN_UNDERSTANDING_MODEL_MATRIX.md` |
| Segmentation | Manual only | SAM 2 / SAM 3 | Yes — experiments/segmentation/ |
| Depth | Not used | Depth Anything V2 | No — clear winner |
| Multi-photo 3D | Not used | VGGT / DUSt3R | Yes — experiments/multi_photo_3d/ |
| Point cloud → room | Not used | SpatialLM / Open3D | Yes — experiments/point_cloud/ |
| Camera specs | Preset library | LLM extraction | No — presets first |
| Command parsing | GPT-4o | GPT-4o / Gemini | No — GPT-4o is clearly best for structured output |
| Counterfactual | GPT-4o | GPT-4o | No — see above |
| Report | GPT-4o | GPT-4o | No |
| Voice | None | OpenAI Realtime | No — Realtime is the obvious choice |
