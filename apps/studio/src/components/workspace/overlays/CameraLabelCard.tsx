import { SceneFloatingCard } from "./SceneFloatingCard";
import type { CameraNode } from "@/schema/security-scene";
import { UI_SURFACES_RAW } from "@/lib/studio-surface-tokens";

type CameraMountType = CameraNode["mountType"];
type CameraStatus = CameraNode["status"];
type CameraStatusText = "Active" | "Offline" | "Blocked" | "Dirty" | "Malfunction" | string;

const MOUNT_LABELS: Record<CameraMountType, string> = {
  wall: "Wall",
  ceiling: "Ceiling",
  pole: "Pole",
  corner: "Corner",
  desk: "Desk",
};

const STATUS_LABELS: Record<CameraStatus, string> = {
  on: "Active",
  off: "Offline",
  blocked: "Blocked",
  dirty: "Dirty",
  malfunctioning: "Malfunction",
};

const STATUS_COLORS: Record<CameraStatus, string> = {
  off: "#ef4444",
  blocked: "#f97316",
  dirty: "#facc15",
  malfunctioning: "#ef4444",
  on: "#22c55e",
};

function getStatusText(isActive: boolean, status: CameraStatus): CameraStatusText {
  return isActive ? "Active" : STATUS_LABELS[status] ?? "Offline";
}

function statusColor(isActive: boolean, status: CameraStatus) {
  if (isActive) return "#4ade80";
  return STATUS_COLORS[status] ?? "#ef4444";
}

interface CameraLabelCardProps {
  name: string;
  resolutionMP: number;
  mountType: CameraMountType;
  isActive: boolean;
  status: CameraStatus;
  selected: boolean;
  hovered?: boolean;
  compact?: boolean;
  isSuggested?: boolean;
}

export function CameraLabelCard({ name, resolutionMP, mountType, isActive, status, selected, hovered, compact, isSuggested }: CameraLabelCardProps) {
  const isEmphasized = selected || hovered;
  const resolvedStatusText = getStatusText(isActive, status);

  if (compact) {
    return (
      <SceneFloatingCard
        borderColor={isEmphasized ? "#60a5fa" : "#29456d"}
        compact
        pointerEvents="none"
      >
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: isActive ? "#22c55e" : statusColor(isActive, status) }}
            aria-hidden="true"
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
          <span style={{ fontSize: 6, fontWeight: 600, color: isEmphasized ? "#9ca3af" : "#64748b" }}>
            {resolvedStatusText}
          </span>
        </div>
      </SceneFloatingCard>
    );
  }

  return (
    <SceneFloatingCard
      borderColor={isEmphasized ? "#60a5fa" : "#29456d"}
      role="status"
      ariaLabel={`${name} camera ${resolvedStatusText}`}
      pointerEvents="none"
    >
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
      <div style={{ fontWeight: 400, fontSize: 8, color: UI_SURFACES_RAW.textSoftDim }}>
        {resolutionMP}MP · {MOUNT_LABELS[mountType]} mount
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: statusColor(isActive, status) }} />
        <span style={{ fontSize: 7, color: statusColor(isActive, status) }}>
          {resolvedStatusText}
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
