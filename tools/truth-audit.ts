#!/usr/bin/env bun

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
