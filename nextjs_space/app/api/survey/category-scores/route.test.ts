import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ canRead: vi.fn(), progress: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "USER" } }) }));
vi.mock("@/lib/survey-management", () => ({ canReadSurveyTemplate: mocks.canRead }));
vi.mock("@/lib/db", () => ({ prisma: { category: { findMany: async () => [{
  id: "cat-e", name: "Çevre", description: null, surveyId: "s1", survey: { name: "Anket" },
  subCategories: [
    { id: "sec-1", name: "Enerji", subLevels: [{ id: "l1", name: "Temel" }, { id: "l2", name: "İleri" }] },
    { id: "sec-x", name: "Kapsam dışı", subLevels: [] },
  ],
}] } } }));
vi.mock("@/lib/scoring", async original => ({
  ...(await original<typeof import("@/lib/scoring")>()),
  getAccessibleSurveyIds: async () => ["s1"], getScopeResolver: async () => () => ({ applicable: true, weight: 1 }),
  calculateProgressBreakdown: mocks.progress,
}));
import { GET } from "./route";

const node = (id: string, totalScore: number, responseCount: number, questionCount: number) =>
  ({ id, name: id, baseScore: totalScore, totalScore, bonusPoints: 0, completedCount: 0, responseCount, questionCount });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canRead.mockResolvedValue(true);
  mocks.progress.mockResolvedValue({
    scores: { overallScore: 3.6, overallPercentage: 66, baselineOverallPercentage: 58 },
    categories: [{ ...node("cat-e", 3.5, 3, 4), subCategories: [
      { ...node("sec-1", 3.5, 3, 4), subLevels: [node("l1", 4.2, 3, 3), node("l2", 0, 0, 1)] },
      { ...node("sec-x", 0, 0, 0), subLevels: [] },
    ] }],
  });
});

describe("kategori analizi puanları", () => {
  it("kategori, bölüm ve basamağı motordan; kapsamdaki soru sayısıyla verir", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/survey/category-scores?surveyId=s1"))).json();
    expect(body).toMatchObject({ overallScore: 3.6, overallPercentage: 66, baselinePercentage: 58 });
    const [category] = body.categories;
    expect(category).toMatchObject({ score: 3.5, percentage: 63, questionCount: 4, answeredCount: 3 });
    expect(category.subCategories.map((row: { id: string }) => row.id)).toEqual(["sec-1"]);
    // Cevapsız basamak ölçeğin tabanında: 1,0 · %0.
    expect(category.subCategories[0].subLevels).toEqual([
      { id: "l1", name: "Temel", score: 4.2, percentage: 80, questionCount: 3, answeredCount: 3 },
      { id: "l2", name: "İleri", score: 1, percentage: 0, questionCount: 1, answeredCount: 0 },
    ]);
  });
  it("erişilemeyen anketin yapısını ve puanını vermez", async () => {
    mocks.canRead.mockResolvedValue(false);
    expect((await GET(new NextRequest("http://localhost/api/survey/category-scores?surveyId=other"))).status).toBe(403);
    expect(mocks.progress).not.toHaveBeenCalled();
  });
});
