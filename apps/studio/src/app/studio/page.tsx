"use client";

import dynamic from "next/dynamic";

const StudioShell = dynamic(() => import("@/components/layout/StudioShell"), {
  ssr: false,
  loading: () => <div className="flex h-screen items-center justify-center text-sm text-zinc-500">Loading studio…</div>,
});

export default function StudioRoutePage() {
  return <StudioShell />;
}
