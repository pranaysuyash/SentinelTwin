import type { ScanCaptureSession, ScanWarning } from "@/lib/scan-artifacts";
import {
  addPhotoToSession,
  addCandidateToSession,
  addWarning,
  updateScanCaptureSession,
  linkArtifactToCandidate,
} from "@/lib/scan-artifacts";
import type { ScanAdapterSet, DetectionResult } from "@/lib/scan-adapters/types";
import { getDefaultAdapterSet } from "@/lib/scan-adapters/registry";
import {
  estimateOverallConfidence,
  computeQualityGates,
  computeDefaultWarnings,
  compileReconstructionToScene,
} from "@/lib/scan-reconstruction";
import type { SiteTwinDraft, SiteCompilerResult } from "@/lib/site-compiler";
import { compileToSiteTwinDraft } from "@/lib/site-compiler";

export type RunResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DetectionRunReport = {
  totalPhotos: number;
  photosWithDetections: number;
  totalCandidates: number;
  pendingCount: number;
  avgCandidateConfidence: number;
  warnings: string[];
  usedAdapterIds: string[];
};

export type ReconstructionRunReport = {
  detection: DetectionRunReport;
  session: ScanCaptureSession;
  draft: SiteTwinDraft;
  compilerResult: SiteCompilerResult;
  confidence: number;
  qualityReport: ReturnType<typeof computeQualityGates>;
  warnings: ScanWarning[];
};

export type RunOptions = {
  adapters?: ScanAdapterSet;
  autoAcceptThreshold?: number;
};

const DEFAULT_OPTIONS: RunOptions = {
  autoAcceptThreshold: 0,
};

async function runDetection(
  session: ScanCaptureSession,
  adapters: ScanAdapterSet,
): Promise<{ session: ScanCaptureSession; report: DetectionRunReport }> {
  let updated = { ...session };
  const allAdapterWarnings: string[] = [];
  const usedAdapterIds: string[] = [];
  const photos = updated.photos;

  for (const adapter of adapters.objectDetection) {
    usedAdapterIds.push(adapter.id);
    for (const photo of photos) {
      try {
        const result = await adapter.detect(photo, updated);

        for (const artifact of result.artifacts) {
          updated = updateScanCaptureSession(updated, {
            artifacts: [...updated.artifacts, artifact],
          });
        }

        for (const candidate of result.candidates) {
          updated = addCandidateToSession(updated, candidate);
        }

        for (const candidate of result.candidates) {
          updated = linkArtifactToCandidate(updated, photo.id, candidate.id);
        }

        allAdapterWarnings.push(...result.warnings);
      } catch (err) {
        allAdapterWarnings.push(
          `Adapter ${adapter.id} failed on photo ${photo.id}: ${err}`,
        );
      }
    }
  }

  const detectionReport: DetectionRunReport = {
    totalPhotos: photos.length,
    photosWithDetections: photos.length,
    totalCandidates: updated.candidates.length,
    pendingCount: updated.candidates.filter((c) => c.status === "pending").length,
    avgCandidateConfidence:
      updated.candidates.length > 0
        ? Math.round(
            (updated.candidates.reduce((s, c) => s + c.confidence, 0) /
              updated.candidates.length) *
              1000,
          ) / 1000
        : 0,
    warnings: allAdapterWarnings,
    usedAdapterIds,
  };

  return { session: updated, report: detectionReport };
}

export async function runReconstruction(
  session: ScanCaptureSession,
  options: RunOptions = {},
): Promise<RunResult<ReconstructionRunReport>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const adapters = opts.adapters ?? getDefaultAdapterSet();

  if (session.photos.length === 0) {
    return { ok: false, error: "Cannot run reconstruction: no photos in session." };
  }

  try {
    const defaulted = computeDefaultWarnings(session);
    const { session: withCandidates, report: detectionReport } =
      await runDetection(defaulted, adapters);

    let autoAccepted = withCandidates;
    if (opts.autoAcceptThreshold && opts.autoAcceptThreshold > 0) {
      autoAccepted = updateScanCaptureSession(autoAccepted, {
        candidates: autoAccepted.candidates.map((c) =>
          c.status === "pending" && c.confidence >= (opts.autoAcceptThreshold ?? 0)
            ? { ...c, status: "accepted" as const }
            : c,
        ),
      });
    }

    const finalSession = computeDefaultWarnings(autoAccepted);
    const qualityReport = computeQualityGates(finalSession);
    const { compilerResult, compileWarnings } =
      compileReconstructionToScene(finalSession);
    const draft = compileToSiteTwinDraft(
      compilerResult,
      finalSession.photos.map(
        (p) =>
          `${p.sourceFileName ?? "unnamed"} (${"role" in p ? (p as any).role ?? "unassigned" : "unassigned"})`,
      ),
    );
    const confidence = estimateOverallConfidence(finalSession);

    return {
      ok: true,
      data: {
        detection: detectionReport,
        session: finalSession,
        draft,
        compilerResult,
        confidence,
        qualityReport,
        warnings: [...finalSession.warnings, ...compileWarnings],
      },
    };
  } catch (err) {
    return { ok: false, error: `Reconstruction failed: ${err}` };
  }
}
