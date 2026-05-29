import { normalizeOperationalEvidenceArchive, type OperationalEvidenceArchive } from "@/lib/operational-evidence-archive";

export type OperationalEvidenceArchiveHistoryRecord = {
  historyId: string;
  exportedAt: string;
  storedAt: number;
  restoreBranch: "draft" | "recovered" | "published";
  archive: OperationalEvidenceArchive;
};

export const OPERATIONAL_EVIDENCE_ARCHIVE_HISTORY_LIMIT = 8;

export function createOperationalEvidenceArchiveHistoryRecord(
  archive: OperationalEvidenceArchive,
  restoreBranch: OperationalEvidenceArchiveHistoryRecord["restoreBranch"] = "draft",
  storedAt = Date.now(),
): OperationalEvidenceArchiveHistoryRecord {
  const latestEventId = archive.operationalEvidenceEvents.at(-1)?.id ?? null;
  return {
    historyId: latestEventId ?? `${archive.scene.id}:${storedAt}`,
    exportedAt: archive.exportedAt,
    storedAt,
    restoreBranch,
    archive,
  };
}

export function normalizeOperationalEvidenceArchiveHistory(raw: unknown): OperationalEvidenceArchiveHistoryRecord[] {
  if (!raw || typeof raw !== "object") return [];
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<OperationalEvidenceArchiveHistoryRecord> & { archive?: unknown };
    if (
      typeof candidate.historyId !== "string"
      || typeof candidate.exportedAt !== "string"
      || typeof candidate.storedAt !== "number"
      || (candidate.restoreBranch !== "draft" && candidate.restoreBranch !== "recovered" && candidate.restoreBranch !== "published")
    ) {
      return [];
    }

    const archive = normalizeOperationalEvidenceArchive(candidate.archive);
    if (!archive) return [];

    return [{
      historyId: candidate.historyId,
      exportedAt: candidate.exportedAt,
      storedAt: candidate.storedAt,
      restoreBranch: candidate.restoreBranch,
      archive,
    }];
  }).sort((a, b) => b.storedAt - a.storedAt).slice(0, OPERATIONAL_EVIDENCE_ARCHIVE_HISTORY_LIMIT);
}

export function serializeOperationalEvidenceArchiveHistory(history: OperationalEvidenceArchiveHistoryRecord[]) {
  return JSON.stringify(history.slice(0, OPERATIONAL_EVIDENCE_ARCHIVE_HISTORY_LIMIT), null, 2);
}
