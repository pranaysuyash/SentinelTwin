import { auditTrustSurfaces, formatTrustAuditReport } from "../src/lib/truth-audit";
const report = auditTrustSurfaces(process.cwd());
console.log(formatTrustAuditReport(report));
if (report.issues.length > 0) {
  console.log("\n--- Issues ---");
  for (const issue of report.issues) {
    console.log(`[${issue.kind}] ${issue.surface}: ${issue.phrase}`);
  }
}
