# ChatGPT Exploration — SentinelTwin Origin

**Source:** Pranay's ChatGPT discussions (multiple sessions, May 2026)
**Preserved:** 2026-05-25
**Note:** Raw origin context. Canonical decisions synthesized into Docs/architecture/ and Docs/decisions/.

## Key signals extracted

- Core thesis: "Not where the camera points — what security outcome does this setup achieve?"
- DORI quality classification (detection / observation / recognition / identification) is real industry standard used by Axis, JVSG
- Counterfactual engine is the primary differentiator
- AI proposes → simulation verifies → AI explains (no hallucinated security recommendations)
- Model-agnostic pipeline: cheapest capable model per stage
- Visual layer (GLB/scan/splat) is separate from simulation truth (clean cuboids/planes)
- Physics (Rapier) for movement/collisions only — NOT for camera visibility computation
- Future V2: real camera feed attached to simulated camera → verify expected vs actual view
- Defensive framing only — never "avoid cameras", always "authorized security audit"

## Model pipeline consensus from exploration

| Stage | Primary | Backup |
|---|---|---|
| Scene understanding | Gemini 2.5 Flash / Qwen2.5-VL | MiniCPM-V |
| Object segmentation | SAM 3 | SAM 2 / Grounded-SAM |
| Depth estimation | Depth Anything V2 | UniDepth |
| Multi-photo 3D | VGGT | DUSt3R / MASt3R |
| Point cloud → structured room | SpatialLM | Open3D plane fitting |
| Security simulation | Three.js + three-mesh-bvh | — |
| Reasoning + report | OpenAI GPT-4o / Gemini Pro | Qwen / Llama |
| Voice | OpenAI Realtime / Gemini Live | Whisper + TTS |

Full raw conversation: `/Users/pranay/Projects/sentinaltwin_context.md`
