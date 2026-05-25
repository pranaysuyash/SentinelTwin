# Claude Review Session — 2026-05-25

**What this is:** Three AI analysis documents generated during exploration discussion
(Documents 4, 5, 6 from context), plus Claude's synthesis of GenRecon as a reference.
These are read-only context. Canonical decisions derived from them live in
`Docs/architecture/` and `Docs/decisions/`.

---

## Document 4: Claude Architecture Synthesis

Key signals extracted (not all new — some already in architecture docs):

**Strong:**
- "Physical security intelligence workbench" framing — good product identity phrase
- Four connected systems: Security Scene Compiler → Coverage+Risk Simulation → Agentic
  Counterfactual Layer → Audit/Evidence/Compliance Layer
- "AI proposes, engine verifies, AI explains" rule — already in architecture/05
- SecurityScene as the only contract between layers — already in architecture/00

**New/not yet in docs:**
- "Security Evidence Twin" framing: product answers "can we prove the site met the required
  security outcome?" — not just "where are blindspots?" This is an explicit positioning option.
  See EXPLORATION_MAP.md Thread 20.
- Pascal integration seen as a clear path. SentinelTwin = Pascal spatial editor +
  security simulation layer + agentic audit layer.
  (Note: Pascal fork decision already made per PASCAL_EDITOR_DEEP_DIVE.md)
- ONVIF Profile M flagged as future camera/video integration standard (analytics metadata,
  object classification, geolocation, vehicle, license plate, human face/body).
  Already in architecture/05 as future consideration.

---

## Document 5: Contradiction Analysis (pre-coding gate check)

Five conflicts identified. Review each against current docs:

**Conflict 1: simulation dependency rule vs Three.js/BVH requirement**
- The PHASE_0_SETUP.md rule about packages/simulation having no dependencies was intended
  to mean "no UI/browser dependencies." It should not block three and three-mesh-bvh.
- Status: Check PHASE_0_SETUP.md. If still says `dependencies: {}`, clarify the intent.
  The simulation package may depend on three + three-mesh-bvh. It must not depend on React,
  R3F, Zustand, DOM/browser APIs.

**Conflict 2: DORIQuality naming vs OODPCVS standard**
- Architecture/03 should have the quality model. Check whether it uses DORI labels as
  internal types or standard-agnostic PPM internally. The OODPCVS IEC 62676-4:2025
  thresholds should be noted as pending verification.
- Note: Do not commit to specific PPM numbers from secondary sources.

**Conflict 3: SecurityScene nodes dictionary vs typed arrays**
- Architecture/00 uses typed arrays (cameras[], lights[], etc.).
  Architecture/01 may have the Pascal flat-dict pattern.
  There may be a mismatch — one or both should be authoritative.
  The architecture overview should be updated to be consistent.

**Conflict 4: Pascal extension details assumed before source audit**
- PASCAL_EDITOR_DEEP_DIVE.md is thorough but based on reading the repo, not forking it yet.
  Some implementation details may differ from what's described. Confirm on first build.

**Conflict 5: GSAP references in old docs vs licensing decision**
- OPEN_SOURCE_LICENSING.md correctly flags GSAP as needing a decision. It is NOT resolved.
  Old docs (Project Brief) reference GSAP. New code should not introduce GSAP until decision
  is made. But GSAP should NOT be pre-emptively removed from exploration docs.
  Keep it as an option. Decide at first animation implementation.

---

## Document 6: Product-First Framing Note

Core argument: The hackathon is a forcing function / first public milestone, not the product
boundary. Architecture decisions should be made for the long-term product, not for "smallest
MVP that looks good in a demo."

Key implication captured in architecture/00:
> "SentinelTwin is a physical security simulation platform... not a hackathon toy."

Additional implications for working style:
- When prioritizing what to build first: dependency order and product spine, not demo minimalism
- Long-term modules (scan input, video verification, compliance reports, agentic systems,
  MCP/A2A integration) should stay in exploration docs, not be cut from consideration
- "Every input becomes SecurityScene. Every simulation is deterministic. Every AI recommendation
  is verified. Every output becomes useful evidence." — useful north star sentence

---

## GenRecon Reference (added to EXPLORATION_MAP Thread 19 and AI_MODEL_PIPELINE Stage 4)

**Source:** https://kasothaphie.github.io/GenRecon/ | arXiv 2605.23888
**Why shared:** Shows that sparse-image indoor reconstruction quality is advancing faster than
our current VGGT/DUSt3R assumptions. We can build V0.4 guided scan mode with the assumption
that reconstruction quality will improve substantially even without needing the researchers'
proprietary resources.
**Disposition:** Logged in EXPLORATION_MAP Thread 19. Added to AI_MODEL_PIPELINE Stage 4.
VGGT remains the current implementation plan. GenRecon is the production upgrade path.
Code not yet released. License (Trellis.2) unverified.
