# Design System — SentinelTwin

> This is a living document. It encodes design decisions as durable as code.
> Every choice traces to a first principle. When the principle changes, the choice changes — and the refactor that follows is part of the deliverable (motto_v3 §21).

---

## First Principles (Design Anchors)

These are the non-negotiable foundations. Every design decision below derives from one or more of these. When a new design choice conflicts with these, the choice must justify why it overrides the principle, or the principle wins.

| # | Principle | Source | What it means for design |
|---|-----------|--------|--------------------------|
| D1 | **Operator workflow is the product** | §0.14 | A feature is a user and operator workflow, not a code path. Every screen, panel, and interaction must serve the person using it — what they trigger, what they see, what happens on failure. |
| D2 | **Build for the best app, not the safest change** | §0 boldness | Design for the long-term product shape. Don't dilute the system to be "safe" or "generic." Bold, durable, first-principles choices over narrow patchwork. |
| D3 | **Source-of-truth clarity** | §11, §21 | No duplicate visual truth sources. Every token, color, and spacing value has exactly one canonical owner. Code is evidence; when design decisions change, the refactor is part of the deliverable. |
| D4 | **System coherence over local optimization** | §11 | Every design choice must reinforce every other. A system where all pieces cohere beats a system with individually "optimal" but mismatched choices. |
| D5 | **Product quality over local convenience** | §0 | When tradeoffs appear, prioritize product quality, system coherence, and future leverage over local convenience. |
| D6 | **Observability is not optional polish. Observability is part of delivery.** | §0.10 | If the operator cannot understand the system's state from the UI, the design is incomplete. Status, confidence, and uncertainty must be visible. Per §0.10: "Observability is not optional polish. Observability is part of delivery." |
| D7 | **Documentation is part of delivery, not optional polish** | §0.3 | If design behavior changed and this document didn't update, the task isn't done. Per §0.3: "Documentation is part of delivery, not optional polish." |
| D8 | **Data layer is product** | §0.8 | Design tokens are data. Per §0.8: verify who reads it, who writes it, whether it has a canonical location, whether duplicate versions exist, whether stale values can affect behavior, whether tests/fixtures cover it, whether docs mention it. Not support material — part of the product. |

---

## Product Context

- **What this is:** AI-native physical security digital twin — a simulation platform where security professionals edit camera layouts, run coverage analysis, replay incidents, and generate compliance reports.
- **Who it's for:** Security consultants, facility managers, SOC operators, physical security auditors.
- **Space/industry:** Physical security simulation, security digital twins, CAD/BIM-adjacent planning tools.
- **Project type:** Complex professional web application / simulation studio.
- **Core loop:** Edit scene → recompute coverage → show security impact → explain what changed → recommend fixes.
- **Product value:** Saves 4–8 hours per security audit, eliminates false confidence about coverage, automates compliance evidence, surfaces coverage gaps before incidents force discovery.

---

## Aesthetic Direction

**Industrial Precision** — the intersection of a security operations center and a CAD workstation.

This is not a stylistic preference. It's a first-principles consequence of the product:

- **Security operators work long shifts in dim control rooms** → dark theme reduces eye strain (D1, D6).
- **Physical security is inherently spatial** → the 3D canvas must be the hero, not a decorative element (D1, D4).
- **Operators are domain experts** → they need information density, not hand-holding (D2, D5).
- **This is a simulation tool, not a dashboard** → the UI chrome should disappear into utility; the canvas IS the visual spectacle (D4).

| Attribute | Value | First-principles reason |
|-----------|-------|------------------------|
| Direction | Industrial Precision | D1 (operator workflow), D2 (best app, not safest) |
| Decoration | Minimal | D4 (canvas is hero, chrome serves utility) |
| Mood | Serious software for serious work | D1 (operator trust), D12 (product alignment) |
| Reference sites | Verkada Command, Genetec Security Desk, System Surveyor, AXIS Site Designer, Blender/AutoCAD | Competitive landscape research (July 2026) |

---

## Typography

Three fonts, three jobs. No overlap, no redundancy.

| Role | Font | Why this font | First-principles reason |
|------|------|---------------|------------------------|
| Display/Hero | Instrument Sans | Geometric, technical, modern without being trendy. Evokes precision instruments. | D2 (bold, not generic Inter/Roboto), D4 (distinct from category norms) |
| Body/UI | Geist | Designed for screens, excellent at small sizes, tabular-nums for data alignment. | D1 (operator readability at compact sizes), D8 (typed scale in code) |
| Code/Data | JetBrains Mono | For camera specs, coordinates, timestamps, technical readouts. | D1 (data density), D6 (operator can read technical state at a glance) |

**Loading:** Google Fonts CDN with `display=swap`:
```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Type Scale** — canonical, tablet-aware, defined in `design-tokens.ts` as `TYPE_SCALE`:

| Tier | Size | Usage | First-principles reason |
|------|------|-------|------------------------|
| micro | 9px | Shortcut chips, super-dense status dots | D1 (operator density), D8 (data layer) |
| caption | 10px | Tab labels, badge text, KPI sublabels | D1 (operator density) |
| body-sm | 11px | Issue descriptions, secondary panel text | D1 (issue scanning) |
| body | 12px | Default body, list items | D1 (standard readability) |
| label | 13px | Section headers, primary button text | D4 (hierarchy) |
| heading | 15px | Panel titles | D4 (hierarchy) |
| display | 18px | Modal titles, hero numbers | D6 (key state visibility) |
| kpi | 22px | Big metric values (coverage %, blind spots) | D6 (operator must see critical metrics at a glance) |

The scale is not arbitrary. It mirrors how operators scan information: KPI first (22px), heading second (15px), body for details (12px), metadata last (9-10px).

---

## Color

**Restrained, then semantic.** Deep navy surfaces with blue-tinted grays. Color is rare and meaningful — semantic signals must be impossible to miss against the neutral backdrop.

### Token Boundary (Three-Layer Architecture)

This is the most important structural decision in the design system. Per motto_v3 §11 (no conflated sources of truth) and §21 (code is evidence, not a boundary):

| Layer | Canonical owner | Owns | Consumers | Rule |
|-------|----------------|------|-----------|------|
| **Canvas geometry** | `MAP_COLORS` (`map-colors.ts`) | Deterministic colors tied to simulation primitives: walls, doors, paths, quality levels, zones, obstacles | 11 import sites across ~10 direct consumer files (map-utils.ts re-exports): WorkspaceCanvas, MapLayers, MiniMap, PathMap, CoverageRibbon, CoverageLegend, ViewModeBar, ViewControls, WallCanvasPicker | Geometry-only. Never used for chrome. |
| **Chrome UI** | `UI_TONES` (`design-tokens.ts`) | Semantic states: success, warning, danger, info, accent, neutral. Status badges, confidence bands, attention signals, deltas. | 10 direct import files (DockPanel, CameraWallView, CameraViewMode, PathReplayView, ScanProgressStepper, ScanProgressSidebar, AmbientEditDelta, DemoWalkthroughPanel, VisibilityTimeline, WallCanvasPicker) with 74+ usage sites across those files | UI-only. Never used for canvas geometry. |
| **Surfaces** | `UI_SURFACES` (`studio-surface-tokens.ts`) | Background colors, border colors, text colors, hover states. The neutral canvas for chrome to render on. | 4 direct import files (PathReplayView, CameraViewMode, CameraWallView, CompareView) with 50+ usage sites across those files | Structural. Never conveys semantic meaning. |

**The three never overlap by semantic role.** A component picks based on whether it renders canvas geometry or chrome. If a semantic value (e.g., "success green") appears in two layers with different hex values, one must be wrong. The one documented exception is `#a78bfa` which appears in both semantic accent (chrome) and camera palette (canvas geometry) — but these serve different semantic roles in different contexts, so it's a boundary rule, not a conflict. (Per motto_v3 §0.8 — treat data dependencies as production code.)

### Surface Palette

| Name | Hex | CSS Var | Usage | First-principles reason |
|------|-----|---------|-------|------------------------|
| Page | `#07090d` | `--bg-page` | Root background | D1 (dark reduces eye strain for long sessions) |
| Panel | `#0b0f17` | `--bg-panel` | Side panels, dock rails | D4 (hierarchy: panel > page) |
| Card | `#111521` | `--bg-card` | Cards, metric blocks, issue items | D4 (hierarchy: card > panel) |
| Hover | `#1a2333` | `--bg-hover` | Hover states | D6 (affordance visibility) |
| Hover Alt | `#253454` | `--bg-hover-alt` | Active/selected hover | D6 (state distinction) |

### Text Palette

| Name | Hex | CSS Var | Usage |
|------|-----|---------|-------|
| Muted | `#4a5568` | `--text-muted` | Disabled, tertiary text |
| Muted 2 | `#6b7c95` | `--text-muted2` | Secondary labels, timestamps |
| Muted 3 | `#8ea5cc` | `--text-muted3` | Subtitle text, helper text |
| Muted 4 | `#9ab0ce` | `--text-muted4` | Bright secondary |
| Body | `#c7d0e4` | `--text-body` | Default body text |
| Body 2 | `#d2d9e8` | `--text-body2` | Emphasized body |
| White | `#ffffff` | `--text-white` | Headings, KPI values |

### Border Palette

| Name | Hex | CSS Var | Usage |
|------|-----|---------|-------|
| Subtle | `#1f2536` | `--border-subtle` | Divider lines, card borders |
| Default | `#243146` | `--border` | Standard borders |
| Thin | `#24283a` | `--border-thin` | Thin separators |
| Strong | `#27364e` | `--border-strong` | Emphasized borders |

### Accent

| Name | Hex | CSS Var | Usage | First-principles reason |
|------|-----|---------|-------|------------------------|
| Accent | `#7dd3fc` | `--accent` | Primary actions, links, selected states, logo | D2 (sky-blue signals "modern simulation" not "legacy VMS" — immediate distinction from competitors) |

### Semantic Colors

Each semantic tone has three tiers: **text** (lightest, for foreground), **dot** (medium, for status indicators), **bg** (darkest/opacity, for backgrounds). The hex values below are the **dot** color. Text and bg are Tailwind class fragments defined in `UI_TONES` (`design-tokens.ts`).

| Name | Dot Hex | Tailwind tier | Text class | BG class | Usage | First-principles reason |
|------|---------|---------------|------------|----------|-------|------------------------|
| Success | `#34d399` | emerald-400 | `text-emerald-300` | `bg-emerald-500/12` | Coverage pass, camera active, path visible | D6 (state must be scannable without reading text) |
| Warning | `#fbbf24` | amber-400 | `text-amber-200` | `bg-amber-500/12` | Marginal coverage, low light, pending review | D6 (operator must see marginal states immediately) |
| Danger | `#fb7185` | rose-400 | `text-rose-300` | `bg-rose-500/12` | Blind spot, camera offline, path unmonitored | D6 (critical failures cannot be missed) |
| Info | `#7dd3fc` | sky-400 | `text-sky-300` | `bg-sky-500/12` | Primary action, info, selected state | D1 (interactive affordance) |
| Accent | `#a78bfa` | violet-400 | `text-violet-300` | `bg-violet-500/12` | Reserved for accent signals only | D4 (separates accent from info) |
| Neutral | `#94a3b8` | slate-400 | `text-slate-300` | `bg-slate-500/12` | Neutral/inactive state | D6 (inactive state visibility) |

**Overlap note:** `#a78bfa` (violet-400) appears in both semantic accent AND `CAMERA_COLOR_PALETTE[1]` in `camera-colors.ts`. Per the token boundary: semantic accent owns chrome (badges, accent signals), camera palette owns canvas geometry (camera cone colors). When both appear in the same view, semantic takes precedence in chrome, camera palette takes precedence on the map. This is not a conflict — it's a boundary rule.

### Camera Palette (canvas geometry only)

Per `camera-colors.ts` — a base palette of 11 distinct colors, with modular indexing and a hash-based fallback for additional cameras:

```
#60a5fa, #a78bfa, #34d399, #f59e0b, #fb7185, #22d3ee, #f97316, #c084fc, #84cc16, #e879f9, #2dd4bf
```

The palette **cycles through 11 base colors** — `getCameraColor(index)` uses `index % 11` modulo indexing, and `getCameraColorForId(id)` hashes the ID to index into the same 11-element array. With more than 11 cameras, colors repeat. The 11 listed colors are the complete set.

These are **canvas geometry**, not chrome. They belong to `MAP_COLORS`'s conceptual scope, not `UI_TONES`.

---

## Spacing

**4px base unit, compact density.**

| Scale | Value | Usage | First-principles reason |
|-------|-------|-------|------------------------|
| 2 | 4px | Tight internal spacing (badge padding, icon gaps) | D1 (operator density) |
| 3 | 8px | Standard internal spacing (card padding, list gaps) | D1 (compact but scannable) |
| 4 | 12px | Medium spacing (section gaps, panel padding) | D4 (rhythm) |
| 5 | 16px | Large spacing (panel separation) | D4 (hierarchy) |
| 6 | 24px | Section spacing | D4 (visual grouping) |
| 8 | 32px | Major section breaks | D4 (macro hierarchy) |
| 10 | 40px | Page-level spacing | D4 (canvas priority — less space for chrome, more for canvas) |
| 12 | 48px | Maximum spacing | D4 (not used often — canvas is hero) |

Compact density is not a compromise. It's a feature. Security operators are domain experts who need to see more, not less. Every pixel of chrome is a pixel taken from the canvas. (D1, D2, D5.)

---

## Layout

**Canvas-first with collapsible dock panels.**

The layout architecture is a direct consequence of the operator workflow (D1):

1. **3D scene is the hero** — occupies 70%+ of viewport. This is where decisions are made.
2. **Left rail** (48px) — tools, layers, minimap. Quick access, minimal intrusion.
3. **Right panel** (280–320px) — inspector, properties, security status. Contextual, collapses when not needed.
4. **Bottom panel** — metrics, timeline, scenario path. Temporal data that supports the spatial view.

All panels are collapsible. The operator controls the information density. (D1, D2.)

| Attribute | Value | First-principles reason |
|-----------|-------|------------------------|
| Approach | Canvas-first with collapsible docks | D1 (spatial workflow), D4 (matches StudioShell architecture) |
| Grid | 3-column: left rail (48px) \| canvas (flex 1) \| right panel (280–320px) | D4 (consistent with existing DockLayout) |
| Max content width | N/A — full viewport canvas | D1 (canvas is hero, no artificial constraints) |
| Border radius | sm: 4px, md: 6px, lg: 8px, xl: 12px, full: 9999px | D4 (subtle hierarchy, not bubbly/generic) |

---

## Motion

**Minimal-functional.** Motion signals state change, not personality.

This is a deliberate first-principles choice (D2, D4):
- Security operators need **immediate feedback** — animation delays are cognitive friction.
- Professional tools (Blender, Figma, AutoCAD) use minimal motion — it's the category norm for a reason.
- Decorative motion (springs, scroll-driven, playful transitions) signals "consumer app" not "professional tool."

| Token | Duration | Easing | Usage | First-principles reason |
|-------|----------|--------|-------|------------------------|
| micro | 50–100ms | ease | Hover states, focus rings, opacity toggles | D1 (immediate feedback) |
| short | 150ms | ease-out | Panel open/close, dropdown, tooltip | D1 (state change must feel responsive) |
| medium | 200–250ms | ease-out | Modal entrance, tab switch, view transition | D4 (consistent transition language) |
| long | 250–400ms | ease-in-out | Canvas camera move, scene transition, replay scrub | D1 (canvas transitions need to feel smooth, not instant) |

No spring physics. No scroll-driven animations. No decorative transitions. If a motion doesn't serve comprehension, it doesn't exist. (D5.)

---

## Component Tokens

Components consume tokens from the three-layer architecture. No ad-hoc colors, no inline styles.

| Component | Token source | Example |
|-----------|-------------|---------|
| Buttons (primary) | `UI_SURFACES` (bg) + accent | `bg-[#7dd3fc] text-[#07090d]` |
| Buttons (secondary) | `UI_SURFACES` (border) + text | `border-[#243146] text-[#c7d0e4]` |
| Buttons (danger) | `UI_TONES.danger` | `bg-rose-500/12 text-rose-300 border-rose-500/30` |
| Badges | `UI_TONES.{tone}` | `bg-emerald-500/12 text-emerald-300 border-emerald-500/30` |
| Cards | `UI_SURFACES.card` + `UI_SURFACES.borderSubtle` | `bg-[#111521] border-[#1f2536]` |
| Issue items | `UI_TONES.{severity}` + `UI_SURFACES.card` | Semantic icon + card background |
| Coverage bars | `UI_TONES.{status}.dot` or mapped color | Width = coverage %, color = status |
| Metric cards | `UI_SURFACES.card` + `TYPE_SCALE.kpi` | KPI value in display font |

---

## CSS Custom Properties

Defined in `:root` for use in HTML preview and global styles. The TS projections (`UI_TONES`, `UI_SURFACES`, `TYPE_SCALE`) are the canonical source; CSS vars are convenience aliases.

```css
/* Surfaces */
--bg-page: #07090d;   --bg-panel: #0b0f17;  --bg-card: #111521;
--bg-hover: #1a2333;  --bg-hover-alt: #253454;
/* Text */
--text-muted: #4a5568;  --text-muted2: #6b7c95;  --text-muted3: #8ea5cc;
--text-body: #c7d0e4;   --text-body2: #d2d9e8;    --text-white: #ffffff;
/* Borders */
--border: #243146;  --border-subtle: #1f2536;  --border-strong: #27364e;
/* Semantic */
--success: #34d399;  --warning: #fbbf24;  --danger: #fb7185;  --info: #7dd3fc;
/* Accent */
--accent: #7dd3fc;
/* Typography */
--font-display: 'Instrument Sans';  --font-body: 'Geist';  --font-mono: 'JetBrains Mono';
/* Type scale */
--fs-micro: 9px;  --fs-caption: 10px;  --fs-body-sm: 11px;  --fs-body: 12px;
--fs-label: 13px;  --fs-heading: 15px;  --fs-display: 18px;  --fs-kpi: 22px;
```

---

## Decisions Log

Per motto_v3 §0.12 (Decision Record Requirement). Every design choice is recorded with context, alternatives, rationale, and what would cause it to be revisited.

| Date | Decision | Context | Alternatives considered | Rationale | What would cause revisit | Owner |
|------|----------|---------|------------------------|-----------|-------------------------|
| 2026-07-09 | Industrial Precision aesthetic | First design system for SentinelTwin. Product is a security simulation studio, not a dashboard or marketing site. | Luxury/Refined (too decorative), Brutalist/Raw (too raw for professional tool), Editorial (wrong product type) | D1: operator workflow demands functional UI. D2: best app, not safest. The 3D canvas IS the visual spectacle. | If the product shifts toward consumer-facing or marketing-first. | Pranay |
| 2026-07-09 | Three-layer token boundary | Existing codebase already has MAP_COLORS, UI_TONES, UI_SURFACES with clear separation. 11 import sites of MAP_COLORS, 74+ of UI_TONES, 50+ of UI_SURFACES. | Single unified token file (simpler but conflates truth sources), per-component tokens (drifts immediately) | D3: source-of-truth clarity per §11. D8: data layer is product. The boundary prevents the ~30-file drift that Visual Pass V1 fixed. | If a new token category emerges that doesn't fit the three layers. | Pranay |
| 2026-07-09 | Sky-blue accent (#7dd3fc) | Most security tools use muted teal or corporate blue. SentinelTwin should signal "modern simulation" not "legacy VMS." | Teal (too enterprise/corporate), purple (AI SaaS cliché), green (conflicts with success semantic) | D2: bold, distinctive. D5: product quality over "safe" choices. Immediate visual distinction from every competitor. | If the accent color creates confusion with info/semantic signals in practice. | Pranay |
| 2026-07-09 | Instrument Sans for display | Most CAD/professional tools use Inter, Roboto, or system fonts. Instrument Sans is geometric and technical with more character. | Inter (overused, every AI tool converges on it), Roboto (too generic), Space Grotesk (on overuse list) | D2: bold typography choice. D4: signals "precision tool" not "generic app." | If font loading performance becomes an issue or the font is discontinued. | Pranay |
| 2026-07-09 | Ultra-compact density as feature | Security operators are domain experts. They need to see more, not less. Where competitors spread across tabs, SentinelTwin shows at once. | Comfortable/spacious density (wastes canvas space), variable density (inconsistent) | D1: operator density. D2: bold choice. D5: power users get faster with density. | If user testing shows operators consistently miss information due to density. | Pranay |
| 2026-07-09 | Minimal-functional motion | Professional tool, not a consumer app. Motion signals state change only. | Expressive (wrong category), intentional (adds cognitive load for operators) | D2: category-appropriate. D4: consistent with Blender/Figma/AutoCAD precedent. D5: no decorative motion. | If operators report the UI feels "dead" or unresponsive. | Pranay |
| 2026-07-09 | 4px base spacing, compact | Canvas-first layout means every pixel of chrome is a pixel from the canvas. | 8px base (too spacious for density), 2px base (too tight for readability) | D1: canvas priority. D4: consistent rhythm. | If touch targets become too small for tablet use (V1 per OQ-UI-04). | Pranay |
| 2026-07-09 | Canvas-first layout with docks | The 3D scene is where decisions are made. Every other element serves that spatial reasoning. | Sidebar-heavy (wrong for spatial work), tabbed (hides context), floating panels (drifts) | D1: operator workflow. D4: matches existing StudioShell/DockLayout architecture. | If the product shifts toward non-spatial workflows (pure reporting, pure configuration). | Pranay |

---

## Scope Boundary

This design system owns:
- Chrome UI tokens (UI_TONES)
- Surface tokens (UI_SURFACES)
- Typography scale (TYPE_SCALE)
- Spacing scale
- Layout architecture
- Motion principles
- Component token consumption patterns

This design system does NOT own:
- Canvas geometry colors (MAP_COLORS in `map-colors.ts`) — those are simulation primitives
- Camera colors (`camera-colors.ts`) — those are canvas geometry
- 3D rendering pipeline (R3F, Three.js) — that's `@sentineltwin/simulation`
- Report template styling — that's `@sentineltwin/report`

When a design decision requires changing MAP_COLORS or camera colors, the change goes through the simulation/rendering layer, not this document. (D3, D8.)

---

## What Would Cause This Document to Be Revised

Per motto_v3 §0.12 — explicit triggers for revisiting each decision:

| Trigger | Affected decisions |
|---------|-------------------|
| User testing shows operators struggle with density | Compact density, spacing scale |
| Product shifts to consumer-facing / marketing-first | Aesthetic direction, typography |
| New token category emerges that doesn't fit three layers | Token boundary |
| Font loading becomes a performance issue | Typography, font loading |
| Touch/tablet use becomes primary (V1 per OQ-UI-04) | Spacing, type scale |
| Competitor sets a new visual standard in the space | Aesthetic direction, accent color |
| The 3D canvas is no longer the primary workspace | Layout architecture |
| Operators report the UI feels "dead" | Motion principles |
