## New Questions — Added 2026-05-25

### Q-016 [P0]: IEC 62676-4:2025 OODPCVS — exact PPM thresholds for all 7 levels?
The new standard (October 2025) replaces DORI with a 7-level framework.
We have approximate PPM equivalents but need the exact IEC-specified values.
**Source to check:** IEC 62676-4:2025 document (paid), or JVSG's implementation
(they published support in October 2025), or Axis's blog post on the standard.
**Impact:** Core to coverage engine quality scoring. Must be correct before claiming
IEC 62676-4:2025 compliance in any report output.

### Q-017 [P1]: GSAP → Framer Motion replacement — what exactly needs to change?
GSAP's license prohibits SaaS use without paid Club GSAP license.
Replacement: `motion` (Framer Motion v11, MIT).
**Research needed:** Which specific GSAP APIs does the current architecture doc reference?
Map each to Framer Motion equivalent. Update architecture/07 RENDERING_PIPELINE.md.

### Q-018 [P1]: DUSt3R/MASt3R are CC BY-NC — confirm VGGT is a viable replacement.
DUSt3R and MASt3R are CC BY-NC-SA 4.0 — cannot be used commercially.
VGGT claims MIT license. Verify: check actual GitHub license file, not just README.
**Impact:** If VGGT is MIT, it's the V0.3 multi-photo 3D engine.
If VGGT is also non-commercial, we need COLMAP (BSD) as the fallback.

### Q-019 [P0]: IEC 62676-4:2025 — update quality model from DORI to OODPCVS.
The simulation must use the current standard. Old DORI (4 levels) was superseded October 2025.
**Action required:**
- Update `qualityScoring.ts` to support OODPCVS (7 levels) as default
- Keep DORI (4 levels) as legacy option in SimulationAssumptions
- Update DECISION_LOG.md with this as D-010 when resolved

### Q-020 [P1]: GDPR DPA report formats — what does each DPA actually require?
UK ICO, French CNIL, German BfDI each have different documentation requirements.
CNIL is most aggressive on enforcement (€200k+ in fines 2025/2026).
**Research:** Find the official guidance from each DPA on camera system documentation.
Then design report templates for each.

### Q-021 [P1]: Insurance underwriters — which carriers explicitly ask for camera coverage documentation?
Name specific carriers if possible. This is a B2B distribution channel, not just market context.
**Research approach:** Talk to security consultants who do insurance audits.
Look for commercial property insurance questionnaires that include camera coverage questions.

### Q-022 [P2]: PCI DSS Section 9 — exact camera coverage requirements?
PCI DSS requires video cameras/access controls for sensitive areas.
What exactly does it specify? What zones require what quality?
**Impact:** Retail-specific compliance report format.

### Q-023 [P1]: IFC open-source parsers — quality and completeness?
`ifcopenshell` (Python, LGPL) and `web-ifc` (JS/WASM, MIT) are the main options.
**Research:** Can either extract walls, doors, windows, and room geometries reliably
from real-world BIM files? What does the output look like?
**Impact:** V0.4 BIM import feature.

### Q-024 [P2]: NVIDIA Omniverse + Gaussian splat — does it overlap or complement?
NVIDIA is positioning Omniverse as a "digital twin platform."
Siemens announced Omniverse integration in January 2025.
**Research:** What does Omniverse provide? Is SentinelTwin a plugin for it or a competitor?
Could we integrate SentinelTwin's simulation as an Omniverse extension?

### Q-025 [P2]: OpenAI Agents SDK — multi-agent parallel execution in browser vs server?
SentinelTwin's AI pipeline runs in Next.js API routes (server-side).
Can the Agents SDK orchestrate agents that call back into the browser for simulation results?
Or does the simulation always run server-side in a worker?
**Impact:** Architecture of the command→verify→explain loop.
