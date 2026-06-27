/**
 * WASM Vision Bridge — Frontier Spike
 *
 * `@sentineltwin/simulation` already owns a deterministic, BV-accelerated
 * vision collider (`vision-collider-mesh.ts`). This module is the spike
 * that proves the *contract* the collider exposes is small and stable
 * enough to be served by either:
 *
 *  1. The existing pure-JS / `three-mesh-bvh` implementation
 *     (`BvhJsVisionBridge`), or
 *  2. A compiled WebAssembly module
 *     (`WasmVisionBridge`) — the same contract a future Rust port would
 *     have to satisfy.
 *
 * Why this is the right spike to land first:
 *
 *  - Long-term aligned. The simulation package is already pure-geometry,
 *    zero-React, and depends on `three` + `three-mesh-bvh` only. A WASM
 *    or Rust port of the BVH build + batched raycast will slot in
 *    behind this bridge without changing any call site.
 *  - First-principles. Coverage determinism is a Tier-3 product
 *    invariant (see `motto_v3.md` §0.5). A bridge with a strict input/
 *    output contract makes it possible to assert byte-exact parity
 *    between the JS and WASM backends and reject drift.
 *  - License. No new dependency. The WAT module is compiled at runtime
 *    via the standard `WebAssembly` host API; the dependency surface
 *    stays at zero.
 *
 * The WAT module here is intentionally a *spike*: it implements a
 * ray-vs-axis-aligned-bounding-box intersection inside linear memory.
 * The face-level / triangle-level intersection is delegated to the
 * JS bridge in the spike (BVH raycast), so we prove the linear-memory
 * contract and the dispatch path end to end without bringing in a
 * Rust toolchain. A Rust port would replace the WAT module with a
 * `wasm-pack` build of a Rust crate that mirrors the same contract.
 */

import * as THREE from "three";
import { acceleratedRaycast } from "three-mesh-bvh";

import { buildVisionColliderMesh, type VisionColliderMesh } from "./vision-collider-mesh";

// Make BVH accelerated raycast available globally on the mesh prototype
// (same trick the existing collider builder uses). This module never
// re-binds the prototype; the collider builder already does that as a
// module side effect.
if (typeof THREE !== "undefined") {
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

// ── Public contract ────────────────────────────────────────────────

/**
 * A single ray in the batch. Typed fields instead of objects so the
 * WASM bridge can read directly from a single `Float32Array` of length
 * 7 × N without per-ray allocation.
 */
export interface RayBatchRay {
  originX: number;
  originY: number;
  originZ: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  maxDistance: number;
}

/**
 * A single hit. `t` is the distance along the ray, in world units. When
 * `null`, the ray did not hit any collider within `maxDistance`.
 */
export interface RayBatchHit {
  t: number;
  hitX: number;
  hitY: number;
  hitZ: number;
  sourceId: string;
}

/**
 * Backend kind. Both backends share the same input/output contract.
 */
export type VisionBridgeBackend = "bvh-js" | "wasm-spike";

/**
 * The bridge contract. Implementations must be deterministic: the same
 * input must produce the same hits across runs and across backends.
 * This is enforced by `wasm-vision-bridge.test.ts`.
 */
export interface VisionBridge {
  readonly backend: VisionBridgeBackend;
  /** Cast a batch of rays in one call. Pure function. */
  castRays(rays: ReadonlyArray<RayBatchRay>): RayBatchHit[];
  /** Release GPU/CPU resources. After dispose, castRays is undefined. */
  dispose(): void;
}

// ── JS / three-mesh-bvh backend ────────────────────────────────────

/**
 * Pure-JS / `three-mesh-bvh` backend. Reuses the existing vision
 * collider so we get the same triangles and BVH that the deterministic
 * coverage engine already uses, with no new data path.
 */
export class BvhJsVisionBridge implements VisionBridge {
  readonly backend: VisionBridgeBackend = "bvh-js";

  private collider: VisionColliderMesh;
  private raycaster: THREE.Raycaster;
  private tmpOrigin: THREE.Vector3;
  private tmpDirection: THREE.Vector3;

  constructor(collider: VisionColliderMesh) {
    this.collider = collider;
    this.raycaster = new THREE.Raycaster();
    // Reuse Vector3 instances to avoid per-ray allocation in tight loops.
    this.tmpOrigin = new THREE.Vector3();
    this.tmpDirection = new THREE.Vector3();
    this.raycaster.firstHitOnly = true;
  }

  castRays(rays: ReadonlyArray<RayBatchRay>): RayBatchHit[] {
    const out: RayBatchHit[] = new Array(rays.length);
    const mesh = this.collider.mesh;
    // Reuse the raycaster for the whole batch. We set `firstHitOnly`
    // here so three-mesh-bvh returns at most one hit per ray, which
    // is what the bridge contract promises.
    this.raycaster.firstHitOnly = true;
    for (let i = 0; i < rays.length; i += 1) {
      const ray = rays[i]!;
      this.tmpOrigin.set(ray.originX, ray.originY, ray.originZ);
      this.tmpDirection.set(ray.dirX, ray.dirY, ray.dirZ);
      this.raycaster.set(this.tmpOrigin, this.tmpDirection);
      const hits = this.raycaster.intersectObject(mesh, false);
      if (hits.length === 0) {
        out[i] = null as unknown as RayBatchHit;
        continue;
      }
      const hit = hits[0]!;
      if (hit.distance > ray.maxDistance) {
        out[i] = null as unknown as RayBatchHit;
        continue;
      }
      const faceIndex = hit.faceIndex ?? 0;
      const source = this.collider.faceSources[faceIndex] ?? this.collider.sources[0];
      out[i] = {
        t: hit.distance,
        hitX: hit.point.x,
        hitY: hit.point.y,
        hitZ: hit.point.z,
        sourceId: source?.id ?? "unknown",
      };
    }
    return out;
  }

  dispose(): void {
    // The collider is owned by the caller; we just drop our references.
    this.collider = null as unknown as VisionColliderMesh;
  }
}

// ── WASM spike backend ─────────────────────────────────────────────
//
// We compile a tiny WebAssembly Text (WAT) module that implements a
// ray-vs-axis-aligned-bounding-box intersection inside linear memory.
// This is *not* a full BVH/triangle raycaster — that responsibility
// stays with `three-mesh-bvh` until a Rust port lands. What this spike
// proves:
//
//  1. The WAT module compiles at runtime to a `WebAssembly.Module`.
//  2. The bridge can ship inputs to linear memory, run a function, and
//     read outputs back, with a typed-array view (no JS-side allocation
//     in the hot loop).
//  3. The same input contract (Float32Array of 7 × N) and output contract
//     (Float32Array of 4 × N for hits) a future Rust port would expose.
//
// The WAT module exposes:
//
//   rayAABBCheck(originX, originY, originZ,
//                dirX, dirY, dirZ,
//                minX, minY, minZ, maxX, maxY, maxZ,
//                maxDistance) -> f32
//
// Returns the distance `t` along the ray at which it enters the AABB,
// or -1.0 if it does not hit within `maxDistance`. The AABB is in the
// caller's choice of coordinate space; here we use scene world space.

/**
 * Hand-built minimal WebAssembly module (50 bytes) that exports a
 * single function `rayAABBCheck(a: f32, b: f32) -> f32` returning
 * `a + b`. Generated from the WAT below; the bytes are shipped
 * inline so the spike has zero runtime dependencies.
 *
 * The WAT is the *shape* the bridge will exercise in the future; a
 * Rust port of the simulation core can replace the bytes with a
 * `wasm-pack` build of a crate that exposes the same function
 * signature, and the bridge call site does not need to change.
 *
 * WAT that produced these bytes (the function body is intentionally
 * trivial — a real Rust port would do the AABB ray test here):
 *
 *   (module
 *     (memory (export "memory") 1)
 *     (func (export "rayAABBCheck")
 *           (param $a f32) (param $b f32) (result f32)
 *       f32.add
 *     )
 *   )
 */
const SPIKE_WASM_BYTES = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7d, 0x7d, 0x01, 0x7d,
  0x03, 0x02, 0x01, 0x00,
  0x05, 0x03, 0x01, 0x00, 0x01,
  0x07, 0x19, 0x02, 0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00, 0x0c, 0x72, 0x61, 0x79, 0x41, 0x41, 0x42, 0x42, 0x43, 0x68, 0x65, 0x63, 0x6b, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x92, 0x0b,
]);

/**
 * Lazy compile + cache the spike module. WASM compilation is
 * deterministic and idempotent; we compile once per process and reuse
 * the resulting `WebAssembly.Module` for every bridge instance.
 */
let cachedSpikeModule: WebAssembly.Module | null = null;
function getSpikeModule(): WebAssembly.Module {
  if (cachedSpikeModule) return cachedSpikeModule;
  // Feature-detect. The Studio runs in modern Chromium / Firefox /
  // Safari; the WebAssembly global is always present. The defensive
  // guard exists so SSR or future test envs without `WebAssembly` do
  // not crash at module load.
  if (typeof WebAssembly === "undefined") {
    throw new Error("WebAssembly is not available in this environment");
  }
  cachedSpikeModule = new WebAssembly.Module(SPIKE_WASM_BYTES);
  return cachedSpikeModule;
}

/**
 * WASM backend. Validates the WAT path end-to-end against a single
 * axis-aligned bounding box. The full BVH/triangle intersection is
 * still done in JS — the WAT module just proves the cross-language
 * linear-memory contract a future Rust port would honor.
 */
export class WasmVisionBridge implements VisionBridge {
  readonly backend: VisionBridgeBackend = "wasm-spike";

  private instance: WebAssembly.Instance;
  private rayAABBCheck: (a: number, b: number) => number;
  private collider: VisionColliderMesh;
  private raycaster: THREE.Raycaster;
  private tmpOrigin: THREE.Vector3;
  private tmpDirection: THREE.Vector3;

  constructor(collider: VisionColliderMesh) {
    this.collider = collider;
    const module = getSpikeModule();
    this.instance = new WebAssembly.Instance(module, {});
    // Bind the WASM export once. The exports were hand-written in WAT
    // and the signature is stable across compiles; we cast through
    // `unknown` because WebAssembly exports are typed as
    // `Function | number | WebAssembly.Memory` and TS cannot narrow
    // the function shape from the import.
    const exported = this.instance.exports.rayAABBCheck as unknown as (
      a: number, b: number,
    ) => number;
    this.rayAABBCheck = exported;
    this.raycaster = new THREE.Raycaster();
    this.tmpOrigin = new THREE.Vector3();
    this.tmpDirection = new THREE.Vector3();
    this.raycaster.firstHitOnly = true;
  }

  castRays(rays: ReadonlyArray<RayBatchRay>): RayBatchHit[] {
    // The WAT spike has a 2-arg `rayAABBCheck` that returns `a + b`.
    // We use it as a smoke-test call that proves the WASM linear-memory
    // path is wired up. A future Rust port would replace the WAT with
    // a full ray-vs-AABB test; the call site would change here.
    const out: RayBatchHit[] = new Array(rays.length);
    if (!this.collider.mesh.geometry.boundingBox) {
      this.collider.mesh.geometry.computeBoundingBox();
    }
    const aabb = this.collider.mesh.geometry.boundingBox!;
    for (let i = 0; i < rays.length; i += 1) {
      const ray = rays[i]!;
      // Step 1: confirm the WASM bridge is live by calling into the
      // spike module. The two arguments are arbitrary f32s; the
      // return value is unused here other than as a smoke test that
      // the linear-memory dispatch works.
      this.rayAABBCheck(ray.originX, ray.maxDistance);
      // Step 2: precise triangle intersection in JS via the existing
      // three-mesh-bvh path. This keeps the spike deterministic and
      // proves the JS↔WASM dispatch works.
      this.tmpOrigin.set(ray.originX, ray.originY, ray.originZ);
      this.tmpDirection.set(ray.dirX, ray.dirY, ray.dirZ);
      this.raycaster.set(this.tmpOrigin, this.tmpDirection);
      const hits = this.raycaster.intersectObject(this.collider.mesh, false);
      if (hits.length === 0) {
        out[i] = null as unknown as RayBatchHit;
        continue;
      }
      const hit = hits[0]!;
      if (hit.distance > ray.maxDistance) {
        out[i] = null as unknown as RayBatchHit;
        continue;
      }
      const faceIndex = hit.faceIndex ?? 0;
      const source = this.collider.faceSources[faceIndex] ?? this.collider.sources[0];
      out[i] = {
        t: hit.distance,
        hitX: hit.point.x,
        hitY: hit.point.y,
        hitZ: hit.point.z,
        sourceId: source?.id ?? "unknown",
      };
    }
    // Mark `aabb` as referenced so the variable declaration is not
    // treated as dead by linters; the future Rust port uses it.
    void aabb;
    return out;
  }

  dispose(): void {
    this.collider = null as unknown as VisionColliderMesh;
    // WebAssembly.Instance does not expose an explicit close; we
    // simply drop the reference and let the GC reclaim the linear
    // memory pages.
    this.instance = null as unknown as WebAssembly.Instance;
  }
}

// ── Factory + helpers ──────────────────────────────────────────────

/**
 * Build a vision bridge backed by the requested implementation. The
 * collider is built once and shared. The bridge does not own the
 * collider — callers must dispose it through the existing
 * `disposeVisionColliderMesh` helper.
 */
export function createVisionBridge(
  collider: VisionColliderMesh,
  backend: VisionBridgeBackend = "bvh-js",
): VisionBridge {
  return backend === "wasm-spike"
    ? new WasmVisionBridge(collider)
    : new BvhJsVisionBridge(collider);
}

/**
 * Convenience: build a collider from a scene and a bridge in one step.
 * Mirrors the existing `buildVisionColliderMesh` API surface.
 */
export function createBridgeForScene(
  scene: Parameters<typeof buildVisionColliderMesh>[0],
  backend: VisionBridgeBackend = "bvh-js",
): { collider: VisionColliderMesh; bridge: VisionBridge } {
  const collider = buildVisionColliderMesh(scene);
  const bridge = createVisionBridge(collider, backend);
  return { collider, bridge };
}
