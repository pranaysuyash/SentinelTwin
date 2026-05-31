import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const commandBarPath = join(import.meta.dir, "../command-bar/CommandBar.tsx");

describe("CommandBar", () => {
  test("surfaces the offline-first residency banner and mode chip", () => {
    const source = readFileSync(commandBarPath, "utf8");

    expect(source).toContain('const { status, executeCommand, dismissError, applyCandidate, confirmPreview, cancelPreview, mode, providerHealth, providerTelemetry, latestAiActionTelemetry } = useAiCommand();');
    expect(source).toContain('status.state === "preview"');
    expect(source).toContain('onClick={confirmPreview}');
    expect(source).toContain('onClick={cancelPreview}');
    expect(source).toContain('{mode.label}');
    expect(source).toContain('{mode.providerLabel}');
    expect(source).toContain('{mode.cloudAvailable ? "Cloud review available" : "Local-only"}');
    expect(source).toContain('providerHealth.overallStatus');
    expect(source).toContain('providerTelemetry.overallStatus');
    expect(source).toContain('Provider healthy');
    expect(source).toContain('Budget ready');
    expect(source).toContain('Budget guarded');
    expect(source).toContain('telemetryStatus');
    expect(source).toContain('aiActionTelemetrySummary');
    expect(source).toContain('Readiness: {providerHealth.healthyProviders} ready / {providerHealth.partialProviders} limited / {providerHealth.blockedProviders} blocked.');
    expect(source).toContain('Review cost and response time: {providerTelemetry.activeCostLabel} · {providerTelemetry.activeLatencyLabel}.');
    expect(source).toContain('Policy gates: {providerTelemetry.stagePolicies.map((stage) => `${stage.stage}:${stage.ready ? "ready" : "guarded"}`).join(" · ")}.');
    expect(source).toContain('Last assisted edit: {latestAiActionTelemetry ? `${latestAiActionTelemetry.stage} · ${latestAiActionTelemetry.durationMs} ms · ~${latestAiActionTelemetry.estimatedTotalTokens} tokens` : "none yet"}.');
    expect(source).toContain('Usage trend: {aiActionTelemetrySummary.trendLabel} · {aiActionTelemetrySummary.trendNote}');
    expect(source).toContain('{mode.label}: recognized site edits run locally. {mode.cloudAvailable ? "Cloud-assisted parsing and fix proposals use a configured API key." : "Cloud-assisted parsing and fix proposals are disabled by policy."}');
  });
});
