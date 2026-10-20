import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ profile: vi.fn(), progress: vi.fn(), ironman: vi.fn() }));
vi.mock("@/lib/api-utils", () => ({ withAuth: async () => ({ success: true, userId: "u1", user: { role: "USER" } }) }));
vi.mock("@/lib/assessment", () => ({ getAssessmentIds: async () => ["a1"] }));
vi.mock("@/lib/db", () => ({ prisma: {
  user: { findUnique: async () => ({ firstName: "Ayşe", lastName: null, organization: "B" }) },
  surveyResponse: { findMany: async () => [{ updatedAt: new Date() }] },
  ironmanBenchmark: { findFirst: mocks.ironman },
} }));
vi.mock("@/lib/scoring", () => ({
  buildSurveyQuestionWhere: () => ({}), getAccessibleSurveyIds: async () => ["s1"], getRecommendationsForUser: async () => [{ strategicType: "QUICK_WIN" }],
  getScoringProfile: mocks.profile, calculateProgressBreakdown: mocks.progress,
}));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile.mockResolvedValue({ sectorId: "unit-sector", subSectorId: null, sector: { name: "Gıda" }, subSector: null });
  mocks.ironman.mockResolvedValue({ velocityAverage: 3, enduranceAverage: 2.5 });
  mocks.progress.mockResolvedValue({
    scores: { velocityScore: 3.24, enduranceScore: 2.96, quadrant: "SPRINTER", totalQuestions: 10, completedQuestions: 7, overallScore: 3.1, overallPercentage: 53 },
    categories: [
      { id: "cat-e", name: "Çevre", questionCount: 6, responseCount: 6 },
      { id: "cat-s", name: "Sosyal", questionCount: 4, responseCount: 1 },
      { id: "cat-x", name: "Kapsam dışı", questionCount: 0, responseCount: 0 },
    ],
  });
});

describe("dönüşüm dinamiği", () => {
  it("hız ve dayanıklılığı motordan, kadran adını Türkçe verir", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/dashboard/kpi?surveyId=s1"))).json();
    expect(body.ironman).toMatchObject({ velocity: 3.2, endurance: 3, quadrant: "SPRINTER", quadrantInfo: { title: "Sprinter" }, velocityVsSector: 0.2, enduranceVsSector: 0.5 });
    expect(mocks.ironman).toHaveBeenCalledWith({ where: { sectorId: "unit-sector", subSectorId: null } });
  });
  it("soru ve kategori ilerlemesini kapsamdaki sorulardan sayar", async () => {
    const body = await (await GET(new NextRequest("http://localhost/api/dashboard/kpi?surveyId=s1"))).json();
    expect(body.overview).toMatchObject({ totalQuestions: 10, answeredQuestions: 7, completionPercentage: 70, overallPercentage: 53 });
    expect(body.categories).toMatchObject({ total: 2, completed: 1 });
    expect(body.categories.stats.map((row: { percentage: number }) => row.percentage)).toEqual([100, 25]);
    expect(body.user.sector).toBe("Gıda");
  });
});
