/**
 * Base floating card shell for R3F Html overlays.
 */

import type { CSSProperties, ReactNode } from "react";

export interface SceneFloatingCardProps {
  children: ReactNode;
  borderColor?: string;
  textAlign?: "left" | "center" | "right";
  minWidth?: number | string;
  maxWidth?: number | string;
  compact?: boolean;
  className?: string;
  role?: "status" | "note" | "presentation";
  ariaLabel?: string;
  style?: CSSProperties;
  pointerEvents?: CSSProperties["pointerEvents"];
}

type OverlayDimension = number | string | undefined;

function normalizeDimension(value: OverlayDimension): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

const PANEL_BACKGROUND = "rgba(10,13,19,0.9)";
const PANEL_BORDER = "1px solid";
const PANEL_SHADOW = "0 10px 24px rgba(0,0,0,0.26)";
const PANEL_BLUR = "blur(5px)";
const PANEL_RADIUS = { compact: 4, default: 6 };
const PANEL_PADDING = { compact: "2px 6px", default: "4px 8px" };

export function SceneFloatingCard({
  children,
  borderColor = "#29456d",
  textAlign = "left",
  minWidth,
  compact,
  maxWidth,
  className,
  role,
  ariaLabel,
  style,
  pointerEvents = "auto",
}: SceneFloatingCardProps) {
  const panelRadius = compact ? PANEL_RADIUS.compact : PANEL_RADIUS.default;
  const panelPadding = compact ? PANEL_PADDING.compact : PANEL_PADDING.default;

  const baseStyle: CSSProperties = {
    background: PANEL_BACKGROUND,
    border: `${PANEL_BORDER} ${borderColor}`,
    borderRadius: panelRadius,
    padding: panelPadding,
    boxShadow: PANEL_SHADOW,
    backdropFilter: PANEL_BLUR,
    textAlign,
    whiteSpace: "nowrap",
    pointerEvents,
    minWidth: normalizeDimension(minWidth),
    maxWidth: normalizeDimension(maxWidth),
  };

  return (
    <div
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
}
