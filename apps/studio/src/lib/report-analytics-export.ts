import type { SecurityAnalyticsModel } from "@/lib/security-analytics";

/**
 * Pure HTML/inline-SVG renderer for the Security Analytics model, used to
 * embed the same dashboard story into report exports (Analytics -> Report
 * convergence). No DOM/React — produces a self-contained HTML fragment that
 * can be inlined into the existing report document.
 */

const TONE_COLOR: Record<string, string> = {
  good: "#16a34a",
  warn: "#f59e0b",
  bad: "#dc2626",
  neutral: "#64748b",
};

const DORI_BAND_COLOR: Record<string, string> = {
  identification: "#7c3aed",
  recognition: "#2563eb",
  observation: "#0891b2",
  detection: "#16a34a",
  blind: "#cbd5e1",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#3b82f6",
  low: "#94a3b8",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildKpiCardsHtml(model: SecurityAnalyticsModel): string {
  if (model.kpis.length === 0) return "";
  const cards = model.kpis
    .map(
      (kpi) => `
    <div class="analytics-kpi-card">
      <div class="analytics-kpi-value" style="color:${TONE_COLOR[kpi.tone] ?? TONE_COLOR.neutral}">${escapeHtml(kpi.value)}</div>
      <div class="analytics-kpi-label">${escapeHtml(kpi.label)}</div>
      <div class="analytics-kpi-detail">${escapeHtml(kpi.detail)}</div>
    </div>`,
    )
    .join("");
  return `<div class="analytics-kpi-grid">${cards}</div>`;
}

function buildDoriBarSvg(model: SecurityAnalyticsModel): string {
  if (model.doriDistribution.length === 0) return "";
  const width = 600;
  const height = 36;
  let x = 0;
  const segments = model.doriDistribution
    .filter((band) => band.pct > 0)
    .map((band) => {
      const segWidth = (band.pct / 100) * width;
      const rect = `<rect x="${x.toFixed(2)}" y="0" width="${segWidth.toFixed(2)}" height="${height}" fill="${DORI_BAND_COLOR[band.band] ?? "#cbd5e1"}" />`;
      x += segWidth;
      return rect;
    })
    .join("");

  const legend = model.doriDistribution
    .map(
      (band) => `
    <span class="analytics-legend-item">
      <span class="analytics-legend-swatch" style="background:${DORI_BAND_COLOR[band.band] ?? "#cbd5e1"}"></span>
      ${escapeHtml(band.label)} ${band.pct.toFixed(1)}%
    </span>`,
    )
    .join("");

  return `
  <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" role="img" aria-label="DORI quality distribution">
    ${segments}
  </svg>
  <div class="analytics-legend">${legend}</div>`;
}

function buildIssueSeverityBarsSvg(model: SecurityAnalyticsModel): string {
  if (model.issueBreakdown.length === 0) return "";
  const maxCount = Math.max(1, ...model.issueBreakdown.map((issue) => issue.count));
  const width = 600;
  const barHeight = 18;
  const gap = 8;
  const labelWidth = 90;
  const trackWidth = width - labelWidth - 50;
  const height = model.issueBreakdown.length * (barHeight + gap);

  const bars = model.issueBreakdown
    .map((issue, index) => {
      const y = index * (barHeight + gap);
      const barWidth = (issue.count / maxCount) * trackWidth;
      return `
      <text x="0" y="${y + barHeight - 4}" font-size="11" fill="#475569" text-transform="capitalize">${escapeHtml(issue.severity)}</text>
      <rect x="${labelWidth}" y="${y}" width="${trackWidth}" height="${barHeight}" fill="#f1f5f9" />
      <rect x="${labelWidth}" y="${y}" width="${Math.max(1, barWidth).toFixed(2)}" height="${barHeight}" fill="${SEVERITY_COLOR[issue.severity] ?? "#94a3b8"}" />
      <text x="${labelWidth + trackWidth + 8}" y="${y + barHeight - 4}" font-size="11" fill="#334155">${issue.count}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Open issues by severity">${bars}</svg>`;
}

function buildCoverageTrendSvg(model: SecurityAnalyticsModel): string {
  const points = model.coverageTrend;
  if (points.length < 2) return "";
  const width = 600;
  const height = 120;
  const padding = 12;
  const minPct = Math.min(...points.map((p) => p.coveragePct), 0);
  const maxPct = Math.max(...points.map((p) => p.coveragePct), 100);
  const range = Math.max(1, maxPct - minPct);

  const coords = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.coveragePct - minPct) / range) * (height - padding * 2);
    return { x, y, point };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const dots = coords
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${c.point.isCurrent ? 4 : 2.5}" fill="${c.point.isCurrent ? "#2563eb" : "#94a3b8"}" />`,
    )
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Coverage trend across saved snapshots">
    <path d="${path}" fill="none" stroke="#2563eb" stroke-width="2" />
    ${dots}
  </svg>`;
}

function buildCameraLeaderboardTable(model: SecurityAnalyticsModel): string {
  if (model.cameraLeaderboard.length === 0) return "";
  const rows = model.cameraLeaderboard
    .map(
      (camera) => `
    <tr>
      <td>${escapeHtml(camera.name)}</td>
      <td>${camera.coveragePct.toFixed(1)}%</td>
      <td>${camera.zonesCovered}</td>
      <td>${camera.zonesFailed}</td>
      <td>${escapeHtml(camera.status)}</td>
    </tr>`,
    )
    .join("");

  return `
  <table>
    <thead><tr><th>Camera</th><th>Coverage</th><th>Zones Covered</th><th>Zones Failed</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export const ANALYTICS_REPORT_STYLES = `
    .analytics-kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 12px 0; }
    .analytics-kpi-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
    .analytics-kpi-value { font-size: 15pt; font-weight: 700; }
    .analytics-kpi-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 2px; }
    .analytics-kpi-detail { font-size: 9pt; color: #475569; margin-top: 2px; }
    .analytics-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 9pt; color: #475569; }
    .analytics-legend-item { display: inline-flex; align-items: center; gap: 4px; }
    .analytics-legend-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
    .analytics-chart-block { margin: 14px 0; }
    .analytics-chart-title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 6px; }
`;

/**
 * Renders the Security Analytics model as a self-contained HTML fragment
 * (KPI cards + inline SVG charts) for embedding into report exports.
 * Returns "" if there is no simulation to report on.
 */
export function buildAnalyticsReportSection(model: SecurityAnalyticsModel): string {
  if (!model.hasSimulation) return "";

  const doriSvg = buildDoriBarSvg(model);
  const issueSvg = buildIssueSeverityBarsSvg(model);
  const trendSvg = buildCoverageTrendSvg(model);
  const leaderboard = buildCameraLeaderboardTable(model);

  return `
  <h2>Security Analytics Overview</h2>
  ${buildKpiCardsHtml(model)}
  ${doriSvg ? `<div class="analytics-chart-block"><div class="analytics-chart-title">DORI Quality Distribution</div>${doriSvg}</div>` : ""}
  ${issueSvg ? `<div class="analytics-chart-block"><div class="analytics-chart-title">Open Issues by Severity</div>${issueSvg}</div>` : ""}
  ${trendSvg ? `<div class="analytics-chart-block"><div class="analytics-chart-title">Coverage Trend (Snapshots)</div>${trendSvg}</div>` : ""}
  ${leaderboard ? `<div class="analytics-chart-block"><div class="analytics-chart-title">Camera Leaderboard</div>${leaderboard}</div>` : ""}`;
}
