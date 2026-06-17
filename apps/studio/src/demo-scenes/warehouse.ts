import warehouseRaw from "./warehouse.json";
import { cloneSecurityScene, parseSecurityScene } from "@/schema/security-scene";

export const warehouseScene = parseSecurityScene(warehouseRaw);

export function createWarehouseScene() {
  return cloneSecurityScene(warehouseScene);
}
