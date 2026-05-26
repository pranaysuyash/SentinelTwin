const CAMERA_COLOR_PALETTE = [
  "#60a5fa",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#fb7185",
  "#22d3ee",
  "#f97316",
  "#c084fc",
  "#84cc16",
  "#e879f9",
  "#2dd4bf",
] as const;

export function getCameraColor(index: number) {
  return CAMERA_COLOR_PALETTE[index % CAMERA_COLOR_PALETTE.length] ?? CAMERA_COLOR_PALETTE[0]!;
}

export function getCameraColorForId(id: string, index?: number) {
  if (index != null) {
    return getCameraColor(index);
  }

  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return CAMERA_COLOR_PALETTE[hash % CAMERA_COLOR_PALETTE.length] ?? CAMERA_COLOR_PALETTE[0]!;
}
