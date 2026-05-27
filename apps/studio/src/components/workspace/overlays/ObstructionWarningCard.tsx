import { SceneFloatingCard } from "./SceneFloatingCard";

interface ObstructionWarningCardProps {
  obstructionLabel: string;
  affectedCameraName?: string;
}

export function ObstructionWarningCard({ obstructionLabel, affectedCameraName }: ObstructionWarningCardProps) {
  return (
    <SceneFloatingCard borderColor="#ef4444">
      <div style={{ fontSize: 9, fontWeight: 700, color: "#fca5a5" }}>{obstructionLabel.toUpperCase()}</div>
      <div style={{ fontSize: 8, color: "#fecaca", marginTop: 1 }}>
        Blocking {affectedCameraName ?? "camera view"}
      </div>
      <div style={{ fontSize: 8, fontWeight: 500, color: "#fca5a5", marginTop: 2 }}>View obstructed</div>
    </SceneFloatingCard>
  );
}
