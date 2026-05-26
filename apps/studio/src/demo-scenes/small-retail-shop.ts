import smallRetailShopRaw from "./small-retail-shop.json";

import { cloneSecurityScene, parseSecurityScene } from "@/schema/security-scene";

export const smallRetailShopScene = parseSecurityScene(smallRetailShopRaw);

export function createSmallRetailShopScene() {
  return cloneSecurityScene(smallRetailShopScene);
}
