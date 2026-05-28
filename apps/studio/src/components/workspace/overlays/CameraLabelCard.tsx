import { SceneFloatingCard } from "./SceneFloatingCard";

interface CameraLabelCardProps {
  name: string;
  resolutionMP: number;
  mountType: string;
  isActive: boolean;
  status: string;
  selected: boolean;
  hovered?: boolean;
  compact?: boolean;
  isSuggested?: boolean;
}

export function CameraLabelCard({ name, resolutionMP, mountType, isActive, status, selected, hovered, compact, isSuggested }: CameraLabelCardProps) {
  const isEmphasized = selected || hovered;
  if (compact) {
    return (
      <SceneFloatingCard borderColor={isEmphasized ? "#60a5fa" : "#29456d"} compact>
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: isActive ? "#22c55e" : "#ef4444" }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 7,
              color: isEmphasized ? "#dbeafe" : "#8bc0ff",
              letterSpacing: "0.04em",
            }}
          >
            {name.toUpperCase()}
          </span>
        </div>
      </SceneFloatingCard>
    );
  }

  return (
    <SceneFloatingCard borderColor={isEmphasized ? "#60a5fa" : "#29456d"}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 9, color: isEmphasized ? "#dbeafe" : "#8bc0ff" }}>
          {name.toUpperCase()}
        </span>
        {isSuggested && (
          <span style={{ fontSize: 6, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.08em", padding: "1px 4px", borderRadius: 2, border: "1px solid #f59e0b", opacity: 0.8 }}>
            SUGGESTED
          </span>
        )}
      </div>
      <div style={{ fontWeight: 400, fontSize: 8, color: "#73809a" }}>
        {resolutionMP}MP {mountType === "ceiling" ? "Dome" : "Bullet"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: isActive ? "#22c55e" : "#ef4444" }} />
        <span style={{ fontSize: 7, color: isActive ? "#4ade80" : "#ef4444" }}>
          {isActive ? "Active" : status}
        </span>
        {hovered && !selected ? (
          <span style={{ marginLeft: 4, fontSize: 6, fontWeight: 700, color: "#a5b4fc", letterSpacing: "0.08em" }}>
            CLICK TO SELECT
          </span>
        ) : null}
      </div>
    </SceneFloatingCard>
  );
}
