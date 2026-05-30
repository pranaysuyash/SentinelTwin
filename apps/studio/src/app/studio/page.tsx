"use client";

import dynamic from "next/dynamic";

const StudioShell = dynamic(() => import("@/components/layout/StudioShell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-[#030611] text-[#9fb1cf]">
      Loading Studio...
    </div>
  ),
});

export default function StudioRoutePage() {
  return <StudioShell />;
}
