import { ImportAdapter, ImportAdapterOptions, ImportAdapterResult } from "../types";

export class CadIfcAdapter implements ImportAdapter {
  id = "cad-ifc";
  name = "CAD / IFC Import";
  description = "Imports spatial geometry and semantic data from CAD/IFC formats. (Boundary)";
  accepts = [".ifc", ".dxf", ".dwg"];

  canHandle(file: File): boolean {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return this.accepts.includes(ext);
  }

  async process(file: File, options: ImportAdapterOptions): Promise<ImportAdapterResult> {
    // TODO: Implement CAD/IFC adapter boundary
    return {
      drafts: [],
      warnings: ["CAD/IFC import boundary established, but parser is not yet implemented."],
    };
  }
}
