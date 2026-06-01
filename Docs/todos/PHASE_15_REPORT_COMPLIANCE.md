# Phase 15: Report & Compliance

**Status:** Partial  
**Priority:** P2 (Medium)  
**Dependencies:** Phase 11 (Monorepo Packages), Phase 14 (AI Agent Pipeline)

---

## Goal

Elevate the existing report generation system to a full compliance-grade reporting engine with policy-driven redaction, standards-specific templates (IEC 62676-4:2025, GDPR, BIPA, HIPAA), audience presets, and traceable evidence links.

---

## Current State

Reports exist and work well:
- `src/report/index.ts` — report engine
- `src/report/export-templates.ts` — HTML/Markdown/JSON export
- Before/after delta comparison
- Privacy zone compliance evidence generation
- Visibility/redaction summaries and buyer drill-through are now surfaced in the exported report views
- Privacy reviewer exports now include a dedicated privacy masking summary
- Compare exports now carry the same visibility framing plus direct drill-through shortcuts
- Report exports now carry explicit standards-template metadata and per-template depth notes
- Report Lite now persists a local report catalog with quick-apply presets and a selected preset cursor

**Currently implemented in the report engine:**
- `oodpcvs-audit` and `dori-audit` standards templates with IEC 62676-4:2025 clause references — these are live in `packages/report/src/index.ts`
- `general-audit`, `installer-proposal`, `insurer-brief`, `privacy-review` audience-specific templates
- Privacy masking for `privacy_reviewer` audience (redaction behaviors)
- Before/after delta comparison across all report modes
- Standards-template metadata and per-template depth notes in export headers

**What remains for Phase 15:**
- GDPR Art. 35 DPIA-specific template (`gdpr-dpia`)
- BIPA compliance template (`bipa-compliance`)
- HIPAA privacy template (`hipaa-privacy`)
- Evidence-ledger integration linking report sections to specific simulation data points
- Share-policy annotations per preset
- Export format depth beyond current HTML/Markdown/Text surface

---

## Deliverables

### 1. Compliance Standards Support

| Standard | Report Section | Template |
|----------|---------------|----------|
| IEC 62676-4:2025 (OODPCVS) | Coverage quality by zone, DORI scores | `oodpcvs-audit` |
| DORI (2014) | Detection/Observation/Recognition/Identification | `dori-audit` |
| GDPR Art. 35 | DPIA evidence, privacy zone documentation | `gdpr-dpia` |
| BIPA (Illinois) | Biometric capture zone documentation | `bipa-compliance` |
| HIPAA | PHI protection zone documentation | `hipaa-privacy` |
| General Audit | Comprehensive coverage report | `general-audit` |

### 2. Policy-Driven Redaction

- Redaction levels:
  - **Internal** — full detail
  - **Client-facing** — redact operational details, show compliance metrics
  - **Regulatory** — show only compliance-relevant data
  - **Public** — summary only, no floor plans or camera positions
- Redaction engine: recursive field-visibility filter on report data
- UI preset selector with preview of redaction effect

### 3. Report Catalog

- Named report presets with:
  - Template selection
  - Redaction level
  - Sections included/excluded
  - Default audience
  - Export format preference
- Catalog persisted in browser-local storage
- Quick-apply from catalog on new report generation

### 4. Evidence Ledger Integration

- Each report section links back to specific simulation data points:
  - Camera coverage percentage → `SimulationResult.grid` cell
  - Adversarial path → `AdversarialPathResult.path`
  - Privacy zone compliance → `PrivacyZoneNode` boundaries
- Link format: `scene:id:simulation:timestamp:dataPath`
- Report UI shows clickable evidence links → navigates to relevant scene view
- Current implementation: report exports now emit scene-scoped evidence URIs and anchor-backed evidence links for recent operational evidence entries, so handoff artifacts can point back to the exact report section instead of only summarizing it.

### 5. Export Enhancements

- PDF export with proper pagination, headers, footers
- Structured JSON export for programmatic consumption
- CSV export for spreadsheet analysis
- Batch export (multiple reports at once)

---

## Implementation Order

1. Redaction engine (field-visibility filter)
2. Standards-specific templates (start with IEC 62676-4 + DORI)
3. Report catalog with presets
4. Evidence ledger links
5. Enhanced export (PDF, CSV, batch)
6. UI preset selector and redaction preview

---

## Success Criteria

- A report can be generated with any standards template
- Applying a redaction level visibly removes/hides specified fields
- Report sections contain clickable evidence links
- Multiple reports can be batch-exported
- The catalog saves and restores presets correctly

---

## Related Docs

- `apps/studio/src/report/*` — existing report code
- `Docs/exploration/STANDARDS_COMPLIANCE_REGULATORY.md` — standards research
