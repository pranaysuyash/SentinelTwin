"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { GitCompare, Plus } from "lucide-react";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

import { useStudioStore } from "@/store/studio-store";
import {
  ENVIRONMENT_THEMES,
  SceneLighting,
  SceneFloor,
  SceneWalls,
  SceneDoors,
  SceneWindows,
  SceneObstructions,
  CoverageHeatmapInstanced,
} from "@/components/workspace/SharedScene";
import { cn } from "@/lib/cn";
import type { SimulationResult } from "@/schema/security-scene";

type CoverageCell = SimulationResult["coverageCells"][number];

function ScenePanel({
  label,
  coverageCells,
  isActive = false,
}: {
  label: string;
  coverageCells: CoverageCell[];
  isActive?: boolean;
}) {
  const scene = useStudioStore((s) => s.scene);
  const { width, depth } = scene.dimensions;
  const theme = ENVIRONMENT_THEMES.day;

  const cameraPos = useMemo<[number, number, number]>(() => {
    const cx = width / 2;
    const cz = depth / 2;
    const span = Math.max(width, depth);
    return [cx + width * 0.4, span * 0.72, cz + depth * 0.95];
  }, [width, depth]);

  return (
    <div className={cn(
      "relative flex flex-col overflow-hidden rounded-xl border bg-[#07090d]",
      isActive ? "border-blue-500/50" : "border-[#1f2536]",
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
        isActive ? "border-b border-blue-500/25 bg-blue-500/8 text-blue-300" : "border-b border-[#1e2130] bg-[#0c0f16] text-[#5a6478]",
      )}>
        <span>{label}</span>
        {coverageCells.length > 0 && (
          <span className={cn("font-mono text-[10px]", isActive ? "text-blue-200" : "text-[#8090a8]")}>
            {Math.round(
              (coverageCells.filter((c) => c.quality !== "none").length / coverageCells.length) * 100,
            )}% covered
          </span>
        )}
      </div>

      {/* 3D Canvas */}
      <div className="flex-1">
        <Canvas
          camera={{ position: cameraPos, fov: 44, near: 0.1, far: 200 }}
          gl={{ antialias: true, alpha: false }}
          style={{ width: "100%", height: "100%", background: theme.background }}
          shadows="percentage"
        >
          <color attach="background" args={[theme.background as THREE.ColorRepresentation]} />
          <ambientLight intensity={theme.ambient} />
          <hemisphereLight groundColor="#0b0f15" color="#d9e6ff" intensity={theme.hemisphere} />
          <directionalLight position={[10, 14, 8]} intensity={theme.directional} color="#eef4ff" castShadow />
          <Suspense fallback={null}>
            <SceneLighting theme={theme} />
            <SceneFloor width={width} depth={depth} showGrid={false} />
            <SceneWalls walls={scene.walls} />
            <SceneDoors doors={scene.doors} />
            <SceneWindows windows={scene.windows} />
            <SceneObstructions obstructions={scene.obstructions} selectedId={null} />
            {coverageCells.length > 0 && <CoverageHeatmapInstanced cells={coverageCells} />}
          </Suspense>
          <OrbitControls
            makeDefault
            target={[width / 2, 0.1, depth / 2]}
            minDistance={5.5}
            maxDistance={40}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 2.1}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>
      </div>
    </div>
  );
}

export function CompareView() {
  const snapshots = useStudioStore((s) => s.snapshots);
  const result = useStudioStore((s) => s.simulationResult);

  const snapshotA = snapshots[snapshots.length - 2] ?? snapshots[0];
  const snapshotB = snapshots[snapshots.length - 1];

  // Baseline cells from snapshot A (or empty)
  const cellsA = snapshotA?.simulation?.coverageCells ?? [];
  // Proposed cells from snapshot B or current result
  const cellsB = snapshotB?.simulation?.coverageCells ?? result?.coverageCells ?? [];

  if (snapshots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#07090d]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-[#1f2536]">
          <GitCompare className="h-6 w-6 text-[#2a3246]" />
        </div>
        <div className="text-center">
          <div className="text-[12px] font-medium text-[#4a5568]">No snapshots to compare</div>
          <div className="mt-1 text-[10px] text-[#3a4158]">Save snapshots from the map view to compare scenarios</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#07090d]">
      {/* Scenario selector bar */}
      <div className="flex items-center gap-2 border-b border-[#1e2130] bg-[#0c0f16] px-3 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#4a5568]">Compare</span>
        <div className="flex gap-1.5">
          {snapshots.map((snap, i) => (
            <div
              key={snap.id}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[9px] font-medium",
                i === snapshots.length - 2
                  ? "border-[#24283a] bg-[#111521] text-[#c7d0e4]"
                  : i === snapshots.length - 1
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-transparent text-[#4a5568]",
              )}
            >
              {snap.label}
            </div>
          ))}
        </div>
        <button className="ml-auto flex items-center gap-1 rounded-md border border-[#24283a] bg-[#111521] px-2 py-0.5 text-[9px] text-[#8090a8] hover:text-white">
          <Plus className="h-2.5 w-2.5" />
          Add Scenario
        </button>
      </div>

      {/* Side-by-side panels */}
      <div className="grid flex-1 grid-cols-2 gap-2 overflow-hidden p-2">
        <ScenePanel
          label={`Compare Scenario A${snapshotA ? ` — ${snapshotA.label}` : " (Baseline)"}`}
          coverageCells={cellsA}
          isActive={false}
        />
        <ScenePanel
          label={`Compare Scenario B${snapshotB ? ` — ${snapshotB.label}` : " (Proposed)"}`}
          coverageCells={cellsB}
          isActive={true}
        />
      </div>
    </div>
  );
}
