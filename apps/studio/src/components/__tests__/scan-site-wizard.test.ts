import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const wizardPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "../scan-to-scene/ScanSiteWizard.tsx");

describe("ScanSiteWizard", () => {
  test("supports multi-photo manual intake, correction controls, and confidence-gated compile", () => {
    const source = readFileSync(wizardPath, "utf8");

    expect(source).toContain("Drag markers to reposition.");
    expect(source).toContain("Choose one or more site images");
    expect(source).toContain("Annotate the active photo");
    expect(source).toContain("Add photos");
    expect(source).toContain("Photo set");
    expect(source).toContain("All photos");
    expect(source).toContain("Manual marking required");
    expect(source).toContain("Camera mount default");
    expect(source).toContain("Light mount default");
    expect(source).toContain("Critical zone night requirement");
    expect(source).toContain("Guided assistant");
    expect(source).toContain("Capture checklist");
    expect(source).toContain("Auto-path hints are enabled for guided assistant runs.");
    expect(source).toContain("scan_session_compiled");
    expect(source).toContain("What will be created");
    expect(source).toContain("multiple");
    expect(source).toContain("Unsupported file type. Use PNG, JPG, WEBP, or SVG images.");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("Geometry sanity checks");
    expect(source).toContain("Structural auto-fix assist (explicit)");
    expect(source).toContain("Needs Review");
    expect(source).toContain("Accept");
    expect(source).toContain("Review");
    expect(source).toContain("Reject");
    expect(source).toContain("candidateStats.needsReview");
    expect(source).toContain("Merge near-duplicate candidates (same type, close points)");
    expect(source).toContain("Snap door/window candidates closer to nearest wall");
    expect(source).toContain("Duplicate groups (same type + close points):");
    expect(source).toContain("Door/window without nearby wall:");
    expect(source).toContain("Pending candidate count:");
    expect(source).toContain("Low-confidence accepted candidates");
    expect(source).toContain("Compile anyway with low-confidence accepted candidates (explicit manual override).");
    expect(source).toContain("fixWarning");
    expect(source).toContain("Fix now");
    expect(source).toContain("Compiling replaces your current workspace scene.");
    expect(source).toContain("Compile preview");
    expect(source).toContain("widthHintM");
    expect(source).toContain("depthHintM");
    expect(source).toContain("heightHintM");
    expect(source).toContain("Zone width");
    expect(source).toContain("Zone depth");
    expect(source).toContain("Cannot compile yet");
  });
});
