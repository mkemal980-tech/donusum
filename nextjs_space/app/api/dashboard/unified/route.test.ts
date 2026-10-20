import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ old: vi.fn(), progress: vi.fn(), recs: vi.fn(), structure: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "USER" } }) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: async () => ({ id: "u1" }) }, surveyResponse: { findMany: async () => [{ questionId: "q1" }, { questionId: "q2" }] } } }));
vi.mock("@/lib/assessment", () => ({ getAssessmentContext: mocks.context, getAssessmentIds: async () => ["a1"] }));
vi.mock("@/lib/survey-structure", () => ({ loadVisibleSurveyStructure: mocks.structure, countStructureQuestions: () => [{ id: "cat-e", name: "Çevre", questionIds: ["q1", "q2", "q3"] }] }));
vi.mock("@/lib/scoring", async original => ({
  ...(await original<typeof import("@/lib/scoring")>()),
  calculateUserScore: mocks.old, calculateProgressBreakdown: mocks.progress, getRecommendationsForUser: mocks.recs,
}));
import { GET } from "./route";

const node = (id: string, name: string, totalScore: number, responseCount: number, questionCount: number) =>
  ({ id, name, baseScore: totalScore, totalScore, bonusPoints: 0, completedCount: 0, responseCount, questionCount });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.structure.mockResolvedValue([]);
  mocks.context.mockResolvedValue({ status: "SUBMITTED", submittedAt: null, locked: true, isCoordinator: true });
  mocks.old.mockResolvedValue({ totalScore: 58, totalScoreOn5: 3.3, categoryScores: { "cat-e": { name: "Çevre", scoreOn5: 3.3, percentage: 58 } }, subCategoryScores: {}, subLevelScores: {} });
  mocks.recs.mockResolvedValue([]);
  mocks.progress.mockResolvedValue({
    scores: { overallScore: 3.6, overallPercentage: 66, baselineOverallPercentage: 58, deltaPercentage: 8 },
    categories: [
      { ...node("cat-e", "Çevre", 3.5, 2, 3), subCategories: [{ ...node("sec-1", "Enerji", 3.5, 2, 3), subLevels: [] }] },
      { ...node("cat-x", "Kapsam dışı", 0, 0, 0), subCategories: [] },
    ],
  });
});

describe("kişisel pano puanı", () => {
  it("birim panosuyla aynı mevcut puanı ve taban ile öneri katkısını verir", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/dashboard/unified?surveyId=s1"))).json();
    expect(body.score).toMatchObject({ totalScore: 66, baselinePercentage: 58, deltaPercentage: 8 });
    expect(body.categoryScores.overallPercentage).toBe(66);
    // 3,5 / 5 → (3,5 − 1) / 4 = %62,5 → %63; kapsam dışı kategori listelenmez.
    expect(body.categoryScores.categories).toEqual([{ id: "cat-e", name: "Çevre", score: 3.5, percentage: 63 }]);
    // Eski hesap yalnızca öneri görünürlüğü için kullanılır.
    expect(mocks.recs).toHaveBeenCalledWith("u1", expect.objectContaining({ scores: expect.objectContaining({ totalScore: 58 }) }));
  });
  it("erişilemeyen ankette puan hesaplamaz", async () => {
    mocks.structure.mockResolvedValue(null);
    expect((await GET(new NextRequest("http://localhost/api/dashboard/unified?surveyId=other"))).status).toBe(403);
    expect(mocks.progress).not.toHaveBeenCalled();
  });
});
