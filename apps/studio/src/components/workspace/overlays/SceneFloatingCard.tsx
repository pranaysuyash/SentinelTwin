/**
 * Base floating card shell for R3F Html overlays.
 * Uses raw inline styles — R3F Html runs outside the Tailwind/DOM context.
 */

interface SceneFloatingCardProps {
  children: React.ReactNode;
  borderColor?: string;
  textAlign?: "left" | "center" | "right";
  minWidth?: number;
  compact?: boolean;
}

export function SceneFloatingCard({
  children,
  borderColor = "#29456d",
  textAlign = "left",
  minWidth,
  compact,
}: SceneFloatingCardProps) {
  return (
    <div
      style={{
        background: "rgba(10,13,19,0.9)",
        border: `1px solid ${borderColor}`,
        borderRadius: compact ? 4 : 6,
        padding: compact ? "2px 6px" : "4px 8px",
        boxShadow: "0 10px 24px rgba(0,0,0,0.26)",
        backdropFilter: "blur(5px)",
        textAlign,
        whiteSpace: "nowrap",
        ...(minWidth ? { minWidth } : {}),
      }}
    >
      {children}
    </div>
  );
}
