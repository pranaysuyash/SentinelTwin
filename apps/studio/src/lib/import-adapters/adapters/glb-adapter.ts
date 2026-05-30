import { ImportAdapter, ImportAdapterOptions, ImportAdapterResult } from "../types";

export class GlbObjAdapter implements ImportAdapter {
  id = "glb-obj";
  name = "GLB / OBJ Visual Mesh Import";
  description = "Imports GLB/OBJ models as a visual reference layer. Separates visual mesh from simulation truth geometry.";
  accepts = [".glb", ".gltf", ".obj"];

  canHandle(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return this.accepts.includes(ext);
  }

  async process(file: File, options: ImportAdapterOptions): Promise<ImportAdapterResult> {
    // TODO: Implement GLB/OBJ import as visual reference layer
    return {
      drafts: [],
      warnings: ["GLB/OBJ import as visual reference layer is stubbed and pending 3D viewer integration."],
    };
  }
}
