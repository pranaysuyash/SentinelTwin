import { describe, expect, test } from "bun:test";

import { DORI_THRESHOLDS, ppmToDoriQuality, ppmToQuality } from "@/simulation/dori";

describe("ppmToDoriQuality", () => {
  test("maps representative ppm values to DORI quality bands", () => {
    expect(ppmToDoriQuality(300)).toBe("identification");
    expect(ppmToDoriQuality(200)).toBe("recognition");
    expect(ppmToDoriQuality(80)).toBe("observation");
    expect(ppmToDoriQuality(30)).toBe("detection");
    expect(ppmToDoriQuality(10)).toBe("none");
  });

  test("treats threshold values as inclusive", () => {
    expect(ppmToDoriQuality(DORI_THRESHOLDS.recognition)).toBe("recognition");
    expect(ppmToDoriQuality(DORI_THRESHOLDS.identification)).toBe("identification");
  });

  test("supports custom stricter and looser quality thresholds", () => {
    const ppm = 80;
    const qualityRank = (quality: string) =>
      ["none", "detection", "observation", "recognition", "identification"].indexOf(quality);
    const defaultQuality = ppmToDoriQuality(ppm);

    const stricter = ppmToDoriQuality(ppm, {
      detection: 20,
      observation: 100,
      recognition: 200,
      identification: 400,
    });
    const looser = ppmToDoriQuality(ppm, {
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

  test("keeps the deprecated compatibility helper aligned with DORI mapping", () => {
    expect(ppmToQuality(300)).toBe(ppmToDoriQuality(300));
    expect(ppmToQuality(80)).toBe(ppmToDoriQuality(80));
    expect(
      ppmToQuality(80, {
        detection: 20,
        observation: 100,
        recognition: 200,
        identification: 400,
      }),
    ).toBe("detection");
  });
});
