"use client";

import { TimerReset } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Section } from "./shared";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";
import type { OperationalEvidenceJournalEntry } from "@/lib/operational-evidence-journal";

export interface EvidenceJournalSectionProps {
  journalEntries: OperationalEvidenceJournalEntry[];
  journalAppendCount: number;
  journalMergeCount: number;
  journalReplaceCount: number;
}

export function EvidenceJournalSection({
  journalEntries,
  journalAppendCount,
  journalMergeCount,
  journalReplaceCount,
}: EvidenceJournalSectionProps) {
  return (
    <Section title="Evidence Journal" icon={<TimerReset className="h-3 w-3 text-sky-400" />}>
      <div className="space-y-2">
        <div className={`text-[10px] UI_SURFACES.textSoftDim`}>
          Append-only journal batches keep the browser evidence trail as records instead of a single rewritten array.
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <div className={`rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-2 py-1.5`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted7`}>Batches</div>
            <div className={`mt-0.5 text-[13px] font-semibold UI_SURFACES.textBright`}>{journalEntries.length}</div>
          </div>
          <div className={`rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-2 py-1.5`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted7`}>Append</div>
            <div className={`mt-0.5 text-[13px] font-semibold UI_SURFACES.textBright`}>{journalAppendCount}</div>
          </div>
          <div className={`rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-2 py-1.5`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted7`}>Merge</div>
            <div className={`mt-0.5 text-[13px] font-semibold UI_SURFACES.textBright`}>{journalMergeCount}</div>
          </div>
          <div className={`rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-2 py-1.5`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted7`}>Replace</div>
            <div className={`mt-0.5 text-[13px] font-semibold UI_SURFACES.textBright`}>{journalReplaceCount}</div>
          </div>
        </div>
        <div className="space-y-1.5">
          {journalEntries.length > 0 ? (
            [...journalEntries].slice(-4).reverse().map((entry) => (
              <div key={entry.id} className={`rounded-md border UI_SURFACES.borderPanel UI_SURFACES.bgDeep px-3 py-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={`text-[11px] font-semibold UI_SURFACES.textBright`}>{entry.reason}</div>
                  <Badge variant={entry.kind === "append" ? "green" : entry.kind === "merge" ? "blue" : "amber"}>{entry.kind}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="gray">{entry.events.length} event{entry.events.length === 1 ? "" : "s"}</Badge>
                  <Badge variant="gray">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>
                  {entry.resolution ? <Badge variant="gray">{entry.resolution}</Badge> : null}
                </div>
              </div>
            ))
          ) : (
            <div className={`rounded-md border border-dashed UI_SURFACES.border UI_SURFACES.panel px-3 py-3 text-[10px] UI_SURFACES.textSoftDim`}>
              No journal entries yet.
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
