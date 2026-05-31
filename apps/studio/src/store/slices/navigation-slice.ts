import type { StateCreator } from "zustand";
import type { StudioStoreState, ProductArea, ViewMode } from "../studio-store";

export interface NavigationSlice {
  productArea: ProductArea;
  setProductArea: (area: ProductArea) => void;
  openStudioMode: (mode: ViewMode) => void;
  openSiteIntake: (selectedSource?: string) => void;
  openScanSitePhotos: (sessionId?: string) => void;
}

export const createNavigationSlice: StateCreator<
  StudioStoreState,
  [],
  [],
  NavigationSlice
> = (_set) => ({
  productArea: "studio_home" as const,

  setProductArea: (area) =>
    _set({ productArea: area }),

  openStudioMode: (mode) =>
    _set({ productArea: "studio_workspace", viewMode: mode }),

  openSiteIntake: (selectedSource) =>
    _set({
      productArea: selectedSource === "scan_photos" ? "scan_site_photos" : "site_intake",
    }),

  openScanSitePhotos: (_sessionId) =>
    _set({
      productArea: "scan_site_photos",
    }),
});
