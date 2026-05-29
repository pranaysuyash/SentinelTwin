import { describe, expect, test } from "bun:test";

import { PRODUCT_FEATURE_STATUS, PRODUCT_FEATURE_STATUS_LAST_VERIFIED } from "@/lib/product-feature-status";

describe("product feature status", () => {
  test("declares current available/preview entries with verification date", () => {
    expect(PRODUCT_FEATURE_STATUS_LAST_VERIFIED).toBe("2026-05-29");
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Launcher entry flows")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.status === "Available")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.status === "Preview")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Governance control plane" && entry.status === "Preview")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Governance control plane" && entry.detail.includes("review, approval, rejection, and annotation controls"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Scan Site (manual-assisted)" && entry.status === "Preview")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Scan Site (manual-assisted)" && entry.detail.includes("AI segmentation/depth is not implemented yet"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Guided scan reconstruction" && entry.status === "Planned")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Guided scan reconstruction" && entry.detail.includes("guided phone capture"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.status === "Preview")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.detail.includes("auto best-frame scoring"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.detail.includes("saved snapshot evidence lineage"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.detail.includes("deterministic auto-align assist"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.detail.includes("alignment provenance tags"))).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.detail.includes("reference scale calibration"))).toBe(true);
  });
});
