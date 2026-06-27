import { ImportAdapter, ImportAdapterOptions, ImportAdapterResult } from "../types";

export class GlbObjAdapter implements ImportAdapter {
  id = "glb-obj";
  name = "GLB / OBJ Visual Mesh Import";
  description = "Imports GLB/OBJ models as a visual reference layer. Extracts bounding box dimensions and creates a draft scene.";
  accepts = [".glb", ".gltf", ".obj"];

  canHandle(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return this.accepts.includes(ext);
  }

  async process(file: File, _options: ImportAdapterOptions): Promise<ImportAdapterResult> {
    return {
      drafts: [],
      warnings: ["GLB/OBJ import requires Three.js runtime. Use the floor plan import for raster-based scene creation."],
    };
  }
}
