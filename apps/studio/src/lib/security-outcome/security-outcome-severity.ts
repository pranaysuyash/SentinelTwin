import type { SecurityIssue } from "@/schema/security-scene";

export const ISSUE_SEVERITY_RANK: Record<SecurityIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortIssuesBySeverity<T extends SecurityIssue>(issues: T[]): T[] {
  return [...issues].sort((a, b) => ISSUE_SEVERITY_RANK[a.severity] - ISSUE_SEVERITY_RANK[b.severity]);
}

