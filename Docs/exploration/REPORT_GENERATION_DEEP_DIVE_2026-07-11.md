# Report Generation System — Deep Dive (2026-07-11)

## Overview

The report generation system converts deterministic simulation results into compliance-ready documentation. It is a pure data transformation pipeline — no LLM, no randomness. Every number in a report comes from simulation. AI only writes prose in the optional `ReportAgent` layer.

**Core principle:** AI proposes. Simulation verifies. AI explains. Reports present verified data with explicit assumptions and provenance.

---

## Core Architecture: Deterministic Report Factory

```
SecurityScene + SimulationResult → buildReportData() → ReportData → exportAs*() → Compliance-Ready Document
```

### Stage 1: Report Factory (`packages/report/src/index.ts` — 1,200+ lines)

**Single deterministic entry point:**

```typescript
function buildReportData(
  scene: SecurityScene,
  simulationResult: SimulationResult,
  options?: ReportBuildOptions
): ReportData {
  // 1. Resolve audience policy (8 profiles)
  const audience = options?.audience ?? "operator";
  const policy = getAudiencePolicy(audience);
  
  // 2. Resolve compliance template (11 templates)
  const templateId = options?.templateId ?? "general-audit";
  const template = getProfileFromCompliance(templateId);
  
  // 3. Map simulation data to report sections
  const zones = sim.criticalZoneResults.map(z => ({ ... }));
  const cameras = sim.cameraResults.map(c => ({ ... }));
  const issues = sim.issues.map(i => ({ ... }));
  const recommendations = sim.recommendations.map(r => ({ ... }));
  
  // 4. Compute provenance + truth ladder
  const provenance = { sceneSource, nodeCount, revisionDepth, ... };
  const truthLadder = { reviewedNodeCount, verifiedNodeCount, ... };
  
  // 5. Build redundancy matrix
  const redundancyMatrix = buildRedundancyMatrixReport(scene, result);
  
  // 6. Apply regulatory redactions
  return applyPolicyRedaction(report, effectivePolicy);
}
```

---

## 11 Compliance Templates (`compliance-templates.ts`)

| Template | Standard | Retention | Mandatory Redactions |
|----------|----------|-----------|---------------------|
| `general-audit` | IEC 62676-4:2025 | — | — |
| `installer-proposal` | IEC 62676-4:2025 | — | — |
| `insurer-brief` | Commercial Risk | — | — |
| `privacy-review` | Privacy Governance | — | — |
| `oodpcvs-audit` | IEC 62676-4:2025 | — | — |
| `dori-audit` | IEC 62676-4:2014 | — | — |
| `gdpr-uk-ico` | UK GDPR Art. 35 | 30 days | Camera IPs, Patrol Routes |
| `gdpr-cnil` | French CSI L251-1 | 30 days | Camera IPs, Patrol Routes |
| `gdpr-bdsg` | German BDSG §4 | 3 days | Camera IPs, Patrol Routes |
| `pci-dss-sec9` | PCI DSS v4.0 | 90 days | Vulnerability Masking |
| `bipa-hipaa` | BIPA/HIPAA | 30 days | Camera IPs, GPS, Vulnerability |

**Each template defines:**
- `sections`: Report structure (title + detail)
- `regulatoryMandates`: Authority, article, requirements, retention, redactions
- `focusAreas`: Coverage, zones, privacy, etc.
- `evidenceAnchors`: What evidence to include

---

## Redaction Engine (`applyPolicyRedaction()`)

**Policy-driven redaction** with 4 redaction types:

```typescript
function applyPolicyRedaction<T>(report: T, policy: ReportRedactionPolicy): T {
  // 1. Camera IP redaction (IPv4/IPv6 → "[IP REDACTED]")
  // 2. GPS coordinate redaction (lat/lon → "[GPS REDACTED]")
  // 3. Patrol route redaction (route text → "[PATROL ROUTE REDACTED]")
  // 4. Vulnerability masking (critical/high issues → "[MASKED VULNERABILITY]")
}
```

**3 visibility modes:**
- `internal`: Full detail, no redaction
- `shared`: Audit spine retained, confidence notes + evidence detail redacted
- `privacy_safe`: Maximum redaction, no operational evidence

---

## 8 Audience Profiles

| Audience | Disclosure Level | Key Sections |
|----------|-----------------|--------------|
| `operator` | full_internal | All sections |
| `auditor` | evidence_first | Coverage, issues, assumptions, provenance |
| `insurer` | partner_shared | Coverage, issues, recommendations, before/after |
| `installer` | partner_shared | Recommendations, camera matrix, zones |
| `privacy_reviewer` | privacy_minimized | Coverage summary, privacy zones, governance |
| `consultant` | evidence_first | Coverage, issues, assumptions, provenance, recommendations |
| `facilities_director` | full_internal | Coverage, issues, recommendations, timeline, assumptions, provenance |
| `operations_manager` | full_internal | Coverage, issues, recommendations, counterfactual, timeline |

**Each audience has 3 commercial framing messages:**
- `distributionMessage`: What to tell external recipients
- `internalMessage`: How to handle internally
- `legalBoundaryMessage`: Legal liability disclaimer

---

## 5 Export Formats

| Format | Function | Use Case |
|--------|----------|----------|
| **Markdown** | `exportAsMarkdown()` | Documentation, GitHub |
| **HTML** | `exportAsHtml()` | Web embedding, email |
| **Text** | `exportAsText()` | Plain text, CLI |
| **PDF** | Via `make-pdf` skill | Formal documents |
| **Evidence Bundle** | `buildReportEvidenceBundle()` | Forensic handoff |

**5 audience-specific Markdown renderers** (`export-templates.ts`):
- `exportOperatorMarkdown()` — Full detail
- `exportAuditorMarkdown()` — Evidence-focused
- `exportInsurerMarkdown()` — Risk-focused
- `exportInstallerMarkdown()` — Implementation-focused
- `exportPrivacyReviewerMarkdown()` — Privacy-focused

---

## Redundancy Matrix (`redundancy-matrix.ts`)

**Camera criticality analysis:**

```typescript
function buildRedundancyMatrixReport(scene, result): RedundancyMatrixReport {
  // For each zone:
  //   - uncovered (0 cameras)
  //   - single_point_failure (1 camera)
  //   - redundant (2+ cameras)
  
  // For each camera:
  //   - criticalityScore = soleCoverageZones.length * 3 + coveragePct / 15
  //   - criticalityLabel: "Critical" (≥7) | "Important" (≥4) | "Redundant"
  //   - soleCoverageZones: zones where this camera is the ONLY coverage
}
```

---

## Evidence Bundle (`report-evidence-bundle.ts`)

**Structured evidence package for forensic handoff:**

```typescript
type ReportEvidenceBundle = {
  version: "1";
  exportedAt: string;
  source: "studio";
  mode: "single" | "compare";
  scene: { id, name, source };
  evidenceTrail: ReportData["evidenceTrail"];
  report: ReportData;
  simulationResult: SimulationResult | null;
  compare?: CompareReportData;
  visualEvidence?: { beforeImageDataUrl, afterImageDataUrl };
  notes: string[];
};
```

---

## Analytics HTML Export (`report-analytics-export.ts`)

**Pure HTML/inline-SVG renderer** for embedding analytics into reports:
- KPI cards (coverage, blindspot, recognition area)
- DORI quality distribution bar chart (inline SVG)
- Issue severity bar chart (inline SVG)
- Coverage trend line chart (inline SVG)
- Camera leaderboard table

---

## Report Document Schema (`report-document.ts`)

**Zod-validated report document:**

```typescript
type ReportDocument = {
  id: "report_<timestamp>_<random>";
  title: string;
  sceneId: string;
  audience: ReportAudience;
  visibility: ReportVisibility;
  status: "draft" | "reviewed" | "published";
  sections: ReportSection[]; // 14 section types
  visualArtifacts: ("heatmap" | "cones" | "view")[];
  sceneSnapshot: SecurityScene;
  simulationSnapshot: SimulationResult;
  evidenceBundleJson: any;
  forensicGuarantees: false; // Always false — planning tool, not forensic
  truthChecksPassed: boolean;
};
```

---

## 14 Report Sections

| Section | Content |
|---------|---------|
| `site_overview` | Scene dimensions, source, name |
| `provenance` | Scene source, node count, revision depth |
| `assumptions` | DORI standard, person height, PPM thresholds |
| `coverage_results` | Total coverage, blindspot %, recognition area |
| `privacy_review` | Privacy zone analysis |
| `summary` | Executive summary metrics |
| `truth_ladder` | Node review/verification status |
| `operational_evidence` | Evidence trail, sensor evidence |
| `causal_trace` | Chronological change ledger |
| `zone_analysis` | Per-zone quality requirements |
| `camera_analysis` | Per-camera coverage and quality |
| `temporal_twin` | 24h vulnerability windows |
| `recommendations` | Verified/unverified fix proposals |
| `privacy_masking` | Camera privacy masking status |

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `packages/report/src/index.ts` | Report factory + 4 export formats | 1,200+ |
| `packages/report/src/compliance-templates.ts` | 11 regulatory templates + redaction | 450+ |
| `packages/report/src/export-templates.ts` | 5 audience-specific Markdown renderers | 600+ |
| `packages/report/src/redundancy-matrix.ts` | Camera criticality analysis | 120 |
| `apps/studio/src/report/evidence-bundle.ts` | Evidence bundle builder | 30 |
| `apps/studio/src/lib/report-evidence-bundle.ts` | Bundle serialization | 80 |
| `apps/studio/src/lib/report-analytics-export.ts` | Analytics HTML/SVG export | 200 |
| `apps/studio/src/report/report-document-builder.ts` | Document builder | 60 |
| `apps/studio/src/schema/report-document.ts` | Zod schema | 50 |
| `packages/agents/src/report-agent.ts` | AI report generation (optional) | 100 |

---

## Related Exploration Threads

- Thread 2c: Report trust boundaries
- Thread 24: Security Evidence Twin — Framing and Product Mode
- Thread 159: Report Generation System (this document's index in EXPLORATION_MAP.md)
