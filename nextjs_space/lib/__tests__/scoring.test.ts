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
const findUniqueUser = vi.fn();
const findManySurvey = vi.fn();
const findManyAssignment = vi.fn();
const countQuestion = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    category: { findMany: (...a: any[]) => findManyCategory(...a) },
    surveyResponse: { findMany: (...a: any[]) => findManySurveyResponse(...a) },
    recommendation: { findMany: (...a: any[]) => findManyRecommendation(...a) },
    roadmapItem: { findMany: (...a: any[]) => findManyRoadmapItem(...a) },
    user: { findUnique: (...a: any[]) => findUniqueUser(...a) },
    survey: { findMany: (...a: any[]) => findManySurvey(...a) },
    userSurveyAssignment: { findMany: (...a: any[]) => findManyAssignment(...a) },
    question: { count: (...a: any[]) => countQuestion(...a) },
  },
}));

import {
  applicableCascadeRecommendations,
  buildCascadeLevels,
  effectiveQuestionScore,
  calculateUserScore,
  calculateProgressScores,
  buildSurveyQuestionWhere,
  getAccessibleSurveyIds,
  getRecommendationsForUser,
  clampScore,
  maxScoreForQuestion,
  rawAverageToScaledScore,
  scoreConditionalChoice,
  classifyQuadrant,
  MAX_QUESTION_SCORE,
} from "../scoring";

beforeEach(() => {
  vi.clearAllMocks();
  // Varsayılan: bir ankete atanmış normal kullanıcı.
  findUniqueUser.mockResolvedValue({ role: "USER" });
  findManyAssignment.mockResolvedValue([{ surveyId: "survey-1" }]);
  findManySurvey.mockResolvedValue([{ id: "survey-1" }]);
  countQuestion.mockResolvedValue(0);
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

describe("maxScoreForQuestion", () => {
  it("SCALE sorusunun tavanı her zaman 5'tir", () => {
    expect(maxScoreForQuestion({ type: "SCALE" })).toBe(5);
  });

  it("çoktan seçmelide en yüksek şık puanını tavan alır", () => {
    expect(
      maxScoreForQuestion({
        type: "MULTIPLE_CHOICE",
        options: [
          { value: "a", score: 0 },
          { value: "b", score: 1 },
          { value: "c", score: 2 },
          { value: "d", score: 3 },
        ],
      })
    ).toBe(3);
  });

  it("evet/hayır sorusunda şık puanlarını kullanır", () => {
    expect(
      maxScoreForQuestion({
        type: "YES_NO",
        options: [
          { value: "yes", score: 4 },
          { value: "no", score: 0 },
        ],
      })
    ).toBe(4);
  });

  it("kademeli puanlamada alt seçenek puanlarını toplar, 5 ile sınırlar", () => {
    expect(
      maxScoreForQuestion({
        type: "CONDITIONAL_CHOICE",
        conditionalOptions: { options: [{ value: "a", score: 2 }, { value: "b", score: 1 }] },
      })
    ).toBe(3);
    expect(
      maxScoreForQuestion({
        type: "CONDITIONAL_CHOICE",
        conditionalOptions: { options: [{ value: "a", score: 4 }, { value: "b", score: 4 }] },
      })
    ).toBe(5);
  });

  it("şık tanımı yoksa veya tüm şıklar 0 ise 5'e düşer (sıfıra bölme koruması)", () => {
    expect(maxScoreForQuestion({ type: "MULTIPLE_CHOICE" })).toBe(5);
    expect(maxScoreForQuestion({ type: "MULTIPLE_CHOICE", options: [] })).toBe(5);
    expect(
      maxScoreForQuestion({ type: "MULTIPLE_CHOICE", options: [{ value: "a", score: 0 }] })
    ).toBe(5);
    expect(maxScoreForQuestion({})).toBe(5);
  });
});

describe("rawAverageToScaledScore", () => {
  it("eski 0-5 ham ortalamayı 1-5 ölçeğine taşır", () => {
    expect(rawAverageToScaledScore(0)).toBe(1); // %0 başarı → 1.0
    expect(rawAverageToScaledScore(2.5)).toBe(3); // %50 → 3.0
    expect(rawAverageToScaledScore(5)).toBe(5); // %100 → 5.0
  });

  it("yeni motorun aynı veri için ürettiği değeri verir", () => {
    // Ham ortalama 3.0 → başarı %60 → 0.6 × 4 + 1 = 3.4
    expect(rawAverageToScaledScore(3)).toBe(3.4);
    expect(rawAverageToScaledScore(4)).toBe(4.2);
  });

  it("artan bir dönüşümdür — trendin yönü korunur", () => {
    const mapped = [0, 1, 2, 3, 4, 5].map(rawAverageToScaledScore);
    for (let i = 1; i < mapped.length; i++) {
      expect(mapped[i]).toBeGreaterThan(mapped[i - 1]);
    }
  });

  it("aralık dışı ve bozuk değerleri 1-5 içinde tutar", () => {
    expect(rawAverageToScaledScore(-2)).toBe(1);
    expect(rawAverageToScaledScore(9)).toBe(5);
    expect(rawAverageToScaledScore(NaN)).toBe(1);
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

  it("soruya bağlı ama tetikleyici şıkkı olmayan öneri herkese gösterilmez", async () => {
    // Regresyon: eski zincir `questionId && triggerOptions` aradığı için
    // şıkkı olmayan soru-bağlı öneriler "genel öneri" dalına düşüp
    // soruyu cevaplamamış kullanıcılara da çıkıyordu.
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "baska-soru", value: "3" }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        triggerOptions: null,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "CONDITIONAL_CHOICE" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(0);
  });

  it("soruya bağlı ve şıkkı olmayan öneri, soru cevaplanmışsa puan aralığına düşer", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: '{"threshold":"yes"}' }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        triggerOptions: null,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "CONDITIONAL_CHOICE" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(1);
  });

  it("bozuk triggerOptions JSON'unda öneriyi gizler (hata fırlatmaz)", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "evet" }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-bozuk",
        questionId: "q1",
        triggerOptions: "{ dizi degil }",
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "YES_NO" },
        subLevel: null,
        subCategory: null,
      },
      {
        // Geçerli JSON ama dizi değil — eski kod burada .map ile çöküyordu.
        id: "rec-obje",
        questionId: "q1",
        triggerOptions: JSON.stringify({ evet: true }),
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

  it("kademeli öneri, eşiğin altındaki tüm cevaplarda gösterilir", async () => {
    // A=0, B=1, C=2, D=3 puanlı bir soruda C'yi (2 puan) seçen kullanıcı
    // kendi önerisini ve D'den (3 puan) devralınanı görür; A'nınkini görmez.
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "c", score: 2 }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue(
      [
        { id: "rec-a", triggerMaxAnswerScore: 0 },
        { id: "rec-b", triggerMaxAnswerScore: 1 },
        { id: "rec-c", triggerMaxAnswerScore: 2 },
        { id: "rec-d", triggerMaxAnswerScore: 3 },
      ].map(rec => ({
        ...rec,
        questionId: "q1",
        triggerOptions: null,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "MULTIPLE_CHOICE" },
        subLevel: null,
        subCategory: null,
      }))
    );
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs.map(r => r.id)).toEqual(["rec-c", "rec-d"]);
  });

  it("en düşük şıkkı seçen kullanıcı tüm üst basamakları devralır", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "a", score: 0 }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue(
      [0, 1, 2, 3].map(threshold => ({
        id: `rec-${threshold}`,
        questionId: "q1",
        triggerOptions: null,
        triggerMaxAnswerScore: threshold,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "MULTIPLE_CHOICE" },
        subLevel: null,
        subCategory: null,
      }))
    );
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(4);
  });

  it("kademeli eşik, kademeli puanlama (JSON cevaplı) sorularda da çalışır", async () => {
    // Şık bazlı tetikleme bu tipte imkânsızdı; puan eşiği tekil sayı olduğu
    // için sorunsuz eşleşir.
    findManySurveyResponse
      .mockResolvedValueOnce([
        { questionId: "q1", value: '{"threshold":"yes","selected":["a"]}', score: 2 },
      ])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        triggerOptions: null,
        triggerMaxAnswerScore: 3,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "CONDITIONAL_CHOICE" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(1);
  });

  it("kademeli eşik varsa tam eşleşme listesi yok sayılır", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "c", score: 2 }])
      .mockResolvedValue([]);
    findManyCategory.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      {
        id: "rec-1",
        questionId: "q1",
        // Eski tam eşleşme listesi kalmış olsa bile eşik önceliklidir.
        triggerOptions: JSON.stringify(["d"]),
        triggerMaxAnswerScore: 3,
        minScoreThreshold: 0,
        maxScoreThreshold: 100,
        question: { id: "q1", text: "Soru 1", type: "MULTIPLE_CHOICE" },
        subLevel: null,
        subCategory: null,
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const recs = await getRecommendationsForUser("user-1");
    expect(recs).toHaveLength(1);
  });

  it("yalnızca kullanıcının erişebildiği anketlerin önerilerini sorgular", async () => {
    findManySurveyResponse
      .mockResolvedValueOnce([{ questionId: "q1", value: "evet" }])
      .mockResolvedValue([]);
    // Aynı mock hem kapsam sorgusuna hem calculateUserScore'a döner.
    findManyCategory.mockResolvedValue([
      { id: "cat-1", name: "Kategori 1", questions: [], subCategories: [] },
    ]);
    findManyRecommendation.mockResolvedValue([]);
    findManyRoadmapItem.mockResolvedValue([]);
    findManyAssignment.mockResolvedValue([{ surveyId: "survey-1" }]);

    await getRecommendationsForUser("user-1");

    const where = findManyRecommendation.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { subCategory: { category: { surveyId: { in: ["survey-1"] } } } },
        { categoryId: { in: ["cat-1"] } },
        { questionId: null, subLevelId: null, subCategoryId: null, categoryId: null },
      ])
    );
  });
});

describe("getAccessibleSurveyIds", () => {
  it("ADMIN tüm aktif anketleri görür", async () => {
    findUniqueUser.mockResolvedValue({ role: "ADMIN" });
    findManySurvey.mockResolvedValue([{ id: "s1" }, { id: "s2" }]);

    expect(await getAccessibleSurveyIds("admin-1")).toEqual(["s1", "s2"]);
    expect(findManyAssignment).not.toHaveBeenCalled();
  });

  it("normal kullanıcı yalnızca aktif atamalarını görür", async () => {
    findUniqueUser.mockResolvedValue({ role: "USER" });
    findManyAssignment.mockResolvedValue([{ surveyId: "s1" }]);

    expect(await getAccessibleSurveyIds("user-1")).toEqual(["s1"]);
  });

  it("erişilemeyen anket istenirse boş döner (yetki genişlemez)", async () => {
    findUniqueUser.mockResolvedValue({ role: "USER" });
    findManyAssignment.mockResolvedValue([{ surveyId: "s1" }]);

    expect(await getAccessibleSurveyIds("user-1", "baskasinin-anketi")).toEqual([]);
  });
});

describe("buildCascadeLevels / effectiveQuestionScore", () => {
  const levelRecs = [
    { id: "r0", questionId: "q1", triggerMaxAnswerScore: 0 },
    { id: "r1", questionId: "q1", triggerMaxAnswerScore: 1 },
    { id: "r2", questionId: "q1", triggerMaxAnswerScore: 2 },
    { id: "r3", questionId: "q1", triggerMaxAnswerScore: 3 },
  ];

  it("hiçbir öneri tamamlanmadıysa ilk basamakta durur", () => {
    const state = buildCascadeLevels(levelRecs, new Set()).get("q1")!;
    expect(state.thresholds).toEqual([0, 1, 2, 3]);
    expect(state.currentIndex).toBe(0);
    expect(effectiveQuestionScore(0, state, 3)).toBe(0);
  });

  it("alt basamak tamamlanınca etkin puan bir üst basamağa çıkar", () => {
    const state = buildCascadeLevels(levelRecs, new Set(["r0"])).get("q1")!;
    expect(state.currentIndex).toBe(1);
    expect(effectiveQuestionScore(0, state, 3)).toBe(1);
  });

  it("bir basamakta birden fazla öneri varsa hepsi bitmeden ilerlemez", () => {
    const recs = [
      { id: "r0a", questionId: "q1", triggerMaxAnswerScore: 0 },
      { id: "r0b", questionId: "q1", triggerMaxAnswerScore: 0 },
      { id: "r1", questionId: "q1", triggerMaxAnswerScore: 1 },
    ];
    expect(buildCascadeLevels(recs, new Set(["r0a"])).get("q1")!.currentIndex).toBe(0);
    expect(buildCascadeLevels(recs, new Set(["r0a", "r0b"])).get("q1")!.currentIndex).toBe(1);
  });

  it("üst basamak atlanarak tamamlanmışsa alt basamak yine de bekletir", () => {
    // Sunucu kilidi bunu engeller; hesap yine de sıralamayı korumalı.
    const state = buildCascadeLevels(levelRecs, new Set(["r3"])).get("q1")!;
    expect(state.currentIndex).toBe(0);
    expect(effectiveQuestionScore(0, state, 3)).toBe(0);
  });

  it("tüm basamaklar bitince etkin puan sorunun tavanı olur", () => {
    const state = buildCascadeLevels(levelRecs, new Set(["r0", "r1", "r2", "r3"])).get("q1")!;
    expect(effectiveQuestionScore(0, state, 3)).toBe(3);
  });

  it("baseline'ın altındaki basamaklar süzülür — ilerlemeyi kilitlemesinler", () => {
    // C'yi (2 puan) seçen kullanıcı 0 ve 1 eşikli önerileri hiç görmez.
    const baseline = new Map([["q1", 2]]);
    const applicable = applicableCascadeRecommendations(levelRecs, baseline);
    expect(applicable.map(r => r.id)).toEqual(["r2", "r3"]);

    const state = buildCascadeLevels(applicable, new Set(["r2"])).get("q1")!;
    expect(effectiveQuestionScore(2, state, 3)).toBe(3);
  });

  it("cevaplanmamış sorunun kademeleri hesaba katılmaz", () => {
    expect(applicableCascadeRecommendations(levelRecs, new Map())).toEqual([]);
  });
});

describe("calculateProgressScores", () => {
  // Tavanı 5 olan SCALE soruları — normalize oran doğrudan puan/5.
  const velocityQuestion = { weight: 1, axisType: "VELOCITY", type: "SCALE" };
  const enduranceQuestion = { weight: 1, axisType: "ENDURANCE", type: "SCALE" };

  beforeEach(() => {
    findManyCategory.mockResolvedValue([]);
    countQuestion.mockResolvedValue(4);
    // Kademeli öneri yok — bu blokta baseline davranış sınanır.
    findManyRecommendation.mockResolvedValue([]);
  });

  it("eksen puanlarını normalize başarı oranından 1-5 ölçeğine taşır", async () => {
    findManySurveyResponse.mockResolvedValue([
      { score: 4, question: velocityQuestion },
      { score: 2, question: velocityQuestion },
      { score: 3, question: enduranceQuestion },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);

    const scores = await calculateProgressScores("user-1");
    // (0.8 + 0.4) / 2 = %60 → 0.60 × 4 + 1 = 3.4
    expect(scores.velocityScore).toBe(3.4);
    expect(scores.enduranceScore).toBe(3.4);
    expect(scores.completedQuestions).toBe(3);
    expect(scores.totalQuestions).toBe(4);
    expect(scores.quadrant).toBe("IRONMAN");
  });

  it("tavanı 5'in altında olan soruyu haksız yere aşağı çekmez", async () => {
    // Regresyon: en yüksek şıkkı 3 puan veren soruda en olgun cevap eskiden
    // %60'ta kalıyordu; artık sorunun kendi tavanına göre %100 sayılır.
    const olgunCevap = {
      weight: 1,
      axisType: "VELOCITY",
      type: "MULTIPLE_CHOICE",
      options: [
        { value: "a", score: 0 },
        { value: "b", score: 1 },
        { value: "c", score: 2 },
        { value: "d", score: 3 },
      ],
    };
    findManySurveyResponse.mockResolvedValue([{ score: 3, question: olgunCevap }]);
    findManyRoadmapItem.mockResolvedValue([]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.velocityScore).toBe(5);
  });

  it("kademesiz önerinin puanını soru katkısıyla aynı birimde ekler", async () => {
    // points = 0.5 → "yarım soruluk ilerleme". Eksende tek soru (ağırlık 1)
    // olduğu için oran 0.4'ten 0.9'a çıkar: 0.9 × 4 + 1 = 4.6.
    findManySurveyResponse.mockResolvedValue([
      { score: 2, question: velocityQuestion },
      { score: 2, question: enduranceQuestion },
    ]);
    findManyRoadmapItem.mockResolvedValue([
      { recommendation: { points: 0.5, subLevel: { axisType: "ENDURANCE" } } },
    ]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.velocityScore).toBe(2.6); // %40 → 2.6, bonus yok
    expect(scores.enduranceScore).toBe(4.6);
    expect(scores.completedRecommendations).toBe(1);
  });

  it("bonusun etkisi anketin boyutuna göre orantılıdır", async () => {
    // Regresyon: eski davranışta ham points doğrudan 1-5 ortalamasına
    // ekleniyordu, yani anket ne kadar uzun olursa olsun her öneri +0.5
    // getiriyordu. Artık aynı öneri 4 soruluk bir eksende +0.5, 20 soruluk
    // bir eksende +0.1 eder.
    const answers = (count: number) =>
      Array.from({ length: count }, () => ({ score: 0, question: velocityQuestion }));

    findManyRoadmapItem.mockResolvedValue([
      { recommendation: { points: 0.5, subLevel: { axisType: "VELOCITY" } } },
    ]);

    findManySurveyResponse.mockResolvedValue(answers(4));
    const short = await calculateProgressScores("user-1");
    expect(short.velocityScore).toBe(1.5); // 4 × 0.5 / 4 = 0.5

    findManySurveyResponse.mockResolvedValue(answers(20));
    const long = await calculateProgressScores("user-1");
    expect(long.velocityScore).toBe(1.1); // 4 × 0.5 / 20 = 0.1
  });

  it("bonus eksen puanını 5'in üzerine çıkaramaz", async () => {
    findManySurveyResponse.mockResolvedValue([
      { score: 5, question: velocityQuestion },
    ]);
    findManyRoadmapItem.mockResolvedValue([
      { recommendation: { points: 3, subLevel: { axisType: "VELOCITY" } } },
    ]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.velocityScore).toBe(5);
    expect(scores.velocityBonus).toBe(0);
  });

  it("bonusla birlikte genel puan eksenlerle tutarlı kalır ve 5'i aşmaz", async () => {
    // Regresyon: eski formül genel puana (bonusV + bonusE) / 2 ekliyordu;
    // eksen puanları 5'te sınırlanırken genel puan bağımsız kayabiliyordu.
    findManySurveyResponse.mockResolvedValue([
      { score: 5, question: velocityQuestion },
      { score: 5, question: enduranceQuestion },
    ]);
    findManyRoadmapItem.mockResolvedValue([
      { recommendation: { points: 3, subLevel: { axisType: "VELOCITY" } } },
    ]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.velocityScore).toBe(5);
    expect(scores.overallScore).toBe(5);
    expect(scores.overallPercentage).toBe(100);
  });

  it("eksen ağırlıklarını ve bonus ayrımını raporlar", async () => {
    // ironman ekranı ağırlığı, gelişim grafiği base/bonus ayrımını kullanır.
    findManySurveyResponse.mockResolvedValue([
      { score: 2, question: { ...velocityQuestion, weight: 2 } },
      { score: 5, question: enduranceQuestion },
    ]);
    findManyRoadmapItem.mockResolvedValue([
      { recommendation: { points: 0.5, subLevel: { axisType: "VELOCITY" } } },
    ]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.velocityWeight).toBe(2);
    expect(scores.enduranceWeight).toBe(1);
    expect(scores.velocityBase).toBe(2.6); // %40 → 2.6, bonus hariç
    // 0.5 birim bonus / 2 ağırlık = +0.25 oran → +1.0 puan
    expect(scores.velocityScore).toBe(3.6);
    expect(scores.velocityBonus).toBe(1);
    expect(scores.enduranceBonus).toBe(0);
  });

  it("hiç cevap yokken yüzdeyi negatife düşürmez", async () => {
    findManySurveyResponse.mockResolvedValue([]);
    findManyRoadmapItem.mockResolvedValue([]);

    const scores = await calculateProgressScores("user-1");
    expect(scores.overallScore).toBe(0);
    expect(scores.overallPercentage).toBe(0);
  });
});
