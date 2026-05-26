# Phase 9: Report Generation — Professional Security Audit Reports

## Goal
Transform the existing markdown-only export into a full professional report generation system with template-driven HTML reports, PDF export (via browser print), multi-format support, and AI-enhanced narrative generation.

## Current State
- `ReportLiteTab.tsx`: basic markdown display + simple HTML export
- `buildHtmlReport()`: inline HTML generation, no template system
- `ReportAgent.ts`: AI-based report generation via `generateReport()`
- `SimulationResult`: comprehensive data but no dedicated report engine

## What We Built

### P0 — Report Engine
- [x] **`src/report/index.ts`** — Report engine with `buildReportData()` that extracts and structures all simulation data into a `ReportData` interface
- [x] **Template system**: HTML report templates with CSS, supporting multiple sections
- [x] **Section rendering**: Executive Summary, Coverage Summary, Zone Analysis, Camera Analysis, Issues, Recommendations, Adversarial Path, Assumptions, Temporal Profile
- [x] **Format support**: HTML, Markdown, Plain Text
- [x] **Standards compliance citations**: IEC 62676-4:2025 OODPCVS, DORI references in all reports

### P1 — HTML Report Templates
- [x] **Professional CSS**: Print-optimized, dark/light theme support, proper page breaks
- [x] **Cover page**: Scene name, date, report type, standard reference
- [x] **Summary grid**: Coverage %, recognition area, zones passing, issues count
- [x] **Zone analysis table**: Required vs actual quality, covering cameras, pass/fail
- [x] **Camera analysis table**: Coverage %, zones covered/failed
- [x] **Issues list**: Severity-colored cards
- [x] **Recommendations**: Verified/unverified, cost category
- [x] **Temporal profile section**: Vulnerability windows, safest periods (if temporal data available)
- [x] **Adversarial path section**: Exposure score, detection probability, route summary (if data available)

### P2 — Compare Reports
- [x] **`buildCompareReport()`**: Side-by-side or delta comparison of two simulation results
- [x] **Delta computation**: Coverage delta, zone status changes, issue delta
- [x] **Before/after report**: Shows what changed between snapshots

### P3 — Export & Print
- [x] **Export HTML**: Downloads complete HTML report file
- [x] **Export Markdown**: Downloads .md file
- [x] **Export Plain Text**: Downloads .txt file
- [x] **Print-to-PDF**: Opens report in new window, triggers browser print dialog (user selects "Save as PDF")
- [x] **Copy to clipboard**: Copies markdown version

### P4 — AI Enhancement
- [x] **ReportAgent enhancement**: Structured report generation via AI with pre-filled simulation data context
- [x] **Executive summary generation**: AI writes prose executive summary from data
- [x] **Recommendation narrative**: AI describes why recommendations matter in business terms

### P5 — Tests
- [x] **Report engine tests**: `buildReportData()`, `buildHtmlReport()`, `buildMarkdownReport()`
- [x] **Compare report tests**: Delta computation, before/after rendering
- [x] **Format tests**: HTML validity, markdown rendering, plain text rendering

## Key Decisions
- **No external PDF library**: Uses browser built-in print-to-PDF — zero dependencies, works without server
- **Templates are functions, not files**: HTML generation is pure functions that compose sections — avoids template engine dependency
- **Report data is serializable**: `ReportData` interface is JSON-serializable for future server-side generation
- **AI enhancement optional**: Reports work fully without AI, with AI as enhancement layer

## Validation
- TypeScript clean
- ESLint 0 errors
- All report engine tests pass
- Existing tests still pass

## Files Created/Modified
- `apps/studio/src/report/index.ts` — report engine (created)
- `apps/studio/src/report/templates/html.ts` — HTML template
- `apps/studio/src/report/templates/markdown.ts` — Markdown template
- `apps/studio/src/report/templates/compare.ts` — Compare report template
- `apps/studio/src/report/__tests__/report-engine.test.ts` — report engine tests
- `apps/studio/src/components/bottom-panel/ReportLiteTab.tsx` — enhanced export UI
- `apps/studio/src/components/bottom-panel/MetricsTab.tsx` — quick export button
