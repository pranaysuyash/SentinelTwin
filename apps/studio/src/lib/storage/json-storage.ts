/**
 * Typed localStorage utility with versioned keys and silent error handling.
 *
 * Extracted from studio-store.ts persist/load patterns to provide a
 * consistent persistence layer across all storage domains.
 */

const STORAGE_PREFIX = "sentineltwin:";

/** Minimum delay (ms) between consecutive writes to the same key. */
const COOLDOWN_MS = 50;

const lastWriteTimestamps = new Map<string, number>();

/**
 * Read and deserialize a JSON value from localStorage.
 * Returns `null` if the key is missing, unparseable, or storage is unavailable.
 */
export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Serialize and write a JSON value to localStorage.
 * Silently fails if storage is full or unavailable.
 */
export function writeJson<T>(key: string, value: T): void {
  try {
    const storageKey = STORAGE_PREFIX + key;
    const now = Date.now();
    const lastWrite = lastWriteTimestamps.get(storageKey) ?? 0;
    if (now - lastWrite < COOLDOWN_MS) return;
    lastWriteTimestamps.set(storageKey, now);
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Silently fail — storage full or disabled
  }
}

/** Remove a key from localStorage. Silently fails. */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
    lastWriteTimestamps.delete(STORAGE_PREFIX + key);
  } catch {
    // Silently fail
  }
}

/** Read a raw string from localStorage (no JSON parsing). */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

/** Write a raw string to localStorage (no JSON serialization). Useful for booleans stored as "true"/"false". */
export function writeRaw(key: string, value: string): void {
  try {
    const storageKey = STORAGE_PREFIX + key;
    const now = Date.now();
    const lastWrite = lastWriteTimestamps.get(storageKey) ?? 0;
    if (now - lastWrite < COOLDOWN_MS) return;
    lastWriteTimestamps.set(storageKey, now);
    localStorage.setItem(storageKey, value);
  } catch {
    // Silently fail
  }
}

/**
 * Read a JSON value with a version check.
 * Returns `null` if version doesn't match or data is missing.
 */
export function readVersionedJson<T>(key: string, version: number): T | null {
  const raw = readJson<{ version: number; data: T }>(key);
  if (!raw || raw.version !== version) return null;
  return raw.data;
}

/**
 * Write a JSON value with a version stamp for future migration checks.
 */
export function writeVersionedJson<T>(key: string, value: T, version: number): void {
  writeJson(key, { version, data: value });
}

/** Check whether a storage key exists. */
export function hasKey(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) !== null;
  } catch {
    return false;
  }
}
