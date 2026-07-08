"use client";

import { MonitorSmartphone } from "lucide-react";

type MobileEditGateProps = {
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Blocks a creation/editing surface below MOBILE_EDIT_BREAKPOINT_PX. Viewing
 * surfaces (camera wall, replay, compare, report, analytics) never render
 * this — only site-intake and the workspace canvas do.
 */
export function MobileEditGate({
  title = "Editing needs a bigger screen",
  body = "Building and editing scenes requires precise camera placement and drag controls that don't work well on a phone. Switch to a tablet or larger display to continue.",
  actionLabel,
  onAction,
}: MobileEditGateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6" style={{ background: "var(--bg)" }}>
      <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
        <MonitorSmartphone className="h-8 w-8 text-[color:var(--text-muted)]" />
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="text-xs leading-relaxed text-[color:var(--text-muted)]">{body}</p>
        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[color:var(--text-muted)] hover:text-white"
          >
            {actionLabel ?? "Go back"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
