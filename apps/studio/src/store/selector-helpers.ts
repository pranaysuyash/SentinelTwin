/**
 * Re-export of `useShallow` from `zustand/react/shallow` for components
 * that subscribe to multiple Zustand fields at once.
 *
 * Use it when your selector returns an object or array literal:
 *
 * ```ts
 * // Without useShallow — re-renders on every store update because
 * // the object literal is a new reference each render.
 * const { scene, simulationResult } = useStudioStore((s) => ({
 *   scene: s.scene,
 *   simulationResult: s.simulationResult,
 * }));
 *
 * // With useShallow — re-renders only when the selected fields change
 * // value (shallow-equal), not when unrelated slices change.
 * const { scene, simulationResult } = useStudioStore(
 *   useShallow((s) => ({
 *     scene: s.scene,
 *     simulationResult: s.simulationResult,
 *   })),
 * );
 * ```
 *
 * Single-field selectors don't need this — Zustand's default
 * `Object.is` comparison is already correct for those.
 */
export { useShallow } from "zustand/react/shallow";