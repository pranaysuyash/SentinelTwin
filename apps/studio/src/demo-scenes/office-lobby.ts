import officeLobbyRaw from "./office-lobby.json";
import { cloneSecurityScene, parseSecurityScene } from "@/schema/security-scene";

export const officeLobbyScene = parseSecurityScene(officeLobbyRaw);

export function createOfficeLobbyScene() {
  return cloneSecurityScene(officeLobbyScene);
}
