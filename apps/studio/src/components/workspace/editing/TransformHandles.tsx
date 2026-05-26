export type TransformDragPayload = {
  position: [number, number, number];
  rotationYDeg?: number;
};

export function TransformHandles({
  activeNodeId,
  onDrag,
  onCommit,
  enabled,
}: {
  activeNodeId: string | null;
  enabled: boolean;
  onDrag: (payload: TransformDragPayload) => void;
  onCommit: (payload: TransformDragPayload) => void;
}) {
  if (!activeNodeId || !enabled) return null;

  // Placeholder render layer. Drag events are provided via WorkspaceCanvas wiring.
  if (typeof onDrag !== "function" || typeof onCommit !== "function") {
    return null;
  }

  return null;
}
