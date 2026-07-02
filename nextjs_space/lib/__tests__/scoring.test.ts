import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Karakterizasyon testleri — lib/scoring.ts'in MEVCUT davranışını kilitler.
 * Faz 1 düzeltmeleri bu testleri kırmadan (ya da bilinçli güncelleyerek) yapılmalıdır.
 *
 * prisma çağrıları mock'lanır; böylece saf puanlama mantığı DB olmadan test edilir.
 */

const findManyCategory = vi.fn();
const findManySurveyResponse = vi.fn();
const findManyRecommendation = vi.fn();
const findManyRoadmapItem = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    category: { findMany: (...a: any[]) => findManyCategory(...a) },
    surveyResponse: { findMany: (...a: any[]) => findManySurveyResponse(...a) },
    recommendation: { findMany: (...a: any[]) => findManyRecommendation(...a) },
    roadmapItem: { findMany: (...a: any[]) => findManyRoadmapItem(...a) },
  },
}));

import {
  calculateUserScore,
  buildSurveyQuestionWhere,
  getRecommendationsForUser,
  clampScore,
  scoreConditionalChoice,
  classifyQuadrant,
  MAX_QUESTION_SCORE,
} from "../scoring";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clampScore", () => {
  it("aralık içindeki puanı değiştirmez", () => {
    expect(clampScore(3)).toBe(3);
    expect(clampScore(0)).toBe(0);
    expect(clampScore(MAX_QUESTION_SCORE)).toBe(5);
  });
  it("5'i aşan puanı 5'e sıkıştırır", () => {
    expect(clampScore(9)).toBe(5);
    expect(clampScore(100)).toBe(5);
  });
  it("negatif veya geçersiz (NaN/Infinity) puanı 0'a çeker", () => {
    expect(clampScore(-2)).toBe(0);
    expect(clampScore(NaN)).toBe(0);
    expect(clampScore(Infinity)).toBe(0);
  });
});

describe("scoreConditionalChoice", () => {
  const opts = {
    options: [
      { value: "a", score: 3 },
      { value: "b", score: 4 },
      { value: "c", score: 2 },
    ],
  };
  it("'Hayır' eşiğinde 0 döner", () => {
    expect(scoreConditionalChoice(JSON.stringify({ threshold: "no" }), opts)).toBe(0);
  });
  it("'Evet' + seçili alt-seçenek puanlarını toplar", () => {
    expect(
      scoreConditionalChoice(JSON.stringify({ threshold: "yes", selected: ["a", "c"] }), opts)
    ).toBe(5); // 3 + 2 = 5
  });
  it("toplam 5'i aşarsa 5'e sıkıştırır (regresyon: yüzde >%100 hatası)", () => {
    expect(
      scoreConditionalChoice(JSON.stringify({ threshold: "yes", selected: ["a", "b", "c"] }), opts)
    ).toBe(5); // 3 + 4 + 2 = 9 → clamp 5
  });
  it("bozuk JSON'da 0 döner", () => {
    expect(scoreConditionalChoice("not-json", opts)).toBe(0);
  });
  it("conditionalOptions yoksa 0 döner", () => {
    expect(scoreConditionalChoice(JSON.stringify({ threshold: "yes", selected: ["a"] }), null)).toBe(0);
  });
});

describe("classifyQuadrant", () => {
  it("her iki eksen de >= 3.0 → IRONMAN", () => {
    expect(classifyQuadrant(3.0, 3.0)).toBe("IRONMAN");
    expect(classifyQuadrant(4.5, 5)).toBe("IRONMAN");
  });
  it("hız yüksek, dayanıklılık düşük → SPRINTER", () => {
    expect(classifyQuadrant(3.5, 2.9)).toBe("SPRINTER");
  });
  it("hız düşük, dayanıklılık yüksek → MARATHON_RUNNER", () => {
    expect(classifyQuadrant(2.0, 3.1)).toBe("MARATHON_RUNNER");
  });
  it("her iki eksen de < 3.0 → WALKER", () => {
    expect(classifyQuadrant(1.0, 2.9)).toBe("WALKER");
  });
});

describe("buildSurveyQuestionWhere", () => {
  it("üç seviyeyi de kapsayan OR koşulu üretir", () => {
    const where = buildSurveyQuestionWhere("survey-1");
    expect(where.OR).toHaveLength(3);
    expect(where.OR[0]).toEqual({ category: { surveyId: "survey-1" } });
  });
});

describe("calculateUserScore — doğrudan kategoriye bağlı sorular", () => {
  it("iki eşit ağırlıklı soru için yüzde ve 1-5 puanı doğru hesaplar", async () => {
    findManyCategory.mockResolvedValue([
      {
        id: "cat-1",
        name: "Kategori A",
        order: 0,
        questions: [
          { id: "q1", weight: 1 },
          { id: "q2", weight: 1 },
        ],
        subCategories: [],
      },
    ]);
    findManySurveyResponse.mockResolvedValue([
      { score: 5, question: { weight: 1, category: { id: "cat-1", name: "Kategori A" } } },
      { score: 3, question: { weight: 1, category: { id: "cat-1", name: "Kategori A" } } },
    ]);

    const result = await calculateUserScore("user-1", "survey-1");

    // maxScore = 5*1 + 5*1 = 10 ; alınan = 8 ; yüzde = 80
    expect(result.totalScore).toBe(80);
    // scoreOn5 = 80/100*4+1 = 4.2
    expect(result.totalScoreOn5).toBe(4.2);
    expect(result.categoryScores["cat-1"].percentage).toBe(80);
    expect(result.categoryScores["cat-1"].scoreOn5).toBe(4.2);
  });

  it("hiç cevap yoksa kategori %0 ve 1.0 puan olarak başlatılır", async () => {
    findManyCategory.mockResolvedValue([
      {
        id: "cat-1",
        name: "Kategori A",
        order: 0,
        questions: [{ id: "q1", weight: 1 }],
        subCategories: [],
      },
    ]);
    findManySurveyResponse.mockResolvedValue([]);

    const result = await calculateUserScore("user-1", "survey-1");

    expect(result.totalScore).toBe(0);
    expect(result.categoryScores["cat-1"].percentage).toBe(0);
    expect(result.categoryScores["cat-1"].scoreOn5).toBe(1);
  });
});

describe("calculateUserScore — ağırlıklı sorular", () => {
  it("ağırlık, hem alınan puana hem maksimuma çarpan olarak uygulanır", async () => {
    findManyCategory.mockResolvedValue([
      {
        id: "cat-1",
        name: "Kategori A",
        order: 0,
        questions: [
          { id: "q1", weight: 3 }, // max katkısı 15
          { id: "q2", weight: 1 }, // max katkısı 5
        ],
        subCategories: [],
      },
    ]);
    findManySurveyResponse.mockResolvedValue([
      { score: 5, question: { weight: 3, category: { id: "cat-1", name: "Kategori A" } } }, // 15
      { score: 1, question: { weight: 1, category: { id: "cat-1", name: "Kategori A" } } }, // 1
    ]);

    const result = await calculateUserScore("user-1", "survey-1");
    // max = 20, alınan = 16, yüzde = 80
    expect(result.totalScore).toBe(80);
  });
});

describe("getRecommendationsForUser — soru-cevap tetikli filtreleme", () => {
  it("kullanıcının cevabı triggerOptions içindeyse öneriyi döndürür", async () => {
    // Önce cevap var mı kontrolü, sonra calculateUserScore, sonra recommendation.findMany
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "Evet" }]) // getRecommendationsForUser ilk çağrı
      .mockResolvedValue([]); // calculateUserScore içindeki ikinci çağrı
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        triggerOptions: JSON.stringify(["evet"]),
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "YES_NO" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("rec-1");
    expect(recs[0].triggeredByQuestion).toBe(true);
  });

  it("kullanıcının cevabı triggerOptions'ta yoksa öneriyi elemeye alır", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "Hayır" }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        triggerOptions: JSON.stringify(["evet"]),
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "YES_NO" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(0);
  });

  it("hiç cevap yoksa boş dizi döndürür", async () => {
    findManySurveyResponse.mockResolvedValueOnce([]);
    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toEqual([]);
  });
});
