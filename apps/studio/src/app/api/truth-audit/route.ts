import { existsSync } from "node:fs";
import { join } from "node:path";

import { auditTrustSurfaces, formatTrustAuditReport } from "@/lib/truth-audit";
import { corsJson, corsNoContent } from "@/lib/api-cors";

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

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const report = auditTrustSurfaces(resolveStudioRoot());
  return corsJson({
    ok: report.ok,
    rootDir: report.rootDir,
    issues: report.issues,
    surfaces: report.surfaces,
    formatted: formatTrustAuditReport(report),
  }, request, undefined, { methods: ["GET", "OPTIONS"] });
}

export async function OPTIONS(request: NextRequest) {
  return corsNoContent(request, { methods: ["GET", "OPTIONS"] });
}
