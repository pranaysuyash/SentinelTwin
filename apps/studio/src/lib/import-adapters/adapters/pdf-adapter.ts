import { ImportAdapter, ImportAdapterOptions, ImportAdapterResult } from "../types";

export class PdfVectorAdapter implements ImportAdapter {
  id = "pdf-vector";
  name = "Vector PDF Extraction";
  description = "Extracts geometry directly from vector PDF floor plans. (Research Boundary)";
  accepts = ["application/pdf"];

  canHandle(file: File): boolean {
    return this.accepts.includes(file.type) || file.name.toLowerCase().endsWith('.pdf');
  }

  async process(file: File, options: ImportAdapterOptions): Promise<ImportAdapterResult> {
    // TODO: Implement PDF vector extraction research boundary
    return {
      drafts: [],
      warnings: ["Vector PDF extraction is currently in research phase and not fully implemented. Falling back to rasterization is recommended."],
    };
  }
}
