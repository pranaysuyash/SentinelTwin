import type { SecurityScene } from "@/schema/security-scene";

export const SCENE_SOURCE_META: Record<
  SecurityScene["source"],
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  manual: {
    label: "Manual Draft",
    shortLabel: "Manual",
    description: "Scene built directly in Studio.",
  },
  ai: {
    label: "AI Draft",
    shortLabel: "AI",
    description: "Scene drafted from a prompt-backed layout generation flow.",
  },
  scan: {
    label: "Scan Import",
    shortLabel: "Scan",
    description: "Scene compiled from manual-assisted scan input.",
  },
  import: {
    label: "Imported Scene",
    shortLabel: "Import",
    description: "Scene created from a floor plan or external import.",
  },
  preset: {
    label: "Preset Scene",
    shortLabel: "Preset",
    description: "Scene seeded from a built-in template or preset.",
  },
  demo: {
    label: "Demo Scene",
    shortLabel: "Demo",
    description: "Reference demo scene bundled with Studio.",
  },
};

export function normalizeSceneSource(source: SecurityScene["source"]): SecurityScene["source"] {
  return source;
}

export function getSceneSourceMeta(source: SecurityScene["source"]) {
  return SCENE_SOURCE_META[normalizeSceneSource(source)];
}