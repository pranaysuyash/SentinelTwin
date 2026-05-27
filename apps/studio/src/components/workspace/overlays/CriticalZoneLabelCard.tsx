import { SceneFloatingCard } from "./SceneFloatingCard";

interface CriticalZoneLabelCardProps {
  label: string;
  requiredQuality: string;
  status: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  compact?: boolean;
}

export function CriticalZoneLabelCard({
  label,
  requiredQuality,
  status,
  borderColor,
  badgeBg,
  badgeText,
  compact,
}: CriticalZoneLabelCardProps) {
  if (compact) {
    return (
      <SceneFloatingCard borderColor={borderColor} textAlign="center" compact>
        <div style={{ fontSize: 7, fontWeight: 700, color: "#f7d94a" }}>{label.toUpperCase()}</div>
      </SceneFloatingCard>
    );
  }

  return (
    <SceneFloatingCard borderColor={borderColor} textAlign="center">
      <div style={{ fontSize: 9, fontWeight: 700, color: "#f7d94a" }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 8, color: "#e5d875", fontWeight: 600, marginTop: 1 }}>
        {requiredQuality.toUpperCase()} REQUIRED
      </div>
      <div style={{ marginTop: 4 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 8,
            fontWeight: 700,
            background: badgeBg,
            color: badgeText,
          }}
        >
          {status === "pass" ? "PASS" : status === "fail" ? "FAILS" : status.toUpperCase()}
        </span>
      </div>
    </SceneFloatingCard>
  );
}
