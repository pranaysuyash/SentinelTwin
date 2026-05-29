import type { ExternalLogEntry, RuntimeIncident } from "@/store/studio-store";

export type IncidentAlertSource = "runtime" | "external_log";
export type IncidentAlertSeverity = "info" | "warning" | "error";

export type IncidentAlert = {
  id: string;
  timestamp: number;
  source: IncidentAlertSource;
  severity: IncidentAlertSeverity;
  title: string;
  details: string;
  category: string;
  path: string | null;
  stack: string | null;
};

export type IncidentAlertSummary = {
  title: string;
  summary: string;
  alertCount: number;
  highPriorityCount: number;
  latestAlert: IncidentAlert | null;
  recentAlerts: IncidentAlert[];
  recommendation: string;
  statusLabel: "healthy" | "watch" | "attention";
};

function severityRank(severity: IncidentAlertSeverity) {
  if (severity === "error") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function mapRuntimeIncidentToAlert(incident: RuntimeIncident): IncidentAlert {
  const severity: IncidentAlertSeverity =
    incident.severity === "error"
      ? "error"
      : incident.severity === "warning"
        ? "warning"
        : incident.category === "performance_trace" && typeof incident.durationMs === "number" && incident.durationMs >= 1500
          ? "warning"
          : "info";

  return {
    id: `runtime:${incident.id}`,
    timestamp: incident.timestamp,
    source: "runtime",
    severity,
    title: incident.title,
    details: incident.details,
    category: incident.category,
    path: incident.path ?? null,
    stack: incident.stack ?? null,
  };
}

function mapExternalLogToAlert(entry: ExternalLogEntry): IncidentAlert {
  return {
    id: `external:${entry.id}`,
    timestamp: entry.timestamp,
    source: "external_log",
    severity: entry.severity,
    title: entry.title,
    details: entry.details,
    category: "external_log",
    path: null,
    stack: null,
  };
}

export function summarizeIncidentAlerts(input: {
  runtimeIncidents: RuntimeIncident[];
  externalLogEntries: ExternalLogEntry[];
}): IncidentAlertSummary {
  const alerts = [
    ...input.runtimeIncidents.map(mapRuntimeIncidentToAlert),
    ...input.externalLogEntries.map(mapExternalLogToAlert),
  ].sort((left, right) => {
    const rank = severityRank(left.severity) - severityRank(right.severity);
    if (rank !== 0) return rank;
    return right.timestamp - left.timestamp;
  });

  const highPriorityCount = alerts.filter((alert) => alert.severity === "error").length;
  const warningCount = alerts.filter((alert) => alert.severity === "warning").length;
  const latestAlert = alerts[0] ?? null;

  let statusLabel: IncidentAlertSummary["statusLabel"] = "healthy";
  let recommendation = "No alert candidates detected.";
  if (highPriorityCount > 0) {
    statusLabel = "attention";
    recommendation = "Review the latest high-priority alert, attach external logs, and export the support bundle before escalation.";
  } else if (warningCount > 0) {
    statusLabel = "watch";
    recommendation = "Review recent warnings and external log captures before the next support handoff.";
  }

  return {
    title: "Automated alerting",
    summary: alerts.length > 0
      ? `${alerts.length} alert candidate${alerts.length === 1 ? "" : "s"} · ${highPriorityCount} high priority · ${warningCount} warning${warningCount === 1 ? "" : "s"}.`
      : "No alert candidates detected.",
    alertCount: alerts.length,
    highPriorityCount,
    latestAlert,
    recentAlerts: alerts.slice(0, 5),
    recommendation,
    statusLabel,
  };
}
