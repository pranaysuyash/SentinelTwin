"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Video } from "lucide-react";
import { useEffect } from "react";
import * as THREE from "three";

import "@/lib/three-compat";
import { getYawPitchDirection } from "@sentineltwin/core";
import { getCameraPreset } from "@/components/workspace/camera-preset-utils";
import { SceneFeedGeometry } from "@/components/view/SceneFeedCanvas";
import { ENVIRONMENT_THEMES } from "@/components/workspace/SharedScene";
import { DEFAULT_PLACEMENT_YAW_DEG } from "@/components/workspace/workspace-canvas-utils";
import { useStudioStore } from "@/store/studio-store";

import { UI_SURFACES } from "@/lib/studio-surface-tokens";
/**
 * Live placement preview — answers "if the camera is here at this angle,
 * what does it see?" before the camera exists.
 *
 * Renders the canonical scene geometry from the hover/aim pose in a small
 * picture-in-picture canvas while the camera tool is active. The pose comes
 * from the same store-backed editor state the 3D ghost uses, so the preview
 * and the wedge can never disagree.
 */

interface GhostPose {
  x: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
  heightM: number;
  fovDeg: number;
  aiming: boolean;
}

function GhostCameraRig({ pose }: { pose: GhostPose }) {
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const forward = getYawPitchDirection(pose.yawDeg, pose.pitchDeg);
    const position = new THREE.Vector3(pose.x, pose.heightM, pose.z);
    const target = position.clone().add(forward.clone().multiplyScalar(8));
    camera.position.copy(position);
    camera.lookAt(target);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = Math.min(pose.fovDeg, 120);
      camera.updateProjectionMatrix();
    }
  }, [camera, pose.fovDeg, pose.heightM, pose.pitchDeg, pose.x, pose.yawDeg, pose.z]);

  return null;
}

export function PlacementPreviewPanel() {
  const activeTool = useStudioStore((s) => s.activeTool);
  const hoverPoint = useStudioStore((s) => s.editor.hoverPoint);
  const placementAim = useStudioStore((s) => s.editor.placementAim);
  const cameraPresetId = useStudioStore((s) => s.cameraPresetId);
  const environmentMode = useStudioStore((s) => s.environmentMode);

  if (activeTool !== "camera") return null;

  const preset = getCameraPreset(cameraPresetId);
  const anchor = placementAim?.anchor ?? hoverPoint;
  if (!anchor) return null;

  const pose: GhostPose = {
    x: anchor[0],
    z: anchor[1],
    yawDeg: placementAim?.yawDeg ?? DEFAULT_PLACEMENT_YAW_DEG,
    pitchDeg: -20,
    heightM: 2.8,
    fovDeg: preset?.fovHorizontalDeg ?? 90,
    aiming: Boolean(placementAim),
  };

  const theme = ENVIRONMENT_THEMES[environmentMode] ?? ENVIRONMENT_THEMES.day;

  return (
    <div className={`pointer-events-none absolute bottom-16 right-3 z-20 w-[260px] overflow-hidden rounded-xl border ${UI_SURFACES.borderSubtle} ${UI_SURFACES.panel}/96 shadow-2xl shadow-black/45`}>
      <div className={`flex items-center justify-between gap-2 border-b ${UI_SURFACES.borderPanel} px-2.5 py-1.5`}>
        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-200">
          <Video className="h-3 w-3" />
          Camera Preview
        </div>
        <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-sky-200">
          {pose.aiming ? "Aiming" : "Hover"}
        </span>
      </div>
      <div className="relative h-[140px] w-full">
        <Canvas
          gl={{ antialias: true, alpha: false }}
          camera={{ fov: pose.fovDeg, near: 0.1, far: 80, position: [pose.x, pose.heightM, pose.z] }}
          style={{ width: "100%", height: "100%", background: theme.background }}
        >
          <color attach="background" args={[theme.background]} />
          <GhostCameraRig pose={pose} />
          <SceneFeedGeometry theme={theme} />
        </Canvas>
        <div className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
          Simulated render
        </div>
      </div>
      <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 text-[9px] ${UI_SURFACES.textSoftBright}`}>
        <span>
          {pose.x.toFixed(1)}, {pose.z.toFixed(1)}m · {pose.yawDeg}° · FOV {pose.fovDeg}°
        </span>
        <span className={`truncate ${UI_SURFACES.textSoftMid}`}>{preset ? preset.label : "Default optics"}</span>
      </div>
    </div>
  );
}
