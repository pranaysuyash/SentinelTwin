import smallRetailShopRaw from "./small-retail-shop.json";

import { cloneSecurityScene, parseSecurityScene } from "@sentineltwin/core";

export const smallRetailShopScene = parseSecurityScene(smallRetailShopRaw);

export function createSmallRetailShopScene() {
  return cloneSecurityScene(smallRetailShopScene);
}
