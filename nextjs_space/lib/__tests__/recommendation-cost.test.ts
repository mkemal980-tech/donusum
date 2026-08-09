import { describe, expect, it } from "vitest";
import { deriveCostLevels } from "../recommendation-cost";

describe("deriveCostLevels", () => {
  it("prosedür işi yatırım gerektirmez", () => {
    const levels = deriveCostLevels({
      costType: "OPEX",
      strategicType: "QUICK_WIN",
      timeframe: "SHORT_TERM",
    });
    expect(levels.capexLevel).toBe(1);
    expect(levels.opexLevel).toBe(1);
  });

  it("büyük yatırım en yüksek CAPEX seviyesini alır", () => {
    const levels = deriveCostLevels({
      costType: "CAPEX",
      strategicType: "BIG_BET",
      timeframe: "LONG_TERM",
    });
    expect(levels.capexLevel).toBe(5);
    // Kurulan yatırım işletme yükü de getirir; ama ana yükün altında kalır.
    expect(levels.opexLevel).toBe(3);
    expect(levels.opexLevel).toBeLessThan(levels.capexLevel);
  });

  it("vade uzadıkça yük artar", () => {
    const kisa = deriveCostLevels({ costType: "OPEX", strategicType: "PROJECT", timeframe: "SHORT_TERM" });
    const orta = deriveCostLevels({ costType: "OPEX", strategicType: "PROJECT", timeframe: "MEDIUM_TERM" });
    const uzun = deriveCostLevels({ costType: "OPEX", strategicType: "PROJECT", timeframe: "LONG_TERM" });

    expect(kisa.opexLevel).toBeLessThan(orta.opexLevel);
    expect(orta.opexLevel).toBeLessThan(uzun.opexLevel);
  });

  it("seviyeler her zaman 1-5 aralığında kalır", () => {
    const kombinasyonlar = ["OPEX", "CAPEX", "", null].flatMap((costType) =>
      ["QUICK_WIN", "PROJECT", "BIG_BET", "", null].flatMap((strategicType) =>
        ["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM", "", null].map((timeframe) =>
          deriveCostLevels({ costType, strategicType, timeframe })
        )
      )
    );

    for (const levels of kombinasyonlar) {
      expect(levels.capexLevel).toBeGreaterThanOrEqual(1);
      expect(levels.capexLevel).toBeLessThanOrEqual(5);
      expect(levels.opexLevel).toBeGreaterThanOrEqual(1);
      expect(levels.opexLevel).toBeLessThanOrEqual(5);
    }
  });

  it("tanınmayan değerlerde proje/orta vade varsayılanına düşer", () => {
    const bilinmeyen = deriveCostLevels({ costType: "TAKAS", strategicType: "???", timeframe: "???" });
    const varsayilan = deriveCostLevels({
      costType: "OPEX",
      strategicType: "PROJECT",
      timeframe: "MEDIUM_TERM",
    });
    expect(bilinmeyen).toEqual(varsayilan);
  });

  it("aynı öneri her zaman aynı seviyeyi üretir", () => {
    const girdi = { costType: "CAPEX", strategicType: "PROJECT", timeframe: "MEDIUM_TERM" };
    expect(deriveCostLevels(girdi)).toEqual(deriveCostLevels(girdi));
  });
});
