import { describe, expect, test } from "bun:test";

import { summarizeIncidentAlerts } from "@/lib/incident-alerts";
import type { ExternalLogEntry, RuntimeIncident } from "@/store/studio-store";

function runtimeIncident(id: string, category: RuntimeIncident["category"], severity: RuntimeIncident["severity"], title: string): RuntimeIncident {
  return {
    id,
    timestamp: 1710000000000,
    category,
    severity,
    title,
    details: `${title} details`,
    stack: severity === "error" ? "stack-trace" : null,
    durationMs: severity === "warning" ? 1600 : 80,
    source: "test",
    path: "/studio",
    action: "run",
  };
}

function externalLog(id: string, severity: ExternalLogEntry["severity"], title: string): ExternalLogEntry {
  return {
    id,
    timestamp: 1710000000500,
    source: "paste",
    title,
    details: `${title} details`,
    raw: `${title}\n${title} details`,
    lineCount: 2,
    severity,
  };
}

describe("summarizeIncidentAlerts", () => {
  test("prioritizes high severity runtime and external alerts", () => {
    const summary = summarizeIncidentAlerts({
      runtimeIncidents: [
        runtimeIncident("runtime-1", "runtime_failure", "error", "Crash"),
        runtimeIncident("runtime-2", "performance_trace", "info", "Slow trace"),
      ],
      externalLogEntries: [
        externalLog("log-1", "warning", "Browser warning"),
        externalLog("log-2", "error", "Device error"),
      ],
    });

    expect(summary.alertCount).toBe(4);
    expect(summary.highPriorityCount).toBe(2);
    expect(summary.statusLabel).toBe("attention");
    expect(summary.latestAlert?.title).toBe("Device error");
    expect(summary.recentAlerts[0]?.title).toBe("Device error");
    expect(summary.recommendation).toContain("attach external logs");
  });

  test("returns a healthy summary when no alerts exist", () => {
    const summary = summarizeIncidentAlerts({
      runtimeIncidents: [],
      externalLogEntries: [],
    });

    expect(summary.alertCount).toBe(0);
    expect(summary.highPriorityCount).toBe(0);
    expect(summary.statusLabel).toBe("healthy");
    expect(summary.latestAlert).toBeNull();
  });
});
