export type TruthLabelKind = "computed" | "inferred" | "imported" | "simulated" | "placeholder" | "live";

export function truthLabelText(kind: TruthLabelKind) {
  switch (kind) {
    case "computed":
      return "Computed";
    case "inferred":
      return "Inferred";
    case "imported":
      return "Imported";
    case "simulated":
      return "Simulated";
    case "placeholder":
      return "Placeholder";
    case "live":
      return "Live";
    default:
      return "Unknown";
  }
}

export function truthLabelDetail(kind: TruthLabelKind) {
  switch (kind) {
    case "computed":
      return "Derived from the current scene and simulation state.";
    case "inferred":
      return "Inferred from evidence, scene structure, or heuristics.";
    case "imported":
      return "Imported from scene data or archive state.";
    case "simulated":
      return "Derived from the current scene and simulation state.";
    case "placeholder":
      return "Temporary fallback pending real data.";
    case "live":
      return "Pulled from the live runtime state.";
    default:
      return "Truth source unknown.";
  }
}
