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

  test("supports custom stricter and looser quality thresholds", () => {
    const ppm = 80;
    const qualityRank = (quality: string) =>
      ["none", "detection", "observation", "recognition", "identification"].indexOf(quality);
    const defaultQuality = ppmToQuality(ppm);

    const stricter = ppmToQuality(ppm, {
      detection: 20,
      observation: 100,
      recognition: 200,
      identification: 400,
    });
    const looser = ppmToQuality(ppm, {
      detection: 10,
      observation: 30,
      recognition: 60,
      identification: 120,
    });

    expect(stricter).toBe("detection");
    expect(defaultQuality).toBe("observation");
    expect(looser).toBe("recognition");
    expect(qualityRank(stricter)).toBeLessThan(qualityRank(defaultQuality));
    expect(qualityRank(looser)).toBeGreaterThan(qualityRank(defaultQuality));
  });
});
