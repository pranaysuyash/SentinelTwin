/**
 * Bounded history storage — keeps the most recent N records in localStorage.
 *
 * Extracted from studio-store.ts patterns that limit stored records
 * (e.g. 60 sensor events, 24 prompt registry entries, 12 support ingest entries).
 */

import { readJson, writeJson } from "./json-storage";

/** Default maximum records to keep. */
const DEFAULT_MAX_RECORDS = 60;

/**
 * Read a bounded history list from localStorage.
 * Returns an empty array if missing or corrupt.
 */
export function readBoundedHistory<T>(key: string): T[] {
  return readJson<T[]>(key) ?? [];
}

/**
 * Append one or more records to a bounded history list, trimming to maxRecords.
 * Preserves existing records and adds new ones at the end.
 */
export function appendBoundedHistory<T>(
  key: string,
  newRecords: T | T[],
  maxRecords: number = DEFAULT_MAX_RECORDS,
): void {
  const existing = readBoundedHistory<T>(key);
  const incoming = Array.isArray(newRecords) ? newRecords : [newRecords];
  const merged = [...existing, ...incoming];
  const trimmed = merged.length > maxRecords ? merged.slice(merged.length - maxRecords) : merged;
  writeJson(key, trimmed);
}

/**
 * Replace the entire bounded history list.
 */
export function writeBoundedHistory<T>(
  key: string,
  records: T[],
  maxRecords: number = DEFAULT_MAX_RECORDS,
): void {
  const trimmed = records.length > maxRecords ? records.slice(records.length - maxRecords) : records;
  writeJson(key, trimmed);
}

/**
 * Clear a bounded history list.
 */
export function clearBoundedHistory(key: string): void {
  writeJson(key, []);
}
