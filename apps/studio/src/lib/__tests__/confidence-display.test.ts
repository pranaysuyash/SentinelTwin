import { describe, expect, test } from "bun:test";

import {
  CONFIDENCE_BAND_LABEL,
  CONFIDENCE_TONE_CLASSES,
  renderConfidence,
} from "@/lib/confidence-display";

describe("renderConfidence (Trust Pass T1)", () => {
  test("RULE 1 — never returns 100% (or anything ≥ 93%) when there are unresolved warnings", () => {
    // This is the literal 06-17 trust break: the UI showed 100% next to severe
    // warnings. The renderer must make that impossible.
    const r = renderConfidence({ confidence: 1.0, unresolvedWarningCount: 3, detectorCandidateCount: 50 });
    expect(r.pct).toBeLessThan(93);
    expect(r.gated).toBe(true);
    expect(r.source).toContain("warning");
  });

  test("RULE 1 — even a single warning gates below 93%", () => {
    const r = renderConfidence({ confidence: 0.99, unresolvedWarningCount: 1 });
    expect(r.pct).toBeLessThan(93);
    expect(r.gated).toBe(true);
  });

  test("RULE 1 — zero warnings allows the raw percentage through (up to 100)", () => {
    const r = renderConfidence({ confidence: 0.97, unresolvedWarningCount: 0, detectorCandidateCount: 50 });
    expect(r.pct).toBe(97);
    expect(r.gated).toBe(false);
    expect(r.band).toBe("high");
  });

  test("RULE 2 — source is always non-empty, even with no caller detail", () => {
    const r = renderConfidence({ confidence: 0.5, unresolvedWarningCount: 0 });
    expect(r.source.length).toBeGreaterThan(0);
  });

  test("RULE 2 — caller-supplied sourceDetail is preserved verbatim", () => {
    const r = renderConfidence({
      confidence: 0.8,
      unresolvedWarningCount: 2,
      sourceDetail: "12 detector candidates · 2 unresolved warnings · wall-count anomaly",
    });
    expect(r.source).toBe("12 detector candidates · 2 unresolved warnings · wall-count anomaly");
  });

  test("RULE 2 — synthesized source includes the warning count when caller omits detail", () => {
    const r = renderConfidence({ confidence: 0.9, unresolvedWarningCount: 4, detectorCandidateCount: 12 });
    expect(r.source).toContain("12 detector candidates");
    expect(r.source).toContain("4 unresolved warnings");
  });

  test("band matches the displayed percentage, never the raw", () => {
    // raw 0.99 would be "high", but with warnings the pct is gated below 93 and
    // the band must be "medium" so we never render "92% High".
    const r = renderConfidence({ confidence: 0.99, unresolvedWarningCount: 2, detectorCandidateCount: 50 });
    expect(r.band).toBe("medium");
    expect(r.pct).toBeLessThan(85); // medium ceiling = HIGH_THRESHOLD*100 - 1 = 84
  });

  test("small-sample gating downgrades high → medium even with no warnings", () => {
    // A 0.99 from 2 detector candidates is fragile; the band must reflect that.
    const r = renderConfidence({ confidence: 0.99, unresolvedWarningCount: 0, detectorCandidateCount: 2 });
    expect(r.band).toBe("medium");
    expect(r.gated).toBe(true);
  });

  test("clamps out-of-range raw confidence defensively", () => {
    const high = renderConfidence({ confidence: 5, unresolvedWarningCount: 0, detectorCandidateCount: 50 });
    expect(high.pct).toBe(100);
    const low = renderConfidence({ confidence: -3, unresolvedWarningCount: 0 });
    expect(low.pct).toBe(0);
    expect(low.band).toBe("low");
  });

  test("tone is consistent with band", () => {
    expect(renderConfidence({ confidence: 0.95, unresolvedWarningCount: 0, detectorCandidateCount: 50 }).tone).toBe("emerald");
    expect(renderConfidence({ confidence: 0.7, unresolvedWarningCount: 0, detectorCandidateCount: 50 }).tone).toBe("amber");
    expect(renderConfidence({ confidence: 0.3, unresolvedWarningCount: 0 }).tone).toBe("rose");
  });

  test("is pure: same inputs produce same outputs", () => {
    const input = { confidence: 0.88, unresolvedWarningCount: 1, detectorCandidateCount: 20 };
    expect(renderConfidence(input)).toEqual(renderConfidence(input));
  });

  test("regression guard: the 06-17 incident values cannot reproduce the trust break", () => {
    // From Docs/notes/live_demo_session_2026-06-17.md:195 — "1335 walls detected,
    // confidence showed 100%, Tier 1 Gate showed Manual Review." Even with the
    // raw confidence at 1.0 and a large candidate count, the presence of any
    // warning must prevent the 100% display.
    const r = renderConfidence({
      confidence: 1.0,
      unresolvedWarningCount: 1, // any warning at all
      detectorCandidateCount: 1335,
    });
    expect(r.pct).toBeLessThan(93);
    expect(r.band).not.toBe("high");
    // And the source surfaces the warning so the buyer can see why.
    expect(r.source).toMatch(/warning/);
  });
});

describe("confidence-display exports", () => {
  test("CONFIDENCE_BAND_LABEL has all three bands", () => {
    expect(CONFIDENCE_BAND_LABEL.high).toBe("High");
    expect(CONFIDENCE_BAND_LABEL.medium).toBe("Medium");
    expect(CONFIDENCE_BAND_LABEL.low).toBe("Low");
  });

  test("CONFIDENCE_TONE_CLASSES has class fragments for every tone", () => {
    for (const tone of ["emerald", "amber", "rose"] as const) {
      const cls = CONFIDENCE_TONE_CLASSES[tone];
      expect(cls.text).toBeTruthy();
      expect(cls.border).toBeTruthy();
      expect(cls.bg).toBeTruthy();
    }
  });
});
