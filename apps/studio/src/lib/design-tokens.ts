/**
 * @sentineltwin/studio — semantic UI tone tokens (Visual Pass V1)
 *
 * Single source of truth for the *semantic* UI palette (success/warning/danger/
 * info/accent/neutral). Components rendering chrome — badges, status dots,
 * delta chips, attention signals — should consume these instead of raw Tailwind
 * color utilities (`text-emerald-300`, `bg-sky-500/10`, etc.), which had drifted
 * across ~30 files with no canonical owner.
 *
 * Scope boundary (per `motto_v3 §11` — no conflated sources of truth):
 *   - `MAP_COLORS` (`@/components/map/map-colors.ts`) owns the *canvas* palette —
 *     deterministic colors tied to simulation primitives (walls, doors, paths,
 *     quality levels). Geometry-only.
 *   - `UI_TONES` (this module) owns the *chrome* palette — semantic states for
 *     status badges, confidence bands, attention signals, deltas. UI-only.
 *   - The two never overlap; a component picks based on whether it renders
 *     canvas geometry or chrome.
 *
 * The values mirror the existing `:root` CSS variables (`--green`, `--amber`,
 * `--red`, `--blue`) so this module is the typed TS projection of the CSS token
 * layer — not a parallel invention. Tailwind class fragments (`text`, `border`,
 * `bg`) are pre-composed so consumers don't reinvent the opacity/combination
 * per call site.
 *
 * Visual Pass V1 also ships a lint rule that flags raw Tailwind color utilities
 * in map-adjacent chrome, pointing here. See
 * `Docs/review/UI_REVIEW_2026-06-19.md` Visual Pass V1.
 */

export type UiTone = "success" | "warning" | "danger" | "info" | "accent" | "neutral";

export interface ToneClasses {
  /** Raw hex value for CSS-in-JS style props, e.g. `"#34d399"`. */
  raw: string;
  /** Foreground text class, e.g. `text-emerald-300`. */
  text: string;
  /** Brighter text for icons/emphasis, e.g. `text-emerald-400`. */
  textBright: string;
  /** Dimmer text for secondary content, e.g. `text-emerald-200`. */
  textDim: string;
  /** Border class, e.g. `border-emerald-500/30`. */
  border: string;
  /** Background class, e.g. `bg-emerald-500/12`. */
  bg: string;
  /** Small status-dot bg, e.g. `bg-emerald-400`. */
  dot: string;
  /** Lighter text for emphasis on dark backgrounds, e.g. `text-emerald-100`. */
  textLight: string;
  /** Softer background at ~8% opacity, e.g. `bg-emerald-500/8`. */
  bgSubtle: string;
  /** Lighter background at ~10% opacity, e.g. `bg-emerald-500/10`. */
  bgSoft: string;
  /** Stronger background at ~25% opacity, e.g. `bg-emerald-500/25`. */
  bgStrong: string;
  /** Lighter border at 20% opacity, e.g. `border-emerald-400/20`. */
  borderLight: string;
  /** Stronger border at 35% opacity, e.g. `border-emerald-400/35`. */
  borderStrong: string;
  /** Hover background, e.g. `hover:bg-emerald-500/10`. */
  bgHover: string;
  /** Hover border, e.g. `hover:border-emerald-500/30`. */
  borderHover: string;
}

export type UiToneClasses = Record<UiTone, ToneClasses>;

/**
 * Canonical semantic tone → Tailwind class fragments. Values chosen to match
 * the existing ad-hoc usage (emerald=success, amber=warning, rose=danger,
 * sky=info, violet=accent, slate=neutral) so migrating call sites is mechanical.
 *
 * If the underlying palette changes, change it here once — every consumer
 * updates. That is the point of the consolidation.
 */
export const UI_TONES: UiToneClasses = {
  success: {
    raw: "#34d399",
    text: "text-emerald-300",
    textBright: "text-emerald-400",
    textDim: "text-emerald-200",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/12",
    dot: "bg-emerald-400",
    textLight: "text-emerald-100",
    bgSubtle: "bg-emerald-500/8",
    bgSoft: "bg-emerald-500/10",
    bgStrong: "bg-emerald-500/25",
    borderLight: "border-emerald-400/20",
    borderStrong: "border-emerald-400/35",
    bgHover: "hover:bg-emerald-500/10",
    borderHover: "hover:border-emerald-500/30",
  },
  warning: {
    raw: "#fbbf24",
    text: "text-amber-200",
    textBright: "text-amber-400",
    textDim: "text-amber-300",
    border: "border-amber-500/30",
    bg: "bg-amber-500/12",
    dot: "bg-amber-400",
    textLight: "text-amber-100",
    bgSubtle: "bg-amber-500/8",
    bgSoft: "bg-amber-500/10",
    bgStrong: "bg-amber-500/25",
    borderLight: "border-amber-400/20",
    borderStrong: "border-amber-400/35",
    bgHover: "hover:bg-amber-500/10",
    borderHover: "hover:border-amber-500/30",
  },
  danger: {
    raw: "#f87171",
    text: "text-rose-300",
    textBright: "text-rose-400",
    textDim: "text-rose-200",
    border: "border-rose-500/30",
    bg: "bg-rose-500/12",
    dot: "bg-rose-400",
    textLight: "text-rose-100",
    bgSubtle: "bg-rose-500/8",
    bgSoft: "bg-rose-500/10",
    bgStrong: "bg-rose-500/25",
    borderLight: "border-rose-400/20",
    borderStrong: "border-rose-400/35",
    bgHover: "hover:bg-rose-500/10",
    borderHover: "hover:border-rose-500/30",
  },
  info: {
    raw: "#7dd3fc",
    text: "text-sky-300",
    textBright: "text-sky-400",
    textDim: "text-sky-200",
    border: "border-sky-500/30",
    bg: "bg-sky-500/12",
    dot: "bg-sky-400",
    textLight: "text-sky-100",
    bgSubtle: "bg-sky-500/8",
    bgSoft: "bg-sky-500/10",
    bgStrong: "bg-sky-500/25",
    borderLight: "border-sky-400/20",
    borderStrong: "border-sky-400/35",
    bgHover: "hover:bg-sky-500/10",
    borderHover: "hover:border-sky-500/30",
  },
  accent: {
    raw: "#a78bfa",
    text: "text-violet-300",
    textBright: "text-violet-400",
    textDim: "text-violet-200",
    border: "border-violet-500/30",
    bg: "bg-violet-500/12",
    dot: "bg-violet-400",
    textLight: "text-violet-100",
    bgSubtle: "bg-violet-500/8",
    bgSoft: "bg-violet-500/10",
    bgStrong: "bg-violet-500/25",
    borderLight: "border-violet-400/20",
    borderStrong: "border-violet-400/35",
    bgHover: "hover:bg-violet-500/10",
    borderHover: "hover:border-violet-500/30",
  },
  neutral: {
    raw: "#94a3b8",
    text: "text-slate-300",
    textBright: "text-slate-400",
    textDim: "text-slate-200",
    border: "border-slate-500/30",
    bg: "bg-slate-500/12",
    dot: "bg-slate-400",
    textLight: "text-slate-100",
    bgSubtle: "bg-slate-500/8",
    bgSoft: "bg-slate-500/10",
    bgStrong: "bg-slate-500/25",
    borderLight: "border-slate-400/20",
    borderStrong: "border-slate-400/35",
    bgHover: "hover:bg-slate-500/10",
    borderHover: "hover:border-slate-500/30",
  },
};

/**
 * Resolve a tone from common semantic inputs. Lets callers write
 * `toneForStatus("pass")` rather than spreading ternaries across the codebase.
 */
export function toneForStatus(status: "pass" | "fail" | "warn" | "pending" | "live" | "off"): UiTone {
  switch (status) {
    case "pass":
    case "live":
      return "success";
    case "fail":
      return "danger";
    case "warn":
    case "pending":
      return "warning";
    case "off":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Resolve a tone for a signed delta — positive is good (success) when
 * `positiveIsGood`, otherwise bad (danger). Used by the L1 ambient delta strip
 * and any metric-delta surface. Kept here so the tone mapping is canonical.
 */
export function toneForDelta(delta: number, positiveIsGood: boolean): UiTone {
  if (Math.abs(delta) < 0.05) return "neutral";
  const isImprovement = positiveIsGood ? delta > 0 : delta < 0;
  return isImprovement ? "success" : "danger";
}

// ─── Type scale (Visual Pass V3) ──────────────────────────────────────────

/**
 * Canonical type-scale tiers. Replaces the ad-hoc `text-[10px]`, `text-[9px]`,
 * `text-[11px]`, `text-[12px]` usage scattered across chrome components —
 * each of those is a real tier, but they were never named or documented, so
 * density passes produced inconsistent results across components.
 *
 * Tiers (named, not pixel-literal):
 *   - `micro`     — 9px. Shortcut chips, super-dense status dots.
 *   - `caption`   — 10px. Tab labels, badge text, KPI sublabels.
 *   - `body-sm`   — 11px. Issue descriptions, secondary panel text.
 *   - `body`      — 12px. Default body, list items.
 *   - `label`     — 13px. Section headers, primary button text.
 *   - `heading`   — 15px. Panel titles.
 *   - `display`   — 18px. Modal titles, hero numbers.
 *   - `kpi`       — 22px. Big metric values (Import Trust, footprint).
 *
 * Tablet-aware (per OQ-UI-04 resolution — field-tablet is V1): the TS export
 * is the *desktop* scale; `globals.css` defines CSS variables that bump up at
 * the tablet breakpoint so the on-site scan use case gets a legible scale
 * without per-component media queries. Components that need the JS value
 * (e.g. canvas-measured text) read `TYPE_SCALE[tier].px`; components that
 * just need a class use `TYPE_SCALE[tier].class` which resolves to the CSS var.
 */
export type TypeTier = "micro" | "caption" | "body-sm" | "body" | "label" | "heading" | "display" | "kpi";

export interface TypeTierSpec {
  /** The semantic name (micro / caption / body-sm / body / label / heading / display / kpi). */
  tier: TypeTier;
  /** Desktop pixel size. Tablet bumps this via the CSS variable. */
  px: number;
  /** Tailwind arbitrary-value class bound to the CSS var (tablet-aware). */
  class: string;
}

export const TYPE_SCALE: Record<TypeTier, TypeTierSpec> = {
  micro:    { tier: "micro",    px: 9,  class: "text-[length:var(--fs-micro)]" },
  caption:  { tier: "caption",  px: 10, class: "text-[length:var(--fs-caption)]" },
  "body-sm":{ tier: "body-sm",  px: 11, class: "text-[length:var(--fs-body-sm)]" },
  body:     { tier: "body",     px: 12, class: "text-[length:var(--fs-body)]" },
  label:    { tier: "label",    px: 13, class: "text-[length:var(--fs-label)]" },
  heading:  { tier: "heading",  px: 15, class: "text-[length:var(--fs-heading)]" },
  display:  { tier: "display",  px: 18, class: "text-[length:var(--fs-display)]" },
  kpi:      { tier: "kpi",      px: 22, class: "text-[length:var(--fs-kpi)]" },
};

