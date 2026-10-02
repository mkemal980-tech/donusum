import { describe, expect, it } from "vitest";
import { rankStartingRecommendations, recommendationReasons } from "../recommendation-priority";

const rec = (overrides: Partial<Parameters<typeof rankStartingRecommendations>[0][number]> = {}) => ({
  id: "rec",
  title: "Öneri",
  description: "Açıklama",
  strategicType: "PROJECT",
  timeframe: "MEDIUM_TERM",
  costType: "OPEX",
  estimatedImpact: 5,
  order: 0,
  triggeredByQuestion: false,
  isActionable: true,
  stepDistance: 0,
  ...overrides,
});
describe("recommendation priority", () => {
  it("uygulanabilir ve mevcut basamaktaki öneriyi önce seçer", () => {
    const ranked = rankStartingRecommendations([
      rec({ id: "locked", isActionable: false, stepDistance: 1, estimatedImpact: 10 }),
      rec({ id: "passed", stepDistance: -1, estimatedImpact: 10 }),
      rec({ id: "current", stepDistance: 0, estimatedImpact: 3 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["current", "passed", "locked"]);
  });

  it("aynı basamakta cevap ilişkisini ve etkiyi kullanır", () => {
    const ranked = rankStartingRecommendations([
      rec({ id: "generic", estimatedImpact: 9 }),
      rec({ id: "trigger-low", triggeredByQuestion: true, estimatedImpact: 5 }),
      rec({ id: "trigger-high", triggeredByQuestion: true, estimatedImpact: 8 }),
    ]);
    expect(ranked.map((item) => item.id)).toEqual(["trigger-high", "trigger-low", "generic"]);
  });

  it("seçim nedenlerini en fazla iki kısa etiket olarak üretir", () => {
    expect(
      recommendationReasons(
        rec({ triggeredByQuestion: true, strategicType: "QUICK_WIN", timeframe: "SHORT_TERM" })
      )
    ).toEqual(["Yanıtınıza göre", "Kısa vadeli hızlı kazanım"]);
  });
});
