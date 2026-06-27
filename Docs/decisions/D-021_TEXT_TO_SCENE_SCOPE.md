# D-021: Text-to-Scope Scope (V0.2)

**Status:** Resolved
**Date:** 2026-07-04

## Decision

Text-to-scene (prompt-to-SecurityScene) is **scoped to the existing AI layout draft pipeline** for V0.2. No new prompt parsing or scene generation infrastructure is added.

## Scope

1. **Existing pipeline:** `ai-layout-draft.ts` already accepts a text prompt, calls an AI model (OpenAI/Gemini/Qwen), and produces a structured `SecurityScene` with walls, cameras, obstructions, zones, and paths.
2. **V0.2 fidelity target:** The AI draft should produce spatially coherent layouts where walls form closed perimeters, cameras face into the room, and obstructions are placed on walls or floors. Current fidelity is "medium" — rooms are recognizable but dimensions and alignments are approximate.
3. **No new model training.** The existing prompt engineering + structured output parsing is sufficient for V0.2. Fine-tuning on CubiCasa5K is V0.3 scope.
4. **Tier 2 cloud pass** (GPT-4o/Gemini 2.5 for precise geometry extraction from floor plans) is V0.3 scope.

## Rationale

1. **The existing pipeline works.** It produces valid SecurityScene objects that pass schema validation and can be simulated. The gap is spatial fidelity, not functionality.
2. **Floor-plan import is the higher priority.** Users can upload a floor plan image today and get a draft scene. The Tier 2 cloud pass would improve geometry extraction but is not a blocker for V0.2.
3. **Model experimentation is future work.** GGUF Qwen3.5-4B, SAM3, and PaddleOCR are research directions, not V0.2 commitments.

## Implications

- V0.2 ships with the current AI layout draft fidelity.
- Floor-plan import Tier 2 (GPT-4o/Gemini 2.5 pass) is tracked separately.
- Model experimentation and fine-tuning are V0.3+.
