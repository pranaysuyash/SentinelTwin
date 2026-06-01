import type { StateCreator } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

type CompareCameraState = {
  position: [number, number, number] | null;
  target: [number, number, number] | null;
};

export type ComparisonSlice = {
  compareVisualEvidence: any;
  compareReportSelection: any;
  compareOrbitSync: boolean;
  compareOrbitCameraState: CompareCameraState;

  setCompareVisualEvidence: (evidence: any) => void;
  setCompareReportSelection: (selection: any) => void;
  setCompareOrbitSync: (sync: boolean) => void;
  setCompareOrbitCameraState: (state: CompareCameraState) => void;
};

// ─── Comparison slice creator ─────────────────────────────────────────────────

export const createComparisonSlice = (set: any, get: any): ComparisonSlice => ({
  compareVisualEvidence: null,
  compareReportSelection: null,
  compareOrbitSync: false,
  compareOrbitCameraState: { position: null, target: null },

  setCompareVisualEvidence: (compareVisualEvidence) => set({ compareVisualEvidence }),
  setCompareReportSelection: (compareReportSelection) => set({ compareReportSelection }),
  setCompareOrbitSync: (compareOrbitSync) => set({ compareOrbitSync }),
  setCompareOrbitCameraState: (compareOrbitCameraState) => set({ compareOrbitCameraState }),
});
