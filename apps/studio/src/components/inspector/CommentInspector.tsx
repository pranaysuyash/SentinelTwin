"use client";

import { CheckCircle2, MessageSquare, Trash2, XCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { useStudioStore } from "@/store/studio-store";
import { cn } from "@/lib/cn";
import type { CommentNode } from "@/schema/security-scene";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";


interface CommentInspectorProps {
  comment: CommentNode;
}

export function CommentInspector({ comment }: CommentInspectorProps) {
  const updateComment = useStudioStore((s) => s.updateComment);
  const removeComment = useStudioStore((s) => s.removeComment);
  const resolveComment = useStudioStore((s) => s.resolveComment);
  const scene = useStudioStore((s) => s.scene);
  const selectNode = useStudioStore((s) => s.selectNode);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const attachedNode = comment.attachedToNodeId
    ? findNodeInScene(scene, comment.attachedToNodeId)
    : null;

  const formattedDate = new Date(comment.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSaveEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed.length === 0) return;
    updateComment(comment.id, { text: trimmed });
    setEditing(false);
  }, [comment.id, editText, updateComment]);

  const handleAttachedNodeClick = useCallback(() => {
    if (!comment.attachedToNodeId) return;
    selectNode(comment.attachedToNodeId);
  }, [comment.attachedToNodeId, selectNode]);

  return (
    <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeep} p-2.5}`}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`flex h-5 w-5 items-center justify-center rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card}`}>
            <MessageSquare className="h-2.5 w-2.5 text-cyan-400" />
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${UI_SURFACES.textAccent}`}>
            Comment
          </span>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em]",
            comment.resolved
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300",
          )}
        >
          {comment.resolved ? "Resolved" : "Open"}
        </span>
      </div>

      {/* Author & Date */}
      <div className={`mb-1.5 flex items-center justify-between text-[9px] ${UI_SURFACES.textSoftMid}`}>
        <span className={`font-medium ${UI_SURFACES.textMuted5}`}>{comment.author}</span>
        <span>{formattedDate}</span>
      </div>

      {/* Attached to node */}
      {attachedNode && (
        <div className="mb-1.5">
          <button
            type="button"
            onClick={handleAttachedNodeClick}
            className={`flex items-center gap-1 rounded ${UI_SURFACES.chip} px-1.5 py-0.5 text-[8px] text-blue-300 hover:bg-[#222635] transition-colors`}
          >
            <span className={`${UI_SURFACES.textMuted}`}>Attached to:</span> {getNodeLabel(attachedNode)}
          </button>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className={`w-full rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-1 text-[10px] ${UI_SURFACES.textBody} outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]/50 resize-none`}
            rows={3}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="rounded bg-emerald-600/80 px-2 py-0.5 text-[9px] font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditText(comment.text); }}
              className={`rounded ${UI_SURFACES.chip} px-2 py-0.5 text-[9px] ${UI_SURFACES.textMuted5} ${UI_SURFACES.hoverText} transition-colors`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={`{rounded-lg border ${UI_SURFACES.borderPanel} ${UI_SURFACES.panelDeepAlt} px-2 py-1.5}`}>
          <p className={`text-[10px] leading-relaxed ${UI_SURFACES.textBody} whitespace-pre-wrap`}>
            {comment.text}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1.5">
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`flex items-center gap-1 rounded border ${UI_SURFACES.borderThin} ${UI_SURFACES.card} px-2 py-0.5 text-[8px] ${UI_SURFACES.textMuted5} ${UI_SURFACES.hoverText} transition-colors`}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          onClick={() => resolveComment(comment.id)}
          className={cn(
            "flex items-center gap-1 rounded border px-2 py-0.5 text-[8px] transition-colors",
            comment.resolved
              ? "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
          )}
        >
          <CheckCircle2 className="h-2.5 w-2.5" />
          {comment.resolved ? "Reopen" : "Resolve"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this comment?")) {
              removeComment(comment.id);
            }
          }}
          className="flex items-center gap-1 rounded border border-red-900/40 bg-red-950/15 px-2 py-0.5 text-[8px] text-red-300 hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="h-2.5 w-2.5" />
          Delete
        </button>
      </div>

      {/* Position info */}
      <div className={`mt-1.5 text-[7px] ${UI_SURFACES.textDim}`}>
        Position: ({comment.position[0].toFixed(1)}, {comment.position[1].toFixed(1)}, {comment.position[2].toFixed(1)})
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function findNodeInScene(
  scene: { cameras: Array<{ id: string; name: string }>; obstructions: Array<{ id: string; label: string; nodeType?: string }>; walls: Array<{ id: string; label?: string }>; securityLights: Array<{ id: string; name: string }>; criticalZones: Array<{ id: string; label?: string }>; privacyZones: Array<{ id: string; label?: string }>; sensors: Array<{ id: string; label: string }>; entryPoints: Array<{ id: string; label: string }>; paths: Array<{ id: string; label?: string }>; doors: Array<{ id: string; label?: string }>; windows: Array<{ id: string; label?: string }> },
  nodeId: string,
): { id: string; label: string; nodeType: string } | null {
  const collections: Array<{ id: string; label: string; nodeType: string }> = [
    ...scene.cameras.map((c) => ({ id: c.id, label: c.name, nodeType: "camera" })),
    ...scene.obstructions.map((o) => ({ id: o.id, label: o.label, nodeType: "obstruction" })),
    ...scene.walls.map((w) => ({ id: w.id, label: w.label ?? "Wall", nodeType: "wall" })),
    ...scene.securityLights.map((l) => ({ id: l.id, label: l.name, nodeType: "security_light" })),
    ...scene.criticalZones.map((z) => ({ id: z.id, label: z.label ?? "Zone", nodeType: "critical_zone" })),
    ...scene.privacyZones.map((z) => ({ id: z.id, label: z.label ?? "Privacy Zone", nodeType: "privacy_zone" })),
    ...scene.sensors.map((s) => ({ id: s.id, label: s.label, nodeType: "sensor" })),
    ...scene.entryPoints.map((e) => ({ id: e.id, label: e.label, nodeType: "entry_point" })),
    ...scene.paths.map((p) => ({ id: p.id, label: p.label ?? "Path", nodeType: "path" })),
    ...scene.doors.map((d) => ({ id: d.id, label: d.label ?? "Door", nodeType: "door" })),
    ...scene.windows.map((w) => ({ id: w.id, label: w.label ?? "Window", nodeType: "window" })),
  ];
  return collections.find((entry) => entry.id === nodeId) ?? null;
}

function getNodeLabel(node: { label: string; nodeType?: string }): string {
  return node.label || node.nodeType || "Unknown";
}
