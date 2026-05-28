"use client";

import { useState } from "react";

import { useStudioStore } from "@/store/studio-store";

export function BulkCameraEditor() {
  const scene = useStudioStore((s) => s.scene);
  const updateNode = useStudioStore((s) => s.updateNode);
  const [yawDelta, setYawDelta] = useState(0);
  const [pitchDelta, setPitchDelta] = useState(0);
  const [fovDelta, setFovDelta] = useState(0);
  const [rangeDelta, setRangeDelta] = useState(0);

  const applyAll = () => {
    for (const camera of scene.cameras) {
      updateNode(camera.id, {
        yawDeg: camera.yawDeg + yawDelta,
        pitchDeg: camera.pitchDeg + pitchDelta,
        fovHorizontalDeg: Math.max(20, Math.min(140, camera.fovHorizontalDeg + fovDelta)),
        rangeM: Math.max(2, camera.rangeM + rangeDelta),
      });
    }
  };

  const setNightAll = (mode: "none" | "ir" | "low_light") => {
    for (const camera of scene.cameras) {
      updateNode(camera.id, { nightMode: mode });
    }
  };

  return (
    <div className="space-y-3 p-3 text-[11px] text-[#c8d6ee]">
      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
        <div className="text-[11px] font-semibold text-white">Bulk Camera Editor</div>
        <div className="mt-1 text-[10px] text-[#8091af]">Apply global camera transforms across {scene.cameras.length} cameras.</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <div>Yaw Delta (deg)</div>
            <input type="number" value={yawDelta} onChange={(e) => setYawDelta(Number(e.target.value || 0))} className="w-full rounded border border-[#2a3248] bg-[#111521] px-2 py-1" />
          </label>
          <label className="space-y-1">
            <div>Pitch Delta (deg)</div>
            <input type="number" value={pitchDelta} onChange={(e) => setPitchDelta(Number(e.target.value || 0))} className="w-full rounded border border-[#2a3248] bg-[#111521] px-2 py-1" />
          </label>
          <label className="space-y-1">
            <div>FOV Delta (deg)</div>
            <input type="number" value={fovDelta} onChange={(e) => setFovDelta(Number(e.target.value || 0))} className="w-full rounded border border-[#2a3248] bg-[#111521] px-2 py-1" />
          </label>
          <label className="space-y-1">
            <div>Range Delta (m)</div>
            <input type="number" value={rangeDelta} onChange={(e) => setRangeDelta(Number(e.target.value || 0))} className="w-full rounded border border-[#2a3248] bg-[#111521] px-2 py-1" />
          </label>
        </div>
        <button onClick={applyAll} className="mt-3 rounded border border-sky-500/35 px-3 py-1.5 text-[10px] text-sky-200 hover:bg-sky-500/10">Apply to All Cameras</button>
      </div>

      <div className="rounded-xl border border-[#1f2536] bg-[#0b0f17] p-3">
        <div className="text-[11px] font-semibold text-white">Night Mode Batch</div>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setNightAll("none")} className="rounded border border-[#2a3248] px-2 py-1">Off</button>
          <button onClick={() => setNightAll("ir")} className="rounded border border-[#2a3248] px-2 py-1">IR</button>
          <button onClick={() => setNightAll("low_light")} className="rounded border border-[#2a3248] px-2 py-1">Low-light</button>
        </div>
      </div>
    </div>
  );
}
