import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SAMPLE_SECURITY_SCENE_IMPORT_FILENAME = "sample-security-scene-import.json";
export const JEWELRY_STORE_SITE_TWIN_FILENAME = "jewelry-store-site-twin.json";
export const LEGACY_JEWELRY_STORE_UPLOAD_FILENAME = "sentineltwin_upload_test_jewelry_store.json";

export const sampleSecuritySceneImportPath = fileURLToPath(
  new URL(`../../public/${SAMPLE_SECURITY_SCENE_IMPORT_FILENAME}`, import.meta.url),
);

export const publicJewelryStoreSiteTwinPath = fileURLToPath(
  new URL(`../../public/sample-site-twins/${JEWELRY_STORE_SITE_TWIN_FILENAME}`, import.meta.url),
);

export const legacyRootJewelryStoreUploadPath = fileURLToPath(
  new URL(`../../../../${LEGACY_JEWELRY_STORE_UPLOAD_FILENAME}`, import.meta.url),
);

export const fixtureJewelryStoreUploadPath = fileURLToPath(
  new URL(`./${LEGACY_JEWELRY_STORE_UPLOAD_FILENAME}`, import.meta.url),
);

export function readSampleJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function readSampleText(filePath: string): string {
  return readFileSync(filePath, "utf8");
}
