import { SceneFloatingCard } from "./SceneFloatingCard";

interface CameraLabelCardProps {
  name: string;
  resolutionMP: number;
  mountType: string;
  isActive: boolean;
  status: string;
  selected: boolean;
}

export function CameraLabelCard({ name, resolutionMP, mountType, isActive, status, selected }: CameraLabelCardProps) {
  return (
    <SceneFloatingCard borderColor={selected ? "#60a5fa" : "#29456d"}>
      <div style={{ fontWeight: 700, fontSize: 9, color: selected ? "#cfe2ff" : "#8bc0ff" }}>
        {name.toUpperCase()}
      </div>
      <div style={{ fontWeight: 400, fontSize: 8, color: "#73809a" }}>
        {resolutionMP}MP {mountType === "ceiling" ? "Dome" : "Bullet"}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: isActive ? "#22c55e" : "#ef4444" }} />
        <span style={{ fontSize: 7, color: isActive ? "#4ade80" : "#ef4444" }}>
          {isActive ? "Active" : status}
        </span>
      </div>
    </SceneFloatingCard>
  );
}
