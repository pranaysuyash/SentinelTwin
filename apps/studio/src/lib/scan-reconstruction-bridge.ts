import type {
  PhotoArtifact,
  ScanCaptureSession,
  ScanCandidate,
  ScanOperationalContext,
  ScanOperationalMode,
} from "@/lib/scan-artifacts";
import {
  createScanCaptureSession,
  createPhotoArtifact,
  createScanCandidateFromArtifact,
  addPhotoToSession,
  addCandidateToSession,
} from "@/lib/scan-artifacts";
import {
  runReconstruction,
  type RunResult,
  type ReconstructionRunReport,
} from "@/lib/scan-reconstruction-runner";
import type { SiteTwinDraft } from "@/lib/site-compiler";
import { compileReconstructionToSiteTwinDraft } from "@/lib/scan-reconstruction";

export type CapturePhotoInput = {
  dataUrl: string;
  fileName: string;
  widthPx: number;
  heightPx: number;
  role?: string;
};

export type FullReconstructionOptions = {
  roomDimensions?: {
    widthM?: number;
    depthM?: number;
    heightM?: number;
  };
  knownMeasurements?: Array<{ label: string; valueM: number; source: "user" | "estimated" }>;
  operationalMode?: ScanOperationalMode;
  operationalContext?: ScanOperationalContext;
};

export async function runFullReconstruction(
  sceneName: string,
  photos: CapturePhotoInput[],
  options?: FullReconstructionOptions,
): Promise<RunResult<ReconstructionRunReport>> {
  const session = createScanCaptureSession(
    sceneName,
    "ai_assisted",
    options?.operationalMode ?? "permanent",
  );

  if (options?.roomDimensions) {
    session.roomDimensions = options.roomDimensions;
  }

  if (options?.knownMeasurements) {
    session.knownMeasurements = options.knownMeasurements;
  }

  if (options?.operationalContext) {
    session.operationalContext = options.operationalContext;
  }

  for (const photoInput of photos) {
    const photoArtifact = createPhotoArtifact(
      photoInput.dataUrl,
      photoInput.fileName,
      photoInput.widthPx,
      photoInput.heightPx,
      photoInput.role as PhotoArtifact["role"],
    );
    session.photos.push(photoArtifact);
    session.artifacts.push(photoArtifact);
  }

  return runReconstruction(session, { autoAcceptThreshold: 0 });
}

export function compileCurrentSession(
  session: ScanCaptureSession,
): SiteTwinDraft {
  return compileReconstructionToSiteTwinDraft(session);
}
