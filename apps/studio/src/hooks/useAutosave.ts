"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { SecurityScene } from "@/schema/security-scene";
import { useStudioStore } from "@/store/studio-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOSAVE_KEY = "sentineltwin_autosave_v1";
const AUTOSAVE_VERSION = 1;
const AUTOSAVE_DEBOUNCE_MS = 3_000;
const AUTOSAVE_MAX_AGE_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutosaveRecovery = {
  scene: SecurityScene;
  timestamp: number;
  version: number;
};

export type UseAutosaveReturn = {
  /** Non-null when a recent autosave exists and hasn't been dismissed. */
  pendingRecovery: AutosaveRecovery | null;
  /** Apply the saved scene to the store and clear the recovery state. */
  applyRecovery: () => void;
  /** Dismiss the recovery prompt without applying it, and clear localStorage. */
  dismissRecovery: () => void;
};

// ---------------------------------------------------------------------------
// localStorage helpers (SSR-safe)
// ---------------------------------------------------------------------------

function isClient(): boolean {
  return typeof window !== "undefined";
}

function loadAutosave(): AutosaveRecovery | null {
  if (!isClient()) return null;
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AutosaveRecovery>;
    if (
      typeof parsed.timestamp !== "number" ||
      typeof parsed.version !== "number" ||
      !parsed.scene ||
      typeof parsed.scene !== "object"
    ) {
      return null;
    }
    // Discard if older than the max age window
    if (Date.now() - parsed.timestamp > AUTOSAVE_MAX_AGE_MS) {
      window.localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
    return { scene: parsed.scene as SecurityScene, timestamp: parsed.timestamp, version: parsed.version };
  } catch {
    return null;
  }
}

function saveAutosave(scene: SecurityScene): void {
  if (!isClient()) return;
  try {
    const payload: AutosaveRecovery = { scene, timestamp: Date.now(), version: AUTOSAVE_VERSION };
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

function clearAutosave(): void {
  if (!isClient()) return;
  try {
    window.localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Crash-safe autosave hook.
 *
 * - Watches `scene` from `useStudioStore` and debounces writes to localStorage.
 * - On mount, checks for a recent autosave and surfaces it as `pendingRecovery`.
 * - `applyRecovery()` restores the scene from the saved state.
 * - `dismissRecovery()` clears the saved state without applying it.
 */
export function useAutosave(): UseAutosaveReturn {
  const scene = useStudioStore((s) => s.scene);
  const setScene = useStudioStore((s) => s.setScene);

  const [pendingRecovery, setPendingRecovery] = useState<AutosaveRecovery | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountRef = useRef(false);

  // On mount: check for a pending autosave
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      const saved = loadAutosave();
      if (saved) {
        startTransition(() => {
          setPendingRecovery(saved);
        });
      }
    }
  }, []);

  // Watch scene changes and debounce writes
  useEffect(() => {
    if (!scene) return;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      saveAutosave(scene);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [scene]);

  const applyRecovery = useCallback(() => {
    if (!pendingRecovery) return;
    setScene(pendingRecovery.scene);
    clearAutosave();
    setPendingRecovery(null);
  }, [pendingRecovery, setScene]);

  const dismissRecovery = useCallback(() => {
    clearAutosave();
    setPendingRecovery(null);
  }, []);

  return { pendingRecovery, applyRecovery, dismissRecovery };
}
