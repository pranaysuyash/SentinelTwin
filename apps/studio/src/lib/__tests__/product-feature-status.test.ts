import { describe, expect, test } from "bun:test";

import { PRODUCT_FEATURE_STATUS, PRODUCT_FEATURE_STATUS_LAST_VERIFIED } from "@/lib/product-feature-status";

describe("product feature status", () => {
  test("declares current available/preview entries with verification date", () => {
    expect(PRODUCT_FEATURE_STATUS_LAST_VERIFIED).toBe("2026-05-28");
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Launcher entry flows")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.status === "Available")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.status === "Preview")).toBe(true);
    expect(PRODUCT_FEATURE_STATUS.some((entry) => entry.feature === "Real footage verification" && entry.status === "Preview")).toBe(true);
  });
});
