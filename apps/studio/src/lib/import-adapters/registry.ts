import { ImportAdapter } from "./types";
import { ImageFloorPlanAdapter } from "./adapters/image-adapter";
import { PdfVectorAdapter } from "./adapters/pdf-adapter";
import { CadIfcAdapter } from "./adapters/cad-adapter";
import { GlbObjAdapter } from "./adapters/glb-adapter";

export const IMPORT_ADAPTERS: ImportAdapter[] = [
  new ImageFloorPlanAdapter(),
  new PdfVectorAdapter(),
  new CadIfcAdapter(),
  new GlbObjAdapter(),
];

export function getAdapterForFile(file: File): ImportAdapter | null {
  return IMPORT_ADAPTERS.find(adapter => adapter.canHandle(file)) || null;
}
