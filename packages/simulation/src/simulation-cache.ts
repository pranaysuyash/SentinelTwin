/**
 * Simulation Cache Controller — stale-result prevention via scene hashing.
 *
 * Every SimulationResult now carries a sceneHash (from scene-hash.ts).
 * This cache keys by that hash, enabling:
 * - Cache hit: return cached result when hash matches
 * - Cache miss: compute and store
 * - Stale detection: warn when scene hash differs from cached result
 *
 * The cache is ephemeral (in-memory Map). For persistent caching across
 * sessions, serialize to IndexedDB or similar.
 */

import type { SimulationResult } from "@sentineltwin/core";
import { isSceneHashMatch } from "./scene-hash";

export type CachedSimulation = {
  hash: string;
  result: SimulationResult;
  cachedAt: number;
  computationTimeMs: number;
};

export type CacheEntry = {
  hash: string;
  result: SimulationResult;
  cachedAt: number;
  computationTimeMs: number;
  hitCount: number;
};

/**
 * In-memory simulation result cache.
 *
 * Keys are scene hashes (from computeSceneHash). Entries are evicted:
 * - By explicit call to invalidate()
 * - When maxEntries is exceeded (LRU by access time)
 */
export class SimulationCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Get a cached result by scene hash.
   * Returns undefined on miss.
   */
  get(hash: string): CacheEntry | undefined {
    const entry = this.cache.get(hash);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    this.hits++;
    entry.hitCount++;
    this.touch(hash);
    return entry;
  }

  /**
   * Check if a cached result is still valid for a given scene hash.
   * Returns the cached entry if valid, undefined if stale or missing.
   */
  getIfValid(cachedResult: Pick<SimulationResult, "sceneHash">, currentHash: string): CacheEntry | undefined {
    if (!cachedResult.sceneHash) return undefined;
    if (!isSceneHashMatch(cachedResult.sceneHash.hash, currentHash)) return undefined;
    return this.get(cachedResult.sceneHash.hash);
  }

  /**
   * Store a simulation result indexed by hash.
   */
  set(hash: string, result: SimulationResult, computationTimeMs: number): void {
    if (this.cache.has(hash)) {
      const existing = this.cache.get(hash)!;
      existing.result = result;
      existing.cachedAt = Date.now();
      existing.computationTimeMs = computationTimeMs;
      existing.hitCount++;
      this.touch(hash);
      return;
    }

    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(hash, {
      hash,
      result,
      cachedAt: Date.now(),
      computationTimeMs,
      hitCount: 1,
    });
    this.accessOrder.push(hash);
  }

  /**
   * Invalidate all entries whose hash starts with the given prefix.
   * Useful when multiple scene versions share a prefix.
   */
  invalidate(hashPrefix?: string): number {
    let count = 0;
    if (hashPrefix) {
      for (const [key] of this.cache) {
        if (key.startsWith(hashPrefix)) {
          this.cache.delete(key);
          this.accessOrder = this.accessOrder.filter(k => k !== key);
          count++;
        }
      }
    } else {
      count = this.cache.size;
      this.cache.clear();
      this.accessOrder = [];
    }
    return count;
  }

  get stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      maxEntries: this.maxEntries,
    };
  }

  private touch(hash: string): void {
    const idx = this.accessOrder.indexOf(hash);
    if (idx >= 0) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(hash);
  }

  private evictLRU(): void {
    const oldest = this.accessOrder.shift();
    if (oldest) {
      this.cache.delete(oldest);
    }
  }
}

/**
 * Convenience: check if a simulation result is stale compared to current scene hash.
 * Returns true if the result's hash doesn't match the current hash, meaning
 * the scene has changed since the result was computed.
 */
export function isResultStale(
  result: Pick<SimulationResult, "sceneHash"> | undefined | null,
  currentHash: string,
): boolean {
  if (!result?.sceneHash) return true;
  return !isSceneHashMatch(result.sceneHash.hash, currentHash);
}

/**
 * Get a human-readable staleness label.
 */
export function getStalenessLabel(stale: boolean): string {
  return stale ? "Stale — scene has changed since this result" : "Up to date";
}

/**
 * Global simulation cache instance.
 * Use this for application-level caching across the studio.
 */
export const globalSimulationCache = new SimulationCache();
