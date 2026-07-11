#!/usr/bin/env bun
// Must run from apps/studio/ — paths are relative to apps/studio/src/. See D-035.
// cd apps/studio && npx tsx ../../tools/truth-audit.ts

import { auditTrustSurfaces, formatTrustAuditReport } from "../apps/studio/src/lib/truth-audit";

function parseRootArg(argv: string[]) {
  const rootIndex = argv.indexOf("--root");
  if (rootIndex >= 0 && argv[rootIndex + 1]) {
    return argv[rootIndex + 1];
  }
  return process.cwd();
}

const rootDir = parseRootArg(process.argv);
const report = auditTrustSurfaces(rootDir);

console.log(formatTrustAuditReport(report));

if (!report.ok) {
  process.exitCode = 1;
}
