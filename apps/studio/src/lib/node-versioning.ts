import type { SecurityScene, AnyEditableNode } from "@/schema/security-scene";
import type { OperationalEvidenceEvent } from "@/lib/operational-evidence";

export type NodeVersionRecord = {
  nodeId: string;
  nodeType: AnyEditableNode["nodeType"];
  version: number;
  timestamp: number;
  causeEventId: string | null;
  causeEventTitle: string | null;
  author: string;
  changeDescription: string;
};

export type EvidenceLink = {
  id: string;
  eventId: string;
  nodeId: string;
  nodeType: AnyEditableNode["nodeType"];
  linkedAt: number;
  linkType: "created" | "modified" | "removed" | "verified" | "calibrated" | "reviewed";
  description: string;
};

export type NodeVersionHistory = {
  nodeId: string;
  nodeType: AnyEditableNode["nodeType"];
  label: string;
  versions: NodeVersionRecord[];
  evidenceLinks: EvidenceLink[];
  currentVersion: number;
};

export type NodeVersioningState = {
  histories: Map<string, NodeVersionHistory>;
  evidenceLinks: EvidenceLink[];
};

function makeNodeKey(nodeId: string, nodeType: string): string {
  return `${nodeType}:${nodeId}`;
}

function getNodeLabel(node: AnyEditableNode): string {
  const n = node as unknown as { label?: string; name?: string; id: string };
  return n.label ?? n.name ?? n.id;
}

export function buildNodeVersionHistory(
  scene: SecurityScene,
  events: OperationalEvidenceEvent[],
): NodeVersioningState {
  const histories = new Map<string, NodeVersionHistory>();
  const evidenceLinks: EvidenceLink[] = [];

  const allNodes: AnyEditableNode[] = [
    ...scene.walls,
    ...scene.doors,
    ...scene.windows,
    ...scene.cameras,
    ...scene.securityLights,
    ...scene.obstructions,
    ...scene.sensors,
    ...scene.criticalZones,
    ...scene.privacyZones,
    ...scene.paths,
    ...scene.entryPoints,
    ...scene.comments as unknown as AnyEditableNode[],
  ];

  for (const node of allNodes) {
    const key = makeNodeKey(node.id, node.nodeType);
    if (!histories.has(key)) {
      histories.set(key, {
        nodeId: node.id,
        nodeType: node.nodeType,
        label: getNodeLabel(node),
        versions: [],
        evidenceLinks: [],
        currentVersion: 0,
      });
    }
  }

  for (const event of events) {
    if (!event.affectedNodeIds) continue;
    for (const nodeId of event.affectedNodeIds) {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const key = makeNodeKey(nodeId, node.nodeType);
      const history = histories.get(key);
      if (!history) continue;

      const version = history.versions.length + 1;
      history.versions.push({
        nodeId,
        nodeType: node.nodeType,
        version,
        timestamp: event.timestamp,
        causeEventId: event.id,
        causeEventTitle: event.title,
        author: event.actor ?? "system",
        changeDescription: event.details ?? event.title,
      });
      history.currentVersion = version;

      const link: EvidenceLink = {
        id: `el_${event.id}_${nodeId}`,
        eventId: event.id,
        nodeId,
        nodeType: node.nodeType,
        linkedAt: event.timestamp,
        linkType: event.kind === "scene_published" ? "verified" : "modified",
        description: event.title,
      };
      evidenceLinks.push(link);
      history.evidenceLinks.push(link);
    }
  }

  return { histories, evidenceLinks };
}

export function getNodeVersionAtTime(
  state: NodeVersioningState,
  nodeId: string,
  nodeType: AnyEditableNode["nodeType"],
  timestamp: number,
): NodeVersionRecord | null {
  const key = makeNodeKey(nodeId, nodeType);
  const history = state.histories.get(key);
  if (!history) return null;
  const sorted = [...history.versions].sort((a, b) => b.timestamp - a.timestamp);
  return sorted.find((v) => v.timestamp <= timestamp) ?? null;
}

export function getEvidenceLinksForNode(
  state: NodeVersioningState,
  nodeId: string,
  nodeType: AnyEditableNode["nodeType"],
): EvidenceLink[] {
  const key = makeNodeKey(nodeId, nodeType);
  return state.histories.get(key)?.evidenceLinks ?? [];
}

export function getEvidenceLinksForEvent(
  state: NodeVersioningState,
  eventId: string,
): EvidenceLink[] {
  return state.evidenceLinks.filter((l) => l.eventId === eventId);
}
