"use client";

export function ReactScan() {
  // Keep this component mounted as a no-op so dev-only diagnostics cannot
  // break the app when react-scan's transitive ESM shape changes.
  return null;
}
