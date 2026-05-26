import { describe, expect, test } from "bun:test";

import { DORI_THRESHOLDS, ppmToQuality } from "@/simulation/dori";

describe("ppmToQuality", () => {
  test("maps representative ppm values to DORI quality bands", () => {
    expect(ppmToQuality(300)).toBe("identification");
    expect(ppmToQuality(200)).toBe("recognition");
    expect(ppmToQuality(80)).toBe("observation");
    expect(ppmToQuality(30)).toBe("detection");
    expect(ppmToQuality(10)).toBe("none");
  });

  test("treats threshold values as inclusive", () => {
    expect(ppmToQuality(DORI_THRESHOLDS.recognition)).toBe("recognition");
    expect(ppmToQuality(DORI_THRESHOLDS.identification)).toBe("identification");
  });
});
