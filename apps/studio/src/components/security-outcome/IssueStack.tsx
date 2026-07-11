"use client";

import { focusIssueCamera, focusIssueZone } from "@/lib/security-outcome/security-outcome-actions";
import type { OutcomeIssueCard } from "@/lib/security-outcome/security-outcome-model";
import { useStudioStore } from "@/store/studio-store";
import { ExplainBadge } from "@/components/shared/ExplainBadge";
import { IssueCard } from "./IssueCard";
import { UI_SURFACES } from "@/lib/studio-surface-tokens";

export function IssueStack({ issues, compact = false }: { issues: OutcomeIssueCard[]; compact?: boolean }) {
  const store = useStudioStore();
  return (
    <section className={`rounded-xl border UI_SURFACES.borderSubtle UI_SURFACES.panel p-3`}>
      <div className="flex items-center gap-2">
        <h3 className={`text-[10px] font-semibold uppercase tracking-[0.16em] UI_SURFACES.textMuted3`}>Top Issues</h3>
        <ExplainBadge text="Prioritized findings by severity. Use focus and camera actions to inspect evidence in-scene." />
      </div>
      <div className="mt-2 space-y-2">
        {issues.length === 0 ? <div className={`text-[10px] UI_SURFACES.textSoftDim`}>No open issues in current simulation.</div> : null}
        {(compact ? issues.slice(0, 3) : issues).map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onFocusZone={(zoneId) => focusIssueZone(store, zoneId)}
            onViewCamera={(cameraId) => focusIssueCamera(store, cameraId)}
          />
        ))}
      </div>
    </section>
  );
}
