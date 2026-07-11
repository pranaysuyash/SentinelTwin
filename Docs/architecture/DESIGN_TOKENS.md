# SentinelTwin Studio — Design Token System

> Canonical reference for all color, type, and surface tokens used across the
> SentinelTwin Studio chrome layer. Every component rendering UI chrome must
> consume tokens from this system instead of raw hex values or ad-hoc Tailwind
> color utilities.

---

## Architecture Overview

The token system has **five layers**, each with a strict scope boundary (per
`motto_v3 §11 — no conflated sources of truth`):

| Layer | Module | Scope | Owner |
|-------|--------|-------|-------|
| **Surface tokens** | `@/lib/studio-surface-tokens` (`UI_SURFACES`) | Neutral palette — backgrounds, borders, text, hover states (Tailwind class fragments) | Studio chrome |
| **Surface raw hex** | `@/lib/studio-surface-tokens` (`UI_SURFACES_RAW`) | Raw hex mirror of `UI_SURFACES` for CSS-in-JS `style` props | Studio chrome |
| **Semantic tones** | `@/lib/design-tokens` (`UI_TONES`) | Semantic states — success, warning, danger, info, accent, neutral | Status badges, deltas, attention signals |
| **Type scale** | `@/lib/design-tokens` (`TYPE_SCALE`) | Named typography tiers (micro → kpi) | All chrome text |
| **Canvas palette** | `@/components/map/map-colors` (`MAP_COLORS`) | Simulation geometry — walls, doors, paths, quality levels | Map/canvas only |

**Rule:** A component picks its token layer based on what it renders:
- **Canvas geometry** (walls, cameras, zones, paths) → `MAP_COLORS`
- **Chrome UI** (panels, badges, buttons, text) → `UI_SURFACES` + `UI_TONES`
- **CSS-in-JS style props** (e.g., `style={{ color }}`) → `UI_SURFACES_RAW`
- The two palette systems **never overlap**.

---

## UI_SURFACES — Neutral Surface Tokens

53 tokens defining the neutral dark-mode palette. Each token is a pre-composed
Tailwind class fragment (e.g., `"bg-[#0b0f17]"`, `"text-[#c7d0e4]"`).

### Usage

```tsx
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

// In JSX className (template literal):
<div className={`${UI_SURFACES.panel} ${UI_SURFACES.borderSubtle}`}>
  <span className={UI_SURFACES.textBody}>Content</span>
</div>

// In cn() utility:
<div className={cn(UI_SURFACES.card, isActive && UI_SURFACES.borderStrong)}>
```

### Background Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `page` | `bg-[#07090d]` | Root page background |
| `panel` | `bg-[#0b0f17]` | Panel, sidebar, card backgrounds |
| `panelDeep` | `bg-[#0d0f17]` | Deep panel variant (slightly lighter) |
| `panelDeepAlt` | `bg-[#090d14]` | Alternative deep panel |
| `panelSoft` | `bg-[#0b0f17]/92` | Semi-transparent panel |
| `panelMuted` | `bg-[#0b0f17]/95` | Nearly-opaque panel |
| `card` | `bg-[#111521]` | Card backgrounds (lighter than panel) |
| `cardStrong` | `bg-[#0e1422]/95` | Strong card variant |
| `cardMuted` | `bg-black/40` | Muted card overlay |
| `chip` | `bg-[#1a1d26]` | Chip/tag backgrounds |
| `bgDeep` | `bg-[#0f141f]` | Deep background (between page and panel) |
| `bgPanel` | `bg-[#1e2130]` | Lighter panel background (dividers, separators) |

### Border Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `border` | `border-[#243146]` | Default border |
| `borderPanel` | `border-[#1e2130]` | Panel dividers, section separators |
| `borderSubtle` | `border-[#1f2536]` | Subtle borders (input fields, containers) |
| `borderThin` | `border-[#24283a]` | Thin/light borders |
| `borderStandard` | `border-[#22314b]` | Standard border (slightly brighter) |
| `borderStrong` | `border-[#27364e]` | Strong/emphasized borders |
| `borderDark` | `border-[#2a3246]` | Dark border variant |
| `borderFaint` | `border-[#1a2030]` | Very faint borders |
| `borderHover` | `border-[#2a3045]` | Hover state border |
| `borderDeep` | `border-[#222b3f]` | Deep border variant |
| `borderInteractive` | `border-[#32384d]` | Interactive element borders (buttons, tabs) |
| `borderElevated` | `border-[#31405a]` | Elevated/raised element borders |

### Text Tokens

Organized by visual weight from dimmest to brightest:

| Token | Value | Usage |
|-------|-------|-------|
| `textDim` | `text-[#3a4158]` | Dimmest text (placeholders, very secondary) |
| `textDimMid` | `text-[#556076]` | Dim-mid text (secondary labels) |
| `textMuted` | `text-[#4a5568]` | Muted text (labels, captions) |
| `textMuted2` | `text-[#6b7c95]` | Muted text variant 2 |
| `textMuted3` | `text-[#8ea5cc]` | Muted text variant 3 (lighter) |
| `textMuted4` | `text-[#9ab0ce]` | Muted text variant 4 |
| `textMuted5` | `text-[#8090a8]` | Muted text variant 5 |
| `textMuted7` | `text-[#5f6a82]` | Muted text variant 7 |
| `textSoftMid` | `text-[#6a748b]` | Soft mid text |
| `textSoftBright` | `text-[#8b96ab]` | Soft bright text |
| `textSoftDim` | `text-[#74809a]` | Soft dim text |
| `textSoftMuted` | `text-[#9da8c0]` | Soft muted text |
| `textBody` | `text-[#c7d0e4]` | Default body text |
| `textBody2` | `text-[#d2d9e8]` | Body text variant 2 (slightly brighter) |
| `textBody3` | `text-[#dde2ef]` | Body text variant 3 |
| `textBody4` | `text-[#e6ebf7]` | Body text variant 4 (near-white) |
| `textNear` | `text-[#d7deed]` | Near-white text |
| `textNearAlt` | `text-[#c0c8da]` | Near-white alternative |
| `textBright` | `text-[#edf2ff]` | Brightest text (headings, emphasis) |
| `textAccent` | `text-[#7dd3fc]` | Accent text (links, highlights) |

### Hover State Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `hoverBg` | `hover:bg-[#1a2333]` | Default hover background |
| `hoverBgSubtle` | `hover:bg-[#101725]` | Subtle hover background |
| `hoverBgMuted` | `hover:bg-[#171c2b]` | Muted hover background |
| `hoverBgDark` | `hover:bg-[#1e2235]` | Dark hover background |
| `hoverBorder` | `hover:border-[#2a3045]` | Default hover border |
| `hoverBorderBright` | `hover:border-[#3b4a69]` | Bright hover border |
| `hoverBorderSubtle` | `hover:border-[#32384d]` | Subtle hover border |
| `hoverText` | `hover:text-white` | Hover text (white) |
| `hoverTextSoft` | `hover:text-[#9da8c0]` | Soft hover text |

---

## UI_SURFACES_RAW — Raw Hex Mirror

A type-safe mirror of `UI_SURFACES` providing raw hex values for CSS-in-JS
`style` props where Tailwind class strings cannot be used. Typed as
`Record<keyof typeof UI_SURFACES, string>` to enforce that every token has a
corresponding raw hex value and catch typos at compile time.

### When to use UI_SURFACES_RAW vs UI_SURFACES

| Context | Use | Example |
|---------|-----|---------|
| JSX `className` (template literal) | `UI_SURFACES` | `` className={`${UI_SURFACES.panel}`} `` |
| `cn()` utility | `UI_SURFACES` | `cn(UI_SURFACES.card, ...)` |
| `style={{ color }}` / `style={{ backgroundColor }}` | `UI_SURFACES_RAW` | `style={{ color: UI_SURFACES_RAW.textBody }}` |
| Three.js materials (`color`, `emissive`) | `UI_SURFACES_RAW` | `{ color: UI_SURFACES_RAW.textBright }` |
| SVG `fill` / `stroke` attributes | `UI_SURFACES_RAW` | `fill={UI_SURFACES_RAW.card}` |

### Usage

```tsx
import { UI_SURFACES_RAW } from "@/lib/studio-surface-tokens";

// In style props (bare property access — NOT template literal syntax):
<div style={{ backgroundColor: UI_SURFACES_RAW.panel, color: UI_SURFACES_RAW.textBody }}>
  Content
</div>

// In Three.js materials:
const material = new THREE.MeshStandardMaterial({
  color: UI_SURFACES_RAW.card,
  emissive: UI_SURFACES_RAW.bgDeep,
});

// In SVG attributes:
<circle fill={UI_SURFACES_RAW.textAccent} />
```

### Opacity Note

Some `UI_SURFACES` tokens include Tailwind opacity modifiers (e.g.,
`panelSoft: "bg-[#0b0f17]/92"`, `cardMuted: "bg-black/40"`). The corresponding
`UI_SURFACES_RAW` entries contain only the base hex without opacity. This is an
acceptable trade-off — CSS-in-JS consumers can apply opacity via `rgba()` if
needed.

---

## UI_TONES — Semantic Tone Tokens

6 semantic tones for status, alerts, and attention signals. Each tone provides
14 class variants (text, border, bg, hover) at different intensity levels,
plus a `raw` hex value for CSS-in-JS style props.

### Usage

```tsx
import { UI_TONES, toneForStatus } from "@/lib/design-tokens";

// Direct tone access (Tailwind class):
<span className={UI_TONES.danger.textBright}>Error</span>
<div className={UI_TONES.success.bgSoft}>Passed</div>

// Direct tone access (raw hex for style props):
<span style={{ color: UI_TONES.danger.raw }}>Error</span>

// Helper for status-based resolution:
<span className={UI_TONES[toneForStatus(zone.status)].text}>
  {zone.status}
</span>

// Helper for delta-based resolution:
<span className={UI_TONES[toneForDelta(delta, true)].text}>
  {delta > 0 ? "+" : ""}{delta}%
</span>
```

### Tone Palette

| Tone | Color Family | Semantic Meaning |
|------|-------------|-----------------|
| `success` | emerald | Passing zones, good coverage, positive deltas |
| `warning` | amber | Marginal coverage, pending states, caution |
| `danger` | rose | Failing zones, critical issues, negative deltas |
| `info` | sky | Informational, identification quality, links |
| `accent` | violet | Verified, premium features, special emphasis |
| `neutral` | slate | Inactive, disabled, off states |

### Variant Reference

Each tone provides these variants (using `success` as example):

| Variant | Tailwind Class | Intensity |
|---------|---------------|-----------|
| `raw` | `#22c55e` | Raw hex for CSS-in-JS style props |
| `text` | `text-emerald-300` | Standard text |
| `textBright` | `text-emerald-400` | Brighter text (icons, emphasis) |
| `textDim` | `text-emerald-200` | Dimmer text |
| `textLight` | `text-emerald-100` | Lightest text (on dark bg) |
| `border` | `border-emerald-500/30` | Standard border |
| `borderLight` | `border-emerald-400/20` | Lighter border |
| `borderStrong` | `border-emerald-400/35` | Stronger border |
| `bg` | `bg-emerald-500/12` | Standard background |
| `bgSubtle` | `bg-emerald-500/8` | Subtle background (~8% opacity) |
| `bgSoft` | `bg-emerald-500/10` | Soft background (~10% opacity) |
| `bgStrong` | `bg-emerald-500/25` | Strong background (~25% opacity) |
| `dot` | `bg-emerald-400` | Status dot (solid) |
| `bgHover` | `hover:bg-emerald-500/10` | Hover background |
| `borderHover` | `hover:border-emerald-500/30` | Hover border |

### Helper Functions

```tsx
import { toneForStatus, toneForDelta } from "@/lib/design-tokens";

// Resolve tone from zone/camera status:
toneForStatus("pass")    // → "success"
toneForStatus("fail")    // → "danger"
toneForStatus("warn")    // → "warning"
toneForStatus("pending") // → "warning"
toneForStatus("live")    // → "success"
toneForStatus("off")     // → "neutral"

// Resolve tone for a signed delta:
toneForDelta(5.2, true)   // → "success" (positive, positiveIsGood)
toneForDelta(-3.1, true)  // → "danger"  (negative, positiveIsGood)
toneForDelta(0.01, true)  // → "neutral" (near zero)
```

---

## TYPE_SCALE — Typography Tiers

8 named tiers replacing ad-hoc `text-[10px]` usage. Each tier maps to a
CSS variable that bumps at the tablet breakpoint for field use.

```tsx
import { TYPE_SCALE } from "@/lib/design-tokens";

// Use the class (tablet-aware):
<span className={TYPE_SCALE.caption.class}>Label</span>

// Use the pixel value (for canvas measurement):
const fontSize = TYPE_SCALE.kpi.px; // 22
```

| Tier | Px | Usage |
|------|-----|-------|
| `micro` | 9 | Shortcut chips, super-dense status dots |
| `caption` | 10 | Tab labels, badge text, KPI sublabels |
| `body-sm` | 11 | Issue descriptions, secondary panel text |
| `body` | 12 | Default body, list items |
| `label` | 13 | Section headers, primary button text |
| `heading` | 15 | Panel titles |
| `display` | 18 | Modal titles, hero numbers |
| `kpi` | 22 | Big metric values |

---

## MAP_COLORS — Canvas Palette

Owned by `@/components/map/map-colors`. Used **only** for canvas/map geometry
(walls, doors, cameras, paths, quality levels). Never use in chrome UI.

```tsx
import { MAP_COLORS } from "@/components/map/map-colors";

// Canvas geometry only:
<line stroke={MAP_COLORS.wall} />
<meshBasicMaterial color={MAP_COLORS.quality.none} />
```

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-19 | `UI_TONES` owns chrome semantic palette | Eliminated ~30 files of ad-hoc Tailwind color drift |
| 2026-06-19 | `MAP_COLORS` owns canvas palette | Separated geometry colors from UI colors |
| 2026-07-09 | Consolidated 67 → 53 `UI_SURFACES` tokens | Removed 15 near-duplicate pairs (e.g., borderMid→border) |
| 2026-07-09 | Migrated ~1,800+ raw hex → token references | Eliminated color drift across all studio chrome |
| 2026-07-09 | Added hex drift CI guard (`hex-drift-detect.ts`) | Prevents future raw hex regression |
| 2026-07-11 | Added `UI_SURFACES_RAW` (Record<keyof typeof UI_SURFACES, string>) | Raw hex mirror for CSS-in-JS style props — eliminates hardcoded hex in Three.js, SVG, and inline styles |
| 2026-07-11 | Migrated 81 CSS-in-JS hex → `UI_SURFACES_RAW` references | Type-safe raw hex access across 29 files (38 CSS-in-JS replacements) |

---

## Contribution Guidelines

### Adding a new token

1. **Determine the layer:** Is this a neutral surface color or a semantic state?
   - Neutral → `UI_SURFACES` in `studio-surface-tokens.ts` (also add raw hex to `UI_SURFACES_RAW`)
   - Semantic → `UI_TONES` in `design-tokens.ts`
   - Canvas geometry → `MAP_COLORS` in `map-colors.ts`

2. **Check for duplicates:** Compare the hex value against existing tokens.
   If within RGB distance 6 of an existing token, use that token instead.

3. **Name consistently:**
   - Backgrounds: `bg*`, `panel*`, `card*`, `page`
   - Borders: `border*`
   - Text: `text*`, `textBody*`, `textMuted*`, `textSoft*`, `textDim*`
   - Hover: `hover*`

4. **Update both `UI_SURFACES` and `UI_SURFACES_RAW`:** Every new Tailwind
   class token must have a corresponding raw hex entry.

5. **Update this doc:** Add the new token to the appropriate table.

### Adding a new tone variant

1. Add the variant to the `ToneClasses` interface in `design-tokens.ts`
2. Add the value to all 6 tone definitions
3. Update this doc's variant reference table

### Prohibited patterns

```tsx
// ❌ Raw hex in className
<div className="bg-[#0b0f17]">
<div className="text-[#c7d0e4]">

// ❌ Ad-hoc Tailwind colors for chrome
<div className="text-emerald-300">  // Use UI_TONES.success.text instead
<div className="bg-red-500/10">     // Use UI_TONES.danger.bg instead

// ❌ Hardcoded hex in style props (use UI_SURFACES_RAW)
<div style={{ color: "#c7d0e4" }}>      // Use UI_SURFACES_RAW.textBody
<meshBasicMaterial color="#0b0f17" />   // Use UI_SURFACES_RAW.panel

// ✅ Token-based (Tailwind className)
<div className={UI_SURFACES.panel}>
<div className={UI_TONES.danger.textBright}>

// ✅ Token-based (CSS-in-JS style props)
<div style={{ color: UI_SURFACES_RAW.textBody }}>
<meshBasicMaterial color={UI_SURFACES_RAW.panel} />
```

### Exceptions (raw hex allowed)

- **Three.js materials** (if not using `UI_SURFACES_RAW`): `<meshBasicMaterial color="#ef4444" />`
- **SVG attributes** (if not using `UI_SURFACES_RAW`): `<stop stopColor="#ef4444" />`
- **Canvas palette:** `MAP_COLORS` values (canvas geometry only)
- **Tailwind opacity modifiers** that cannot be expressed as token: `bg-[#0b0f17]/92` (use `UI_SURFACES.panelSoft` instead)

### CI enforcement

The `hex-drift-detect.ts` tool (integrated into `studio-quality-gate.sh`) scans
all studio chrome files for raw hex patterns and fails CI if the count increases
above the baseline. To update the baseline after intentional changes:

```bash
bun tools/hex-drift-detect.ts --update
```

---

## Current State

| Metric | Value |
|--------|-------|
| `UI_SURFACES` tokens | 69 |
| `UI_SURFACES_RAW` entries | 53 (typed as `Record<keyof typeof UI_SURFACES, string>`) |
| `UI_TONES` tones × variants | 6 × 15 = 90 class fragments + 6 raw hex values |
| `TYPE_SCALE` tiers | 8 |
| Total `UI_SURFACES` usages | ~7,497 |
| Total `UI_SURFACES_RAW` usages | ~38 |
| Total `UI_TONES` usages | ~173 |
| Files importing `UI_SURFACES` | 156 |
| Files importing `UI_SURFACES_RAW` | 9 |
| Files importing `UI_TONES` | 13 |
| Remaining raw hex (Tailwind className) | ~149 (135 bare + 14 hover) |
| Remaining raw hex (CSS-in-JS, non-token) | ~158 (Three.js, SVG, canvas — mostly MAP_COLORS) |
| Hex drift baseline | 158 patterns (CI enforced) |
