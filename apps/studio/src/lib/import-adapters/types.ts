import { SiteTwinDraft } from "../site-compiler";
import { SecurityScene } from "../../schema/security-scene";

export interface ImportAdapterOptions {
  fileName: string;
  fileSize: number;
  mimeType: string;
  [key: string]: unknown;
}

export interface ImportAdapterResult {
  drafts: SiteTwinDraft[];
  candidates?: SecurityScene[];
  warnings?: string[];
  errors?: Error[];
}

export interface ImportAdapter {
  id: string;
  name: string;
  description: string;
  accepts: string[];
  canHandle(file: File): boolean;
  process(file: File, options: ImportAdapterOptions): Promise<ImportAdapterResult>;
}
