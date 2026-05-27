# Standards, Compliance & Regulatory Landscape

**Status:** Research complete — 2026-05-25
**Purpose:** Document every standard and regulation SentinelTwin should know,
implement, or produce evidence for. This is not optional reading — compliance
is a product feature and a market entry requirement.

---

## IEC 62676-4:2025 — The Standard SentinelTwin Is Built On

### What changed in October 2025

On 9 October 2025, IEC published the updated IEC 62676-4:2025, replacing IEC 62676-4:2014 and representing a major step forward in how video surveillance systems are planned, specified, installed, validated, and operated over their full lifecycle.

This is the most important standard change for SentinelTwin. The old DORI framework (Detection/
Observation/Recognition/Identification) from 2014 has been superseded.

### The New Framework: OODPCVS

According to IEC 62676-4:2025, the operational requirements in video surveillance are overview, outline, discern, perceive, characterize, validate, and scrutinize.

New 7-level framework replacing 4-level DORI:

| Old DORI (2014) | New OODPCVS (2025) | PPM equivalent (approximate) |
|---|---|---|
| Detection | Overview | ~25 PPM |
| — | Outline | ~50 PPM |
| Observation | Discern | ~62.5 PPM |
| — | Perceive | ~100 PPM |
| Recognition | Characterize | ~125 PPM |
| Identification | Validate | ~250 PPM |
| — | Scrutinize | ~500 PPM |

The IEC/EN 62676-4:2025 establishes more realistic minimum pixel densities for various object sizes, taking into account modern digital IP cameras' capabilities and constraints, such as compression and noise. The previous version specified a number of pixels per meter not always sufficient to identify people, especially in low light conditions, or when the image is blurred due to motion.

### What this means for SentinelTwin's quality model

**Critical update needed in V0.1 design:**

The coverage engine is currently designed around DORI (2014 — 4 levels).
The current standard is OODPCVS (2025 — 7 levels).

SentinelTwin should:
1. Support both DORI and OODPCVS (selectable in SimulationAssumptions)
2. Default to OODPCVS for new installations (compliant with current standard)
3. Use DORI for compatibility with legacy reports and older installers
4. Clearly label which standard each report uses

**The 2025 standard also adds:**
- Updated guidance on cybersecurity requirements for connected cameras
- New emphasis on lifecycle management and operational validation
- Updated camera placement guidelines for lighting and environmental factors

### Relationship to insurance and legal

JVSG (the leading desktop CCTV design tool) immediately announced support for IEC 62676-4:2025 in October 2025. For professional security planners, using the current standard is a professional requirement. Reports generated with old DORI thresholds may not be legally defensible.

**SentinelTwin must implement IEC 62676-4:2025 (OODPCVS) before claiming professional-grade simulation.**

---

## IEC 62676 Family — Full Reference

| Standard | What it covers | SentinelTwin relevance |
|---|---|---|
| IEC 62676-1-1 | System requirements — general | Understand minimum VSS requirements |
| IEC 62676-1-2 | Performance requirements for video transmission | Camera quality thresholds |
| IEC 62676-2-11:2024 | VMS/VSaaS interoperability | Future ONVIF / VMS integration |
| **IEC 62676-4:2025** | **Application guidelines (OODPCVS)** | **Core standard — implement this** |
| IEC 62676-5 | Image quality performance for cameras | Camera preset quality validation |
| ISO/IEC 30137-1 | Biometrics in video surveillance | Face recognition quality thresholds |

---

## ONVIF Standards — Future Integration

**ONVIF Profile S** (streaming): live video, PTZ, audio. Needed for V2+ real camera integration.

**ONVIF Profile T** (advanced streaming): H.265, metadata, event handling. More complete.

**ONVIF Profile M** (metadata): object classification, geolocation, vehicles, license plates, human faces, bodies. This is the analytics metadata format for V2+ real camera verification.

**What SentinelTwin needs from ONVIF:**
- Profile G for recording/playback (attaching real recordings to simulated cameras)
- Profile M metadata for comparing real AI analytics output with simulated DORI zones

**When to implement:** V2 (real camera verification). Not needed for V0 or V1.

---

## Insurance Requirements — Camera Coverage Documentation

### Current state (2025–2026)

Insurance underwriters are increasingly factoring camera coverage quality into commercial property premiums. Key emerging requirements:

**What insurers are starting to ask for:**
- Camera coverage maps showing which zones are covered
- Evidence that entry/exit points are covered at minimum "recognition quality"
- Proof of camera redundancy for high-value zones
- Documentation of night/low-light coverage adequacy
- Annual review of coverage vs current building layout

**Relevant insurance categories:**
- Commercial Property: retail, warehouse, office
- Business Interruption: if an incident wasn't captured on camera, insurance may not pay
- Directors & Officers: security gaps can constitute negligence if documented and unaddressed
- Cyber-Physical: converged insurance covering both cyber and physical security

### What SentinelTwin produces that insurers want

```
Security Coverage Attestation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Site: [facility name]
Date: [date]
Standard: IEC 62676-4:2025

Critical Zone Coverage:
✅ Main Entry: Identification quality (OODPCVS Validate)
⚠️ Cash Counter: Recognition quality (OODPCVS Characterize) — below required Validate
✅ Loading Bay: Detection quality (OODPCVS Overview) — meets requirement
❌ Side Entrance: No coverage — immediate remediation required

Camera Redundancy:
✅ Cash Counter: 2 cameras (Camera 1 + Camera 3)
❌ Loading Bay: 1 camera only (Camera 2) — single point of failure

Night Coverage: ✅ All zones within IR range of active cameras
Coverage Score: 78/100
Robustness Score: 62/100

Generated by SentinelTwin vX.X | Standard: IEC 62676-4:2025
```

This is exactly the format an insurer would want. And it's defensible because it's
based on deterministic simulation with explicit standards reference.

### The coverage gap → insurance liability connection

If a security planner produces a SentinelTwin audit showing "Side Entrance has no coverage —
immediate remediation required" and the facility does nothing, and then an incident happens at
the side entrance — that's documented negligence.

This cuts both ways:
- For the facility: SentinelTwin protects them by proving they audited and fixed
- For the security planner: SentinelTwin proves they identified the gap (professional protection)

---

## GDPR / Privacy Regulations — Camera Placement Compliance

Documented in ADJACENT_SPACE_TAM_INDUSTRY.md. Summary of standard requirements:

| Regulation | Region | Camera-specific requirement |
|---|---|---|
| GDPR | EU/EEA | Purpose limitation, proportionality, privacy zones, retention limits, DPIA for new systems |
| UK GDPR | UK | Same as GDPR post-Brexit, ICO enforcement |
| CCPA / CPRA | California | Disclosure requirements, right of access to footage |
| PDPA | India | Camera disclosure and data handling requirements |
| POPIA | South Africa | Personal information protection for footage |
| AS/NZS 62676 | Australia/NZ | IEC-aligned CCTV standard with DORI requirements |

**SentinelTwin compliance outputs needed:**
- Privacy zone overlay: flag cameras covering prohibited areas
- "This camera covers a zone requiring a DPIA under GDPR Article 35"
- GDPR Article 5(1)(a) proportionality evidence: camera covers only what's stated in purpose
- DPA-formatted report (ICO format for UK, CNIL format for France — different templates)

---

## NDAA Section 889 — Compliance Documentation

Documented in ADJACENT_SPACE_TAM_INDUSTRY.md section 2.

**What SentinelTwin can produce for NDAA compliance:**
- Camera inventory by manufacturer
- Flag any cameras from prohibited manufacturers (Hikvision, Dahua, Hytera, Huawei, ZTE)
- "NDAA Compliance Gap Report": how many cameras need replacement, which zones they cover
- Post-replacement verification: "New NDAA-compliant cameras produce equivalent coverage"

This is the specific format that federal contractors and grant recipients need.

---

## Physical Security Standards Beyond Camera Coverage

| Standard | What it covers | Relevance |
|---|---|---|
| ASIS SPC.1 | Organizational Resilience | Framework for security planning — SentinelTwin outputs support this |
| ASIS PSC.1 | Physical Security Professional standard | Certifications for security practitioners who would use SentinelTwin |
| EN 50131 | Intrusion detection systems | Adjacent — door/window sensors that appear in SentinelTwin's threat paths |
| ISO 31000 | Risk management | Coverage entropy and adversarial path analysis = risk quantification |
| ISO 22316 | Organizational resilience | Emergency planning (fire evacuation, temporal simulation) |
| PCI DSS | Payment card industry | Cash counter camera requirements for retail — specific coverage requirements |
| HIPAA | Healthcare | Patient privacy from cameras — privacy zone compliance |

### PCI DSS — Retail-Specific Camera Requirements

PCI DSS (Payment Card Industry Data Security Standard) Section 9 requires:
- Video cameras and access controls monitoring entry/exit to sensitive areas
- Footage retained for 3 months minimum
- Periodic review of coverage

For retailers who handle credit cards, PCI DSS is a mandatory compliance standard.
SentinelTwin can produce a "PCI DSS Section 9 Coverage Report" specifically for retail.

### Healthcare — HIPAA Camera Requirements

HIPAA requires protection of patient privacy. Cameras in healthcare:
- Must not cover areas where PHI (Protected Health Information) is visible
- Must not record conversations in treatment areas
- Privacy zones in SentinelTwin are directly applicable

---

## Standards SentinelTwin Should Implement (Priority Order)

### P0 — Before any professional use claim
1. **IEC 62676-4:2025 OODPCVS** — replace old DORI with 7-level standard
   - Update quality thresholds in `apps/studio/src/simulation/dori.ts` (OODPCVS_THRESHOLDS) and add `oodpcvs_2025` to the `doriStandard` enum in `apps/studio/src/schema/security-scene.ts`
   - Add `standard: "DORI_2014" | "OODPCVS_2025"` to SimulationAssumptions
   - DORI as legacy option, OODPCVS as default

### P1 — Before EU market entry
2. **GDPR compliance outputs** — privacy zone + proportionality evidence report
3. **IEC 62676-4:2025 report format** — include standard reference in all reports

### P2 — For professional/enterprise market
4. **NDAA compliance documentation** — camera manufacturer flagging + replacement verification
5. **PCI DSS Section 9 report format** — retail-specific compliance output
6. **Insurance coverage attestation format** — per section above

### P3 — Advanced compliance
7. **ONVIF Profile M integration** — V2+ real camera verification
8. **ASIS PSC.1 alignment** — professional security framework language
9. **ISO 31000 risk language** — coverage entropy → risk quantification reporting

---

## Adding to Open Questions

The following must be added to OPEN_QUESTIONS.md:

**Q-016: IEC 62676-4:2025 OODPCVS — exact PPM thresholds for the 7 new levels?**
JVSG has already implemented these. Research their implementation or the IEC document directly.

**Q-017: DPA-specific report formats — ICO, CNIL, BfDI requirements?**
Each EU DPA has different documentation requirements for camera compliance. Research before EU launch.

**Q-018: PCI DSS Section 9 specific camera coverage requirements?**
What does PCI DSS actually require for cash handling area camera coverage?

**Q-019: Insurance underwriters — which carriers are asking for camera coverage documentation?**
Name specific carriers if possible. This is a distribution channel, not just market context.
