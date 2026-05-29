import { normalizeOperationalEvidenceEvents, type OperationalEvidenceEvent } from "@/lib/operational-evidence";

export type OperationalEvidenceJournalEntryKind = "append" | "merge" | "replace";

export type OperationalEvidenceJournalMergeResolution = "same" | "append" | "rebase" | "divergent" | "reset";

export type OperationalEvidenceJournalEntry = {
  id: string;
  kind: OperationalEvidenceJournalEntryKind;
  timestamp: number;
  reason: string;
  resolution?: OperationalEvidenceJournalMergeResolution;
  baseEventId?: string | null;
  currentHeadId?: string | null;
  incomingHeadId?: string | null;
  events: OperationalEvidenceEvent[];
};

export type OperationalEvidenceJournal = {
  version: 1;
  entries: OperationalEvidenceJournalEntry[];
};

type OperationalEvidencePersistenceState = {
  format: "empty" | "legacy" | "journal";
  events: OperationalEvidenceEvent[];
  journal: OperationalEvidenceJournal | null;
};

export type OperationalEvidenceJournalClassification = {
  resolution: OperationalEvidenceJournalMergeResolution;
  reason: string;
  baseEventId: string | null;
  currentHeadId: string | null;
  incomingHeadId: string | null;
};

function cloneEvents(events: OperationalEvidenceEvent[]) {
  return events.map((event) => structuredClone(event));
}

function compareOperationalEvidenceEvents(left: OperationalEvidenceEvent[], right: OperationalEvidenceEvent[]) {
  if (left.length !== right.length) return false;
  return left.every((event, index) => {
    const other = right[index];
    return Boolean(
      other
      && event.id === other.id
      && event.kind === other.kind
      && event.timestamp === other.timestamp
      && event.sceneId === other.sceneId
      && event.sceneName === other.sceneName,
    );
  });
}

function isPrefixOperationalEvidenceEvents(prefix: OperationalEvidenceEvent[], events: OperationalEvidenceEvent[]) {
  if (prefix.length > events.length) return false;
  return prefix.every((event, index) => {
    const other = events[index];
    return Boolean(other && event.id === other.id && event.kind === other.kind && event.timestamp === other.timestamp);
  });
}

function createJournalEntry(
  kind: OperationalEvidenceJournalEntryKind,
  events: OperationalEvidenceEvent[],
  reason: string,
  classification?: Partial<OperationalEvidenceJournalClassification>,
): OperationalEvidenceJournalEntry {
  const timestamp = Date.now();
  return {
    id: `${kind}:${timestamp.toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    kind,
    timestamp,
    reason,
    resolution: classification?.resolution,
    baseEventId: classification?.baseEventId ?? null,
    currentHeadId: classification?.currentHeadId ?? null,
    incomingHeadId: classification?.incomingHeadId ?? null,
    events: cloneEvents(events),
  };
}

function normalizeJournalEntry(raw: unknown): OperationalEvidenceJournalEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<OperationalEvidenceJournalEntry> & { events?: unknown };
  if (
    typeof candidate.id !== "string"
    || (candidate.kind !== "append" && candidate.kind !== "merge" && candidate.kind !== "replace")
    || typeof candidate.timestamp !== "number"
    || typeof candidate.reason !== "string"
  ) {
    return null;
  }
  const events = normalizeOperationalEvidenceEvents(candidate.events);
  return {
    id: candidate.id,
    kind: candidate.kind,
    timestamp: candidate.timestamp,
    reason: candidate.reason,
    resolution: candidate.resolution === "same" || candidate.resolution === "append" || candidate.resolution === "rebase" || candidate.resolution === "divergent" || candidate.resolution === "reset"
      ? candidate.resolution
      : undefined,
    baseEventId: typeof candidate.baseEventId === "string" ? candidate.baseEventId : null,
    currentHeadId: typeof candidate.currentHeadId === "string" ? candidate.currentHeadId : null,
    incomingHeadId: typeof candidate.incomingHeadId === "string" ? candidate.incomingHeadId : null,
    events,
  };
}

export function normalizeOperationalEvidenceJournal(raw: unknown): OperationalEvidenceJournal | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Partial<OperationalEvidenceJournal> & { entries?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.entries)) return null;
  const entries = candidate.entries.flatMap((entry) => {
    const normalized = normalizeJournalEntry(entry);
    return normalized ? [normalized] : [];
  });
  return {
    version: 1,
    entries,
  };
}

export function reconstructOperationalEvidenceJournal(journal: OperationalEvidenceJournal) {
  let events: OperationalEvidenceEvent[] = [];
  for (const entry of journal.entries) {
    if (entry.kind === "replace" || entry.kind === "merge") {
      events = cloneEvents(entry.events);
      continue;
    }
    events = [...events, ...cloneEvents(entry.events)];
  }
  return events;
}

export function classifyOperationalEvidenceJournalTransition(
  current: OperationalEvidenceEvent[],
  incoming: OperationalEvidenceEvent[],
): OperationalEvidenceJournalClassification {
  const currentHeadId = current.at(-1)?.id ?? null;
  const incomingHeadId = incoming.at(-1)?.id ?? null;

  if (compareOperationalEvidenceEvents(current, incoming)) {
    return {
      resolution: "same",
      reason: "The incoming evidence matches the current journal state.",
      baseEventId: currentHeadId,
      currentHeadId,
      incomingHeadId,
    };
  }

  if (current.length === 0 && incoming.length > 0) {
    return {
      resolution: "append",
      reason: "The journal is empty and can append the incoming evidence directly.",
      baseEventId: null,
      currentHeadId,
      incomingHeadId,
    };
  }

  if (isPrefixOperationalEvidenceEvents(current, incoming)) {
    return {
      resolution: "append",
      reason: "The incoming evidence extends the current journal head.",
      baseEventId: currentHeadId,
      currentHeadId,
      incomingHeadId,
    };
  }

  if (isPrefixOperationalEvidenceEvents(incoming, current)) {
    return {
      resolution: "rebase",
      reason: "The incoming evidence rewinds to an earlier checkpoint and can be reopened as a branch-aware merge batch.",
      baseEventId: incoming.at(-1)?.id ?? null,
      currentHeadId,
      incomingHeadId,
    };
  }

  return {
    resolution: "divergent",
    reason: "The incoming evidence diverges from the current branch and requires an explicit journal merge batch.",
    baseEventId: current.length > 0 && incoming.length > 0 ? current[0]?.id ?? null : null,
    currentHeadId,
    incomingHeadId,
  };
}

export function loadOperationalEvidenceEventsFromRaw(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeOperationalEvidenceEvents(parsed);
    }

    const journal = normalizeOperationalEvidenceJournal(parsed);
    if (!journal) return [];
    return reconstructOperationalEvidenceJournal(journal);
  } catch {
    return [];
  }
}

export function loadOperationalEvidenceJournalFromRaw(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeOperationalEvidenceJournal(parsed);
  } catch {
    return null;
  }
}

function parseOperationalEvidencePersistence(raw: string | null): OperationalEvidencePersistenceState {
  if (!raw) {
    return { format: "empty", events: [], journal: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return {
        format: "legacy",
        events: normalizeOperationalEvidenceEvents(parsed),
        journal: null,
      };
    }

    const journal = normalizeOperationalEvidenceJournal(parsed);
    if (!journal) {
      return { format: "empty", events: [], journal: null };
    }

    return {
      format: "journal",
      events: reconstructOperationalEvidenceJournal(journal),
      journal,
    };
  } catch {
    return { format: "empty", events: [], journal: null };
  }
}

export function serializeOperationalEvidenceJournal(raw: string | null, nextEvents: OperationalEvidenceEvent[]) {
  const nextNormalized = normalizeOperationalEvidenceEvents(nextEvents);
  const current = parseOperationalEvidencePersistence(raw);
  const classification = classifyOperationalEvidenceJournalTransition(current.events, nextNormalized);

  if (compareOperationalEvidenceEvents(current.events, nextNormalized)) {
    if (current.format === "journal" && raw) {
      return raw;
    }

    const migrated: OperationalEvidenceJournal = {
      version: 1,
      entries: current.events.length > 0
        ? [createJournalEntry("replace", current.events, "legacy migration", {
            resolution: "same",
            baseEventId: current.events.at(-1)?.id ?? null,
            currentHeadId: current.events.at(-1)?.id ?? null,
            incomingHeadId: current.events.at(-1)?.id ?? null,
          })]
        : [],
    };
    return JSON.stringify(migrated);
  }

  const journal: OperationalEvidenceJournal = current.journal ?? {
    version: 1,
    entries: current.events.length > 0
      ? [createJournalEntry("replace", current.events, current.format === "legacy" ? "legacy migration" : "seed snapshot", {
          resolution: "same",
          baseEventId: current.events.at(-1)?.id ?? null,
          currentHeadId: current.events.at(-1)?.id ?? null,
          incomingHeadId: current.events.at(-1)?.id ?? null,
        })]
      : [],
  };

  if (nextNormalized.length === 0) {
    journal.entries.push(createJournalEntry("replace", [], "clear", {
      resolution: "reset",
      baseEventId: currentHeadLengthAwareId(current.events),
      currentHeadId: current.events.at(-1)?.id ?? null,
      incomingHeadId: null,
    }));
    return JSON.stringify(journal);
  }

  if (classification.resolution === "append") {
    journal.entries.push(createJournalEntry("append", nextNormalized.slice(current.events.length), "append", classification));
    return JSON.stringify(journal);
  }

  if (classification.resolution === "rebase") {
    journal.entries.push(createJournalEntry("merge", nextNormalized, classification.reason, classification));
    return JSON.stringify(journal);
  }

  journal.entries.push(createJournalEntry("merge", nextNormalized, classification.reason, classification));
  return JSON.stringify(journal);
}

function currentHeadLengthAwareId(events: OperationalEvidenceEvent[]) {
  return events.at(-1)?.id ?? null;
}
