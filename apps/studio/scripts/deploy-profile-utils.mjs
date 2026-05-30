#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ALLOWED_CHECKS = new Set(['typecheck', 'truth-audit', 'build', 'api-cors', 'provider-health']);

export function resolveStudioRoot(scriptPath) {
  return resolve(dirname(scriptPath), '..');
}

export function readDeployProfile(profilePath) {
  return JSON.parse(readFileSync(profilePath, 'utf8'));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function isFinitePositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function validateDeployProfileShape(profile, profilePath, expectedProfileId) {
  const errors = [];

  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    return [`${profilePath}: profile must be an object`];
  }

  if (typeof profile.id !== 'string' || profile.id.trim().length === 0) {
    errors.push(`${profilePath}: missing string field "id"`);
  } else if (expectedProfileId && profile.id !== expectedProfileId) {
    errors.push(`${profilePath}: profile id "${profile.id}" does not match requested profile "${expectedProfileId}"`);
  }

  if (typeof profile.name !== 'string' || profile.name.trim().length === 0) {
    errors.push(`${profilePath}: missing string field "name"`);
  }

  if (typeof profile.description !== 'string' || profile.description.trim().length === 0) {
    errors.push(`${profilePath}: missing string field "description"`);
  }

  if (typeof profile.localOnlyMode !== 'boolean') {
    errors.push(`${profilePath}: missing boolean field "localOnlyMode"`);
  }

  if (!isStringArray(profile.requiredEnv)) {
    errors.push(`${profilePath}: "requiredEnv" must be an array of non-empty strings`);
  }

  if (profile.recommendedEnv !== undefined && !isStringArray(profile.recommendedEnv)) {
    errors.push(`${profilePath}: "recommendedEnv" must be an array of non-empty strings when present`);
  }

  if (!isStringArray(profile.checks)) {
    errors.push(`${profilePath}: "checks" must be an array of non-empty strings`);
  } else {
    const unknownChecks = profile.checks.filter((check) => !ALLOWED_CHECKS.has(check));
    if (unknownChecks.length > 0) {
      errors.push(`${profilePath}: unsupported check(s): ${unknownChecks.join(', ')}`);
    }
  }

  if (profile.slo === undefined || profile.slo === null || typeof profile.slo !== 'object' || Array.isArray(profile.slo)) {
    errors.push(`${profilePath}: missing object field "slo"`);
  } else {
    const { buildMinutes, coldStartSeconds, simulationMsP95 } = profile.slo;
    if (!isFinitePositiveNumber(buildMinutes)) {
      errors.push(`${profilePath}: slo.buildMinutes must be a positive number`);
    }
    if (!isFinitePositiveNumber(coldStartSeconds)) {
      errors.push(`${profilePath}: slo.coldStartSeconds must be a positive number`);
    }
    if (!isFinitePositiveNumber(simulationMsP95)) {
      errors.push(`${profilePath}: slo.simulationMsP95 must be a positive number`);
    }
  }

  return errors;
}

