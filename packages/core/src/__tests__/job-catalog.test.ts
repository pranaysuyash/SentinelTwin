import { describe, it, expect } from "bun:test";
import { JOB_CATALOG, getJobById, DEFAULT_JOB_ID } from "../lib/job-catalog";
import { jobSchema } from "../schema/job";

describe("JOB_CATALOG", () => {
  it("contains exactly the four v1 jobs", () => {
    const ids = JOB_CATALOG.map((j) => j.id).sort();
    expect(ids).toEqual(["auditor", "installer", "insurer", "operator"]);
  });

  it("every entry validates against jobSchema", () => {
    for (const job of JOB_CATALOG) {
      const parsed = jobSchema.safeParse(job);
      expect(parsed.success).toBe(true);
    }
  });

  it("getJobById returns the matching job for each id", () => {
    for (const job of JOB_CATALOG) {
      expect(getJobById(job.id)?.id).toBe(job.id);
    }
  });

  it("getJobById returns undefined for unknown id", () => {
    expect(getJobById("admin")).toBeUndefined();
  });

  it("DEFAULT_JOB_ID is installer (highest-volume India-first user)", () => {
    expect(DEFAULT_JOB_ID).toBe("installer");
  });

  it("insurer lens is read-only (critical safety property)", () => {
    const insurer = getJobById("insurer");
    expect(insurer?.lens.defaultReadPosture).toBe("read_only");
  });

  it("no two jobs share the same entrySurface", () => {
    const surfaces = JOB_CATALOG.map((j) => j.lens.entrySurface);
    expect(new Set(surfaces).size).toBe(surfaces.length);
  });
});
