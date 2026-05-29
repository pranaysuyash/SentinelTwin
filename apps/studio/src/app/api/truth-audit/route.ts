import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

import { auditTrustSurfaces, formatTrustAuditReport } from "@/lib/truth-audit";

function resolveStudioRoot() {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "src", "lib", "truth-audit.ts"))) {
    return cwd;
  }

  const studioRoot = join(cwd, "apps", "studio");
  if (existsSync(join(studioRoot, "src", "lib", "truth-audit.ts"))) {
    return studioRoot;
  }

  return cwd;
}

export async function GET() {
  const report = auditTrustSurfaces(resolveStudioRoot());
  return NextResponse.json({
    ok: report.ok,
    rootDir: report.rootDir,
    issues: report.issues,
    surfaces: report.surfaces,
    formatted: formatTrustAuditReport(report),
  });
}
