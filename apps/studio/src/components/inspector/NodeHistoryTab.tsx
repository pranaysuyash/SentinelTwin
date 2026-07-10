import { useMemo } from "react";
import { History, RotateCcw, Clock } from "lucide-react";
import { useStudioStore } from "@/store/studio-store";
import { SectionCard } from "@/components/shared/SectionCard";
import { Badge } from "@/components/shared/Badge";
import { reconstructSceneFromEvidence } from "@/lib/operational-evidence";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function NodeHistoryTab({ nodeId }: { nodeId: string }) {
  const { operationalEvidenceEvents, setScene } = useStudioStore();

  const nodeEvents = useMemo(() => {
    return operationalEvidenceEvents
      .filter((e) => e.affectedNodeIds.includes(nodeId))
      .sort((a, b) => b.timestamp - a.timestamp); // newest first
  }, [operationalEvidenceEvents, nodeId]);

  if (nodeEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-[#6a748b]">
        No history available for this node.
      </div>
    );
  }

  const handleRestore = (eventId: string, title: string) => {
    if (confirm(`Restore scene to state at: ${title}?`)) {
      const reconstructed = reconstructSceneFromEvidence(operationalEvidenceEvents, eventId);
      if (reconstructed) {
        setScene(reconstructed);
      }
    }
  };

  return (
    <div className="space-y-2.5 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[#5f6f8e] flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Node Evidence History
      </div>
      
      {nodeEvents.map((event, i) => (
        <SectionCard key={event.id} title={event.title}>
          <div className="flex justify-between items-start mb-2">
            <div className="text-[10px] text-[#8192b0] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(event.timestamp).toLocaleString()}
            </div>
            <Badge variant="blue">{event.kind}</Badge>
          </div>
          
          <div className="text-[11px] text-[#c7d0e4] mb-3">
            {event.details}
          </div>

          <div className="`{flex justify-end border-t ${UI_SURFACES.borderPanel} pt-2 mt-2}`">
             <button
                type="button"
                onClick={() => handleRestore(event.id, event.title)}
                className="flex items-center gap-1 text-[10px] text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Restore Scene to This Point
              </button>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
