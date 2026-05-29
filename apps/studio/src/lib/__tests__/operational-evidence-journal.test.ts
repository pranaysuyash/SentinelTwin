import { describe, expect, test } from "bun:test";

import { buildOperationalEvidenceEvent } from "@/lib/operational-evidence";
import {
  loadOperationalEvidenceEventsFromRaw,
  serializeOperationalEvidenceJournal,
} from "@/lib/operational-evidence-journal";

function makeEvent(sceneId: string, sceneName: string, kind: "scene_created" | "scene_updated", timestamp: number) {
  return buildOperationalEvidenceEvent({
    kind,
    title: kind === "scene_created" ? "Scene created" : "Scene updated",
    details: kind === "scene_created" ? "Seeded evidence baseline." : "Recorded an append-only update.",
    actor: "user",
    source: "manual",
    sceneId,
    sceneName,
    revisionDepth: 1,
    affectedNodeIds: [],
    confidence: 0.95,
    timestamp,
  });
}

describe("operational evidence journal", () => {
  test("migrates legacy arrays into append-only journal entries and reconstructs the same events", () => {
    const first = makeEvent("scene_1", "Retail Draft", "scene_created", 1000);
    const second = makeEvent("scene_1", "Retail Draft", "scene_updated", 2000);

    const legacyRaw = JSON.stringify([first]);
    const migrated = serializeOperationalEvidenceJournal(legacyRaw, [first, second]);
    const journal = JSON.parse(migrated) as { version: number; entries: Array<{ kind: string; events: unknown[] }> };

    expect(journal.version).toBe(1);
    expect(journal.entries).toHaveLength(2);
    expect(journal.entries[0]?.kind).toBe("replace");
    expect(journal.entries[1]?.kind).toBe("append");
    expect(loadOperationalEvidenceEventsFromRaw(migrated)).toHaveLength(2);
  });

  test("records a replace batch for clears and reconstructs an empty ledger", () => {
    const first = makeEvent("scene_1", "Retail Draft", "scene_created", 1000);
    const second = makeEvent("scene_1", "Retail Draft", "scene_updated", 2000);

    const journalRaw = serializeOperationalEvidenceJournal(null, [first, second]);
    const clearedRaw = serializeOperationalEvidenceJournal(journalRaw, []);
    const journal = JSON.parse(clearedRaw) as { version: number; entries: Array<{ kind: string; events: unknown[] }> };

    expect(journal.version).toBe(1);
    expect(journal.entries.at(-1)?.kind).toBe("replace");
    expect(journal.entries.at(-1)?.events).toEqual([]);
    expect(loadOperationalEvidenceEventsFromRaw(clearedRaw)).toHaveLength(0);
  });

  test("records a merge batch when the incoming evidence diverges from the current journal", () => {
    const currentFirst = makeEvent("scene_1", "Retail Draft", "scene_created", 1000);
    const currentSecond = makeEvent("scene_1", "Retail Draft", "scene_updated", 2000);
    const incomingFork = makeEvent("scene_1", "Retail Draft", "scene_updated", 3000);
    const incomingTail = makeEvent("scene_1", "Retail Draft", "scene_updated", 4000);

    const journalRaw = serializeOperationalEvidenceJournal(null, [currentFirst, currentSecond]);
    const mergedRaw = serializeOperationalEvidenceJournal(journalRaw, [currentFirst, incomingFork, incomingTail]);
    const journal = JSON.parse(mergedRaw) as { version: number; entries: Array<{ kind: string; resolution?: string; reason: string; events: unknown[] }> };

    expect(journal.entries.at(-1)?.kind).toBe("merge");
    expect(journal.entries.at(-1)?.resolution).toBe("divergent");
    expect(journal.entries.at(-1)?.reason).toContain("diverges");
    expect(loadOperationalEvidenceEventsFromRaw(mergedRaw)).toHaveLength(3);
  });

  test("records a merge batch when the incoming evidence rewinds to an earlier checkpoint", () => {
    const first = makeEvent("scene_1", "Retail Draft", "scene_created", 1000);
    const second = makeEvent("scene_1", "Retail Draft", "scene_updated", 2000);
    const third = makeEvent("scene_1", "Retail Draft", "scene_updated", 3000);

    const journalRaw = serializeOperationalEvidenceJournal(null, [first, second, third]);
    const rebasedRaw = serializeOperationalEvidenceJournal(journalRaw, [first, second]);
    const journal = JSON.parse(rebasedRaw) as { version: number; entries: Array<{ kind: string; resolution?: string; reason: string; events: unknown[] }> };

    expect(journal.entries.at(-1)?.kind).toBe("merge");
    expect(journal.entries.at(-1)?.resolution).toBe("rebase");
    expect(journal.entries.at(-1)?.reason).toContain("rewinds");
    expect(loadOperationalEvidenceEventsFromRaw(rebasedRaw)).toHaveLength(2);
  });
});
