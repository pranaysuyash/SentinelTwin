/**
 * Versioned local record — a single value stored with a version number
 * for schema migration support.
 *
 * Useful for preferences, serialized scenes, or any single-value
 * localStorage entry that may need migration in the future.
 */

import { readVersionedJson, writeVersionedJson, removeKey } from "./json-storage";

export function removeVersionedRecord(key: string): void {
  removeKey(key);
}

/**
 * Read a versioned record from localStorage.
 * Returns `null` if the version doesn't match, data is missing, or corrupt.
 */
export function readVersionedRecord<T>(key: string, version: number): T | null {
  return readVersionedJson<T>(key, version);
}

/**
 * Write a versioned record to localStorage.
 */
export function writeVersionedRecord<T>(key: string, value: T, version: number): void {
  writeVersionedJson(key, value, version);
}

/**
 * Migrate a versioned record from an old version to a new one.
 * If `migrateFn` returns null, the record is removed.
 */
export function migrateVersionedRecord<T, U>(
  key: string,
  oldVersion: number,
  newVersion: number,
  migrateFn: (oldData: T) => U | null,
): U | null {
  const oldData = readVersionedJson<T>(key, oldVersion);
  if (oldData === null) return null;
  const newData = migrateFn(oldData);
  if (newData === null) {
    removeKey(key);
    return null;
  }
  writeVersionedJson(key, newData, newVersion);
  return newData;
}
