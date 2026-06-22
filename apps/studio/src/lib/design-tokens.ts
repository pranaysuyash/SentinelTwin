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
  /** Foreground text class, e.g. `text-emerald-300`. */
  text: string;
  /** Border class, e.g. `border-emerald-500/30`. */
  border: string;
  /** Background class, e.g. `bg-emerald-500/12`. */
  bg: string;
  /** Small status-dot bg, e.g. `bg-emerald-400`. */
  dot: string;
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
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/12",
    dot: "bg-emerald-400",
  },
  warning: {
    text: "text-amber-200",
    border: "border-amber-500/30",
    bg: "bg-amber-500/12",
    dot: "bg-amber-400",
  },
  danger: {
    text: "text-rose-300",
    border: "border-rose-500/30",
    bg: "bg-rose-500/12",
    dot: "bg-rose-400",
  },
  info: {
    text: "text-sky-300",
    border: "border-sky-500/30",
    bg: "bg-sky-500/12",
    dot: "bg-sky-400",
  },
  accent: {
    text: "text-violet-300",
    border: "border-violet-500/30",
    bg: "bg-violet-500/12",
    dot: "bg-violet-400",
  },
  neutral: {
    text: "text-slate-300",
    border: "border-slate-500/30",
    bg: "bg-slate-500/12",
    dot: "bg-slate-400",
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

