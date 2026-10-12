import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateProgressScores, calculateUserScore, calculateRecommendationContributions, type DbClient } from "../scoring";

const question = (id: string) => ({
  id, weight: 1, type: "SCALE", options: null, conditionalOptions: null, axisType: "VELOCITY",
  categoryId: "cat-1", category: { id: "cat-1", name: "Kategori" }, subCategoryId: null, subCategory: null, subLevel: null,
});
const db = {
  category: { findMany: vi.fn() }, surveyResponse: { findMany: vi.fn() }, roadmapItem: { findMany: vi.fn() },
  recommendation: { findMany: vi.fn() }, question: { findMany: vi.fn() }, user: { findUnique: vi.fn() },
  userSurveyAssignment: { findMany: vi.fn() }, sectorScopeRule: { findMany: vi.fn() },
  assessment: { findMany: vi.fn() },
};
const client = db as unknown as DbClient;
const assessment = { id: "unit-assessment", surveyId: "unit-survey", sectorId: null, subSectorId: null, questionIds: ["q1", "q2"] };

beforeEach(() => {
  vi.resetAllMocks();
  db.category.findMany.mockImplementation(async args => args.include
    ? [{ id: "cat-1", name: "Kategori", questions: [question("q1"), question("q2")], subCategories: [] }]
    : [{ id: "cat-1" }]);
  db.surveyResponse.findMany.mockResolvedValue([{ value: "2", score: 2, questionId: "q1", question: question("q1") }]);
  db.roadmapItem.findMany.mockResolvedValue([]);
  db.recommendation.findMany.mockResolvedValue([]);
  db.question.findMany.mockResolvedValue([question("q1"), question("q2")]);
  db.user.findUnique.mockResolvedValue({ role: "USER", unitId: null, sectorId: null, subSectorId: null });
  db.userSurveyAssignment.findMany.mockResolvedValue([{ surveyId: "unit-survey" }]);
  db.assessment.findMany.mockResolvedValue([{ id: "unit-assessment" }]);
});

describe("değerlendirme kimliğiyle ortak puanlama", () => {
  it("yöneticinin kişisel üyeliğine ve atamalarına başvurmadan seçili değerlendirmeyi hesaplar", async () => {
    const scores = await calculateUserScore("manager-with-no-unit", undefined, { assessment, db: client });
    expect(scores.totalScore).toBe(20);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.userSurveyAssignment.findMany).not.toHaveBeenCalled();
    expect(db.surveyResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assessmentId: { in: ["unit-assessment"] } }),
    }));
  });
  it("boş soruyu paydada tutar, tamamlanmış soru saymaz", async () => {
    const scores = await calculateProgressScores("manager", { assessment, db: client });
    expect(scores).toMatchObject({ totalQuestions: 2, completedQuestions: 1, overallScore: 1.8, overallPercentage: 20 });
  });
  it("anket seçilmemiş genel hesapta da yalnızca kullanıcının anketlerini paydaya alır", async () => {
    await calculateProgressScores("member", { db: client });
    expect(db.question.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ AND: expect.arrayContaining([
        expect.objectContaining({ OR: expect.arrayContaining([{ category: { surveyId: { in: ["unit-survey"] } } }]) }),
      ]) }),
    }));
  });
  it("boş değerlendirmeyi yüksek puanlı veya tamamlanmış göstermez", async () => {
    db.surveyResponse.findMany.mockResolvedValue([]);
    const scores = await calculateProgressScores("manager", { assessment, db: client });
    expect(scores).toMatchObject({ totalQuestions: 2, completedQuestions: 0, overallScore: 0 });
  });
  it("tamamlanan önerinin katkısını aynı soru paydasıyla hesaplar", async () => {
    db.roadmapItem.findMany.mockResolvedValue([{ recommendationId: "done", recommendation: { id: "done", points: 0.5, categoryId: "cat-1" } }]);
    const result = await calculateRecommendationContributions("manager", [{ id: "done", points: 0.5, categoryId: "cat-1" }], { assessment, db: client });
    expect(result.scores).toMatchObject({ baselineOverallScore: 1.8, overallScore: 2.8, delta: 1 });
    expect(result.contributions.get("done")).toMatchObject({ full: 1, current: 1 });
  });
  it("kapsam dışındaki bölüm sorusunu hem puandan hem soru sayısından çıkarır", async () => {
    const scoped = { ...assessment, sectorId: "sector-a" };
    db.sectorScopeRule.findMany.mockResolvedValue([{ sectorId: "sector-a", subSectorId: null, subCategoryId: "excluded", applicable: false, weight: 1 }]);
    db.question.findMany.mockResolvedValue([question("q1"), { ...question("q2"), categoryId: null, subCategoryId: "excluded", subCategory: { categoryId: "cat-1" } }]);
    const scores = await calculateProgressScores("manager", { assessment: scoped, db: client });
    expect(scores).toMatchObject({ totalQuestions: 1, completedQuestions: 1, overallScore: 2.6, overallPercentage: 40 });
  });
  it("kapsam dışı önerinin tamamlanması puan artışı üretmez", async () => {
    db.sectorScopeRule.findMany.mockResolvedValue([{ sectorId: "sector-a", subSectorId: null, subCategoryId: "excluded", applicable: false, weight: 1 }]);
    db.roadmapItem.findMany.mockResolvedValue([{ recommendationId: "excluded-rec", recommendation: { id: "excluded-rec", points: 2, subCategoryId: "excluded" } }]);
    const scores = await calculateProgressScores("manager", { assessment: { ...assessment, sectorId: "sector-a" }, db: client });
    expect(scores.delta).toBe(0);
    expect(scores.completedRecommendations).toBe(0);
  });
});
