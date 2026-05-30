#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const profileId = process.argv[2] ?? 'local-only';
const studioRoot = resolve(process.cwd(), 'apps/studio');
const profilePath = resolve(studioRoot, 'deploy/profiles', `${profileId}.json`);

if (!existsSync(profilePath)) {
  console.error(`[deploy] unknown profile: ${profileId}`);
  process.exit(2);
}

const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
const missing = (profile.requiredEnv ?? []).filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[deploy] missing required env for ${profileId}: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[deploy] profile: ${profile.name}`);
console.log(`[deploy] description: ${profile.description}`);
console.log(`[deploy] localOnlyMode: ${profile.localOnlyMode ? 'true' : 'false'}`);

function run(label, cmd, args) {
  console.log(`[deploy] check: ${label}`);
  const result = spawnSync(cmd, args, { cwd: studioRoot, stdio: 'inherit', shell: false, env: process.env });
  if (result.status !== 0) {
    console.error(`[deploy] failed check: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const checks = new Set(profile.checks ?? []);
if (checks.has('typecheck')) run('typecheck', 'npx', ['tsc', '--noEmit']);
if (checks.has('truth-audit')) run('truth-audit', 'bun', ['../../tools/truth-audit.ts', '--root', '.']);
if (checks.has('build')) run('build', 'npm', ['run', 'build']);
if (checks.has('api-cors')) run('api-cors', 'bun', ['test', 'src/lib/__tests__/api-cors.test.ts']);
if (checks.has('provider-health')) run('provider-health', 'bun', ['test', 'src/agents/__tests__/provider-selection.test.ts']);

console.log('[deploy] profile validation PASS');
