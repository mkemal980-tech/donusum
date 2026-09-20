import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gelişim motoru — docs/GELISIM-PUANI.md sözleşmesinin testleri.
 *
 * Saf hesap fonksiyonları DB olmadan; yükleyici ise prisma mock'uyla sınanır.
 */

const findManyCategory = vi.fn();
const findManySurveyResponse = vi.fn();
const findManyRecommendation = vi.fn();
const findManyRoadmapItem = vi.fn();
const findUniqueUser = vi.fn();
const findManySurvey = vi.fn();
const findManyAssignment = vi.fn();
const findManyQuestion = vi.fn();
const findManyScopeRule = vi.fn();
const findManyAssessment = vi.fn();

vi.mock("../db", () => ({
  prisma: {
    category: { findMany: (...a: any[]) => findManyCategory(...a) },
    surveyResponse: { findMany: (...a: any[]) => findManySurveyResponse(...a) },
    recommendation: { findMany: (...a: any[]) => findManyRecommendation(...a) },
    roadmapItem: { findMany: (...a: any[]) => findManyRoadmapItem(...a) },
    user: { findUnique: (...a: any[]) => findUniqueUser(...a) },
    survey: { findMany: (...a: any[]) => findManySurvey(...a) },
    userSurveyAssignment: { findMany: (...a: any[]) => findManyAssignment(...a) },
    question: { findMany: (...a: any[]) => findManyQuestion(...a) },
    sectorScopeRule: { findMany: (...a: any[]) => findManyScopeRule(...a) },
    assessment: { findMany: (...a: any[]) => findManyAssessment(...a) },
  },
}));

import {
  computeProgress,
  summarizeProgress,
  computeRecommendationContributions,
  computeProgressBreakdown,
  effectiveRecommendationPoints,
  isCascadeRecommendation,
  toProgressRecommendationInput,
  loadProgressInputs,
  calculateRecommendationContributions,
  type ProgressInputs,
  type ProgressRecommendationInput,
  type ProgressResponseInput,
} from "../scoring";

const response = (
  overrides: Partial<ProgressResponseInput> & { questionId: string; score: number }
): ProgressResponseInput => ({
  weight: 1,
  applicable: true,
  axisType: "VELOCITY",
  maxScore: 5,
  categoryId: null,
  subCategoryId: null,
  ...overrides,
});

const rec = (
  overrides: Partial<ProgressRecommendationInput> & { id: string }
): ProgressRecommendationInput => ({
  questionId: null,
  triggerMaxAnswerScore: null,
  points: 0,
  axisType: "VELOCITY",
  categoryId: null,
  subCategoryId: null,
  ...overrides,
});

const inputs = (
  partial: Partial<ProgressInputs> & { responses: ProgressResponseInput[] }
): ProgressInputs => ({
  recommendations: [],
  completedIds: new Set(),
  completedCount: 0,
  totalQuestions: partial.responses.length,
  ...partial,
});

/** Tek soru (tavan 5, cevap 1) üstünde üç basamaklı merdiven: 1 → 2 → 3 → tavan. */
const ladder = () => [
  rec({ id: "r1", questionId: "q1", triggerMaxAnswerScore: 1 }),
  rec({ id: "r2", questionId: "q1", triggerMaxAnswerScore: 2 }),
  rec({ id: "r3", questionId: "q1", triggerMaxAnswerScore: 3 }),
];

describe("kural 2 — kademeli öneride puan her zaman 0", () => {
  it("eşiği dolu öneriyi kademeli sayar", () => {
    expect(isCascadeRecommendation({ triggerMaxAnswerScore: 0 })).toBe(true);
    expect(isCascadeRecommendation({ triggerMaxAnswerScore: null })).toBe(false);
    expect(isCascadeRecommendation({ triggerMaxAnswerScore: undefined })).toBe(false);
  });

  it("kademeli öneride saklanan puan ne olursa olsun 0 döner", () => {
    expect(effectiveRecommendationPoints({ triggerMaxAnswerScore: 2, points: 0.5 })).toBe(0);
    expect(effectiveRecommendationPoints({ triggerMaxAnswerScore: null, points: 0.5 })).toBe(0.5);
    expect(effectiveRecommendationPoints({ triggerMaxAnswerScore: null, points: -1 })).toBe(0);
    expect(effectiveRecommendationPoints({ triggerMaxAnswerScore: null, points: null })).toBe(0);
  });

  it("yanlışlıkla puan yazılmış kademeli öneri bonus üretmez", () => {
    // Basamak yükselmesi zaten etkin puana yansıdı; puanı bir daha saymak
    // mükerrer olur. Bu yüzden sunucu tarafında da 0'a çekilir.
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: [
        rec({ id: "r1", questionId: "q1", triggerMaxAnswerScore: 1, points: 2 }),
        rec({ id: "r2", questionId: "q1", triggerMaxAnswerScore: 2 }),
        rec({ id: "r3", questionId: "q1", triggerMaxAnswerScore: 3 }),
      ],
      completedIds: new Set(["r1"]),
    });
    // Basamak 1 tamam → etkin puan 2 → %40 → 2.6. Puan sayılsaydı 5'e dayanırdı.
    expect(computeProgress(data).velocityScore).toBeCloseTo(2.6, 5);
  });
});

describe("computeProgress / summarizeProgress — taban ve fark", () => {
  it("kademeli basamak tamamlanınca mevcut puan yükselir, taban sabit kalır", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: ladder(),
      completedIds: new Set(["r1"]),
      completedCount: 1,
    });

    const scores = summarizeProgress(data);
    expect(scores.baselineOverallScore).toBe(1.8); // %20
    expect(scores.overallScore).toBe(2.6); // %40
    expect(scores.delta).toBe(0.8);
    expect(scores.deltaPercentage).toBe(20);
    // Eksen tabanı da basamak yükselmesini içermez; bonus ise içerir.
    expect(scores.velocityBase).toBe(1.8);
    expect(scores.velocityBonus).toBe(0.8);
    expect(scores.completedRecommendations).toBe(1);
  });

  it("hiçbir şey tamamlanmamışsa fark 0'dır", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 3 })],
      recommendations: ladder(),
    });
    const scores = summarizeProgress(data);
    expect(scores.delta).toBe(0);
    expect(scores.deltaPercentage).toBe(0);
    expect(scores.overallScore).toBe(scores.baselineOverallScore);
  });

  it("kademesiz öneri puanını eksen ağırlığına oranlayarak ekler", () => {
    // 0.5 puan / 2 ağırlık = +0.25 oran → +1.0 puan
    const data = inputs({
      responses: [
        response({ questionId: "q1", score: 1 }),
        response({ questionId: "q2", score: 1 }),
      ],
      recommendations: [rec({ id: "p1", points: 0.5 })],
      completedIds: new Set(["p1"]),
      completedCount: 1,
    });
    const scores = summarizeProgress(data);
    expect(scores.baselineOverallScore).toBe(1.8);
    expect(scores.overallScore).toBe(2.8);
    expect(scores.delta).toBe(1);
  });

  it("kapsam dışı cevap ne tabana ne mevcuda girer", () => {
    const data = inputs({
      responses: [
        response({ questionId: "q1", score: 5, applicable: false }),
        response({ questionId: "q2", score: 1 }),
      ],
    });
    const current = computeProgress(data);
    expect(current.answeredInScope).toBe(1);
    expect(current.velocityScore).toBeCloseTo(1.8, 5);
  });
});

describe("computeRecommendationContributions — öneri başına katkı (kural 4)", () => {
  it("kademesiz öneri: tamamlanınca eklediği fark; tamamlanmamışsa şu an 0", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: [rec({ id: "p1", points: 0.5 })],
    });
    const before = computeRecommendationContributions(data, ["p1"]).get("p1")!;
    expect(before).toMatchObject({ kind: "points", full: 2, current: 0, rung: null });

    const after = computeRecommendationContributions(
      { ...data, completedIds: new Set(["p1"]) },
      ["p1"]
    ).get("p1")!;
    expect(after).toMatchObject({ full: 2, current: 2 });
  });

  it("kademeli merdivende basamak katkıları sırayla atfedilir ve toplamı merdivenin toplamına eşittir", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: ladder(),
    });
    const result = computeRecommendationContributions(data, ["r1", "r2", "r3"]);

    // 1.8 → 2.6 → 3.4 → 5.0
    expect(result.get("r1")).toMatchObject({ kind: "cascade", full: 0.8, current: 0, rung: { index: 1, total: 3 } });
    expect(result.get("r2")).toMatchObject({ full: 0.8, rung: { index: 2, total: 3 } });
    expect(result.get("r3")).toMatchObject({ full: 1.6, rung: { index: 3, total: 3 } });

    const total = summarizeProgress({ ...data, completedIds: new Set(["r1", "r2", "r3"]) }).delta;
    const sum = ["r1", "r2", "r3"].reduce((acc, id) => acc + result.get(id)!.full, 0);
    expect(sum).toBeCloseTo(total, 5);
  });

  it("basamağın katkısı diğer basamakların gerçek durumundan bağımsızdır", () => {
    // Yalnızca r1 tamam; r2'nin 'tamamlanınca' değeri yine 0.8'dir.
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: ladder(),
      completedIds: new Set(["r1"]),
    });
    const result = computeRecommendationContributions(data, ["r1", "r2"]);
    expect(result.get("r1")).toMatchObject({ full: 0.8, current: 0.8 });
    expect(result.get("r2")).toMatchObject({ full: 0.8, current: 0 });
  });

  it("sırası atlanarak tamamlanmış basamak sayılmaz: şu an 0", () => {
    // Kilit sunucuda uygulanır; eski kayıtlarda ya da kilit atlanmışsa
    // ekran yine doğruyu söyler.
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: ladder(),
      completedIds: new Set(["r2"]),
    });
    const result = computeRecommendationContributions(data, ["r2"]);
    expect(result.get("r2")).toMatchObject({ full: 0.8, current: 0 });
    expect(summarizeProgress(data).delta).toBe(0);
  });

  it("aynı basamaktaki iki öneri katkıyı eşit bölüşür", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1 })],
      recommendations: [
        rec({ id: "a", questionId: "q1", triggerMaxAnswerScore: 1 }),
        rec({ id: "b", questionId: "q1", triggerMaxAnswerScore: 1 }),
      ],
      completedIds: new Set(["a"]),
    });
    const result = computeRecommendationContributions(data, ["a", "b"]);
    // Tek basamaklı merdiven: tamamlanınca tavana çıkar (1.8 → 5.0 = 3.2), yarısı 1.6.
    expect(result.get("a")).toMatchObject({ full: 1.6, current: 0, rung: { index: 1, total: 1 } });
    expect(result.get("b")).toMatchObject({ full: 1.6, current: 0 });
  });

  it("cevaplanmamış sorunun kademesi ve bilinmeyen öneri 0 katkı verir", () => {
    const data = inputs({
      responses: [],
      recommendations: ladder(),
    });
    const result = computeRecommendationContributions(data, ["r1", "yok"]);
    expect(result.get("r1")).toMatchObject({ kind: "cascade", full: 0, current: 0, rung: null });
    expect(result.get("yok")).toMatchObject({ full: 0, current: 0 });
  });

  it("baseline'ın altındaki basamak gösterilmez ve katkısı yoktur", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 2 })],
      recommendations: ladder(),
    });
    const result = computeRecommendationContributions(data, ["r1", "r2", "r3"]);
    expect(result.get("r1")!.rung).toBeNull();
    expect(result.get("r1")!.full).toBe(0);
    // Kalan merdiven iki basamak: 2 → 3 → tavan.
    expect(result.get("r2")!.rung).toEqual({ index: 1, total: 2 });
    expect(result.get("r3")!.rung).toEqual({ index: 2, total: 2 });
  });

  it("tavana dayanmış eksende katkı 0 görünür (kural 7)", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 5 })],
      recommendations: [rec({ id: "p1", points: 1 })],
    });
    expect(computeRecommendationContributions(data, ["p1"]).get("p1")!.full).toBe(0);
  });
});

describe("computeProgressBreakdown — kategori kırılımı", () => {
  const tree = [
    { id: "catA", name: "A", subCategories: [{ id: "subA", name: "A1" }] },
    { id: "catB", name: "B", subCategories: [{ id: "subB", name: "B1" }] },
  ];

  it("kademeli yükselme sorunun kategorisine, puan önerinin kategorisine düşer", () => {
    const data = inputs({
      responses: [
        response({ questionId: "q1", score: 1, categoryId: "catA", subCategoryId: "subA" }),
        response({ questionId: "q2", score: 1, categoryId: "catB", subCategoryId: "subB" }),
      ],
      recommendations: [
        ...ladder(),
        rec({ id: "p1", points: 0.5, categoryId: "catB", subCategoryId: "subB" }),
      ],
      completedIds: new Set(["r1", "p1"]),
    });
    const [a, b] = computeProgressBreakdown(data, tree);

    expect(a).toMatchObject({ baseScore: 1.8, totalScore: 2.6, bonusPoints: 0.8, completedCount: 1, responseCount: 1 });
    expect(a.subCategories[0]).toMatchObject({ id: "subA", bonusPoints: 0.8 });
    // 0.2 + 0.5 = 0.7 → 3.8
    expect(b).toMatchObject({ baseScore: 1.8, totalScore: 3.8, bonusPoints: 2, completedCount: 1 });
  });

  it("kategorisi olmayan ama soruya bağlı öneri sorunun kategorisine düşer", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 1, categoryId: "catA", subCategoryId: "subA" })],
      recommendations: [rec({ id: "p1", questionId: "q1", points: 0.5 })],
      completedIds: new Set(["p1"]),
    });
    const [a, b] = computeProgressBreakdown(data, tree);
    expect(a.completedCount).toBe(1);
    expect(a.bonusPoints).toBe(2);
    expect(b.completedCount).toBe(0);
  });

  it("cevabı olmayan kategori 0 kalır, 5'i aşmaz", () => {
    const data = inputs({
      responses: [response({ questionId: "q1", score: 5, categoryId: "catA", subCategoryId: "subA" })],
      recommendations: [rec({ id: "p1", points: 2, categoryId: "catA", subCategoryId: "subA" })],
      completedIds: new Set(["p1"]),
    });
    const [a, b] = computeProgressBreakdown(data, tree);
    expect(a).toMatchObject({ baseScore: 5, totalScore: 5, bonusPoints: 0 });
    expect(b).toMatchObject({ baseScore: 0, totalScore: 0, bonusPoints: 0, responseCount: 0 });
  });
});

describe("toProgressRecommendationInput", () => {
  it("kategoriyi öneri → alt kategori → alt seviye sırasıyla çözer", () => {
    expect(
      toProgressRecommendationInput(
        {
          id: "r",
          points: 0.5,
          subLevel: { axisType: "ENDURANCE", subCategoryId: "s", subCategory: { categoryId: "c" } },
        },
        "yedek"
      )
    ).toEqual({
      id: "r",
      questionId: null,
      triggerMaxAnswerScore: null,
      points: 0.5,
      axisType: "ENDURANCE",
      categoryId: "c",
      subCategoryId: "s",
    });
  });

  it("kimliği olmayan satıra yedek kimlik verir", () => {
    expect(toProgressRecommendationInput({}, "yedek").id).toBe("yedek");
  });
});

describe("loadProgressInputs — yükleyici", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueUser.mockResolvedValue({ role: "USER", sectorId: null, subSectorId: null });
    findManyScopeRule.mockResolvedValue([]);
    findManyAssessment.mockResolvedValue([{ id: "assessment-1" }]);
    findManyAssignment.mockResolvedValue([{ surveyId: "survey-1" }]);
    findManySurvey.mockResolvedValue([{ id: "survey-1" }]);
    findManyCategory.mockResolvedValue([{ id: "cat-1" }]);
    findManyQuestion.mockResolvedValue([{ subCategoryId: null, subLevel: null }]);
    findManyRecommendation.mockResolvedValue([]);
  });

  it("yalnızca COMPLETED kalemleri tamamlanmış sayar; ek öneriler hesaba girer ama tamamlanmış sayılmaz", async () => {
    findManySurveyResponse.mockResolvedValue([
      {
        score: 1,
        question: {
          id: "q1", weight: 1, axisType: "VELOCITY", type: "SCALE",
          categoryId: null, subCategoryId: null,
          subLevel: { subCategoryId: "sub-1", subCategory: { categoryId: "cat-1" } },
        },
      },
    ]);
    findManyRoadmapItem.mockResolvedValue([
      { recommendationId: "done", recommendation: { id: "done", points: 0.5, subLevel: { axisType: "VELOCITY" } } },
    ]);

    const loaded = await loadProgressInputs("user-1", {
      extraRecommendations: [{ id: "open", points: 0.5 }],
    });

    expect(findManyRoadmapItem).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "COMPLETED" }) })
    );
    expect([...loaded.completedIds]).toEqual(["done"]);
    expect(loaded.completedCount).toBe(1);
    expect(loaded.recommendations.map((r) => r.id).sort()).toEqual(["done", "open"]);
    expect(loaded.responses[0]).toMatchObject({
      questionId: "q1", categoryId: "cat-1", subCategoryId: "sub-1", maxScore: 5, applicable: true,
    });
    expect(loaded.totalQuestions).toBe(1);
  });

  it("calculateRecommendationContributions yol haritası kalemleri için katkı ve özet döner", async () => {
    findManySurveyResponse.mockResolvedValue([
      { score: 1, question: { id: "q1", weight: 1, axisType: "VELOCITY", type: "SCALE" } },
    ]);
    findManyRoadmapItem.mockResolvedValue([]);
    findManyRecommendation.mockResolvedValue([
      { id: "r1", questionId: "q1", triggerMaxAnswerScore: 1 },
      { id: "r2", questionId: "q1", triggerMaxAnswerScore: 2 },
    ]);

    const { scores, contributions } = await calculateRecommendationContributions("user-1", [
      { id: "r1", questionId: "q1", triggerMaxAnswerScore: 1, points: 0 },
      { id: "p1", points: 0.5 },
    ]);

    expect(scores.delta).toBe(0);
    expect(contributions.get("r1")).toMatchObject({ kind: "cascade", full: 0.8, current: 0, rung: { index: 1, total: 2 } });
    expect(contributions.get("p1")).toMatchObject({ kind: "points", full: 2, current: 0 });
  });
});
