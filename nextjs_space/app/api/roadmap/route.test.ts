import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * /api/roadmap — katkı ve özet sunucudan gelir; durum güncellemesi ortak
 * servisten geçer (docs/GELISIM-PUANI.md).
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    roadmapItem: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  withAuth: vi.fn(),
  calculateRecommendationContributions: vi.fn(),
  getAccessibleSurveyIds: vi.fn(),
  isRecommendationActionable: vi.fn(),
  getAssessmentIds: vi.fn(),
  resolveAssessmentForRecommendation: vi.fn(),
  updateRoadmapStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/scoring", () => ({
  calculateRecommendationContributions: mocks.calculateRecommendationContributions,
  getAccessibleSurveyIds: mocks.getAccessibleSurveyIds,
  isRecommendationActionable: mocks.isRecommendationActionable,
}));
vi.mock("@/lib/assessment", () => ({ getAssessmentIds: mocks.getAssessmentIds }));
vi.mock("@/lib/roadmap-status", () => ({
  resolveAssessmentForRecommendation: mocks.resolveAssessmentForRecommendation,
  updateRoadmapStatus: mocks.updateRoadmapStatus,
}));

import { GET, PUT } from "./route";

const scores = {
  overallScore: 3.4,
  overallPercentage: 60,
  baselineOverallScore: 2.6,
  baselineOverallPercentage: 40,
  delta: 0.8,
  deltaPercentage: 20,
};

describe("GET /api/roadmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "user-1", user: { role: "USER" } });
    mocks.getAccessibleSurveyIds.mockResolvedValue(["survey-1"]);
    mocks.getAssessmentIds.mockResolvedValue(["assessment-1"]);
  });

  it("kalemlere katkıyı iliştirir ve özeti motordan döner", async () => {
    mocks.prisma.roadmapItem.findMany.mockResolvedValue([
      { id: "i1", recommendationId: "r1", status: "COMPLETED", recommendation: { id: "r1", title: "A" } },
      { id: "i2", recommendationId: "r2", status: "IN_PROGRESS", recommendation: { id: "r2", title: "B" } },
      { id: "i3", recommendationId: "r3", status: "NOT_STARTED", recommendation: { id: "r3", title: "C" } },
    ]);
    mocks.calculateRecommendationContributions.mockResolvedValue({
      scores,
      contributions: new Map([
        ["r1", { recommendationId: "r1", kind: "cascade", full: 0.8, current: 0.8, rung: { index: 1, total: 3 } }],
        ["r2", { recommendationId: "r2", kind: "cascade", full: 0.8, current: 0, rung: { index: 2, total: 3 } }],
      ]),
    });

    const body = await (await GET(new NextRequest("http://localhost/api/roadmap"))).json();

    expect(body.summary).toEqual({
      total: 3,
      completed: 1,
      inProgress: 1,
      baselineScore: 2.6,
      baselinePercentage: 40,
      currentScore: 3.4,
      currentPercentage: 60,
      delta: 0.8,
      deltaPercentage: 20,
    });
    expect(body.items[0].contribution).toMatchObject({ kind: "cascade", current: 0.8, rung: { index: 1, total: 3 } });
    // Devam eden öneri katkı yapmaz (kural 1).
    expect(body.items[1].contribution.current).toBe(0);
    // Motorun tanımadığı kalem sıfır katkıyla döner, eksik alan yok.
    expect(body.items[2].contribution).toEqual({ recommendationId: "r3", kind: "points", full: 0, current: 0, rung: null });
    // Motor, kalemlerin önerilerini ek girdi olarak alır.
    expect(mocks.calculateRecommendationContributions).toHaveBeenCalledWith(
      "user-1",
      [{ id: "r1", title: "A" }, { id: "r2", title: "B" }, { id: "r3", title: "C" }]
    );
  });
});

describe("PUT /api/roadmap", () => {
  const put = (body: unknown) =>
    PUT(new NextRequest("http://localhost/api/roadmap", { method: "PUT", body: JSON.stringify(body) }));

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "user-1", user: { role: "USER" } });
  });

  it("durum değişikliğini ortak servise verir ve güncel puanı döner", async () => {
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: true,
      result: {
        item: { id: "i1", status: "COMPLETED" },
        after: scores,
        earned: 0.8,
        isCompleted: true,
        wasCompleted: false,
      },
    });

    const response = await put({ recommendationId: "r1", status: "COMPLETED" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updateRoadmapStatus).toHaveBeenCalledWith("user-1", expect.objectContaining({
      recommendationId: "r1",
      status: "COMPLETED",
    }));
    expect(body).toMatchObject({ item: { status: "COMPLETED" }, progress: { delta: 0.8 }, earned: 0.8, pointsEarned: 0.8 });
  });

  it("servisin kilit hatasını 409 olarak geçirir", async () => {
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: false,
      error: { code: "LOCKED", message: "Bu öneriye sıra gelmedi.", httpStatus: 409 },
    });
    const response = await put({ recommendationId: "r1", status: "COMPLETED" });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/sıra gelmedi/);
  });

  it("durum verilmeden yalnızca zamanlama güncellenir; servis çağrılmaz", async () => {
    mocks.resolveAssessmentForRecommendation.mockResolvedValue({ assessmentId: "assessment-1", surveyId: "survey-1" });
    mocks.prisma.roadmapItem.update.mockResolvedValue({ id: "i1", plannedQuarter: 3, plannedYear: 2026 });

    const body = await (await put({ recommendationId: "r1", plannedQuarter: 3, plannedYear: 2026 })).json();

    expect(mocks.updateRoadmapStatus).not.toHaveBeenCalled();
    expect(mocks.prisma.roadmapItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plannedQuarter: 3, plannedYear: 2026 } })
    );
    expect(body.item.plannedQuarter).toBe(3);
  });

  it("öneri kimliği yoksa 400", async () => {
    expect((await put({ status: "COMPLETED" })).status).toBe(400);
  });
});
