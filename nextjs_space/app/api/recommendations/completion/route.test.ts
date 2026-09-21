import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: { roadmapItem: { findMany: vi.fn() } },
  withAuth: vi.fn(),
  calculateProgressScores: vi.fn(),
  getAccessibleSurveyIds: vi.fn(),
  getAssessmentIds: vi.fn(),
  updateRoadmapStatus: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/scoring", () => ({
  calculateProgressScores: mocks.calculateProgressScores,
  getAccessibleSurveyIds: mocks.getAccessibleSurveyIds,
}));
vi.mock("@/lib/assessment", () => ({ getAssessmentIds: mocks.getAssessmentIds }));
vi.mock("@/lib/roadmap-status", () => ({ updateRoadmapStatus: mocks.updateRoadmapStatus }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/recommendations/completion", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/recommendations/completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "user-1", user: { role: "USER" } });
  });

  it("kazanılan puan ham `points` değil, tamamlamanın gerçek farkıdır", async () => {
    // Kademeli öneri: points 0 ama basamak yükselmesi +0.8 getirir.
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: true,
      result: {
        item: {
          id: "i1", assessmentId: "a1", recommendationId: "r1", status: "COMPLETED",
          updatedAt: new Date("2026-09-21T00:00:00Z"),
          recommendation: { id: "r1", points: 0 },
        },
        after: { overallScore: 3.4, overallPercentage: 60, delta: 0.8 },
        earned: 0.8,
        isCompleted: true,
        wasCompleted: false,
      },
    });

    const body = await (await post({ recommendationId: "r1", status: "COMPLETED", notes: "not" })).json();

    expect(body.pointsEarned).toBe(0.8);
    expect(body.earned).toBe(0.8);
    expect(body.updatedScores.overallScore).toBe(3.4);
    expect(body.completion).toMatchObject({ status: "COMPLETED", notes: "not", recommendationId: "r1" });
    expect(body.completion.completedAt).toBeTruthy();
  });

  it("zaten tamamlanmış öneride pointsEarned 0'dır", async () => {
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: true,
      result: {
        item: { id: "i1", status: "COMPLETED", updatedAt: new Date(), recommendation: {} },
        after: { delta: 0.8 },
        earned: 0,
        isCompleted: true,
        wasCompleted: true,
      },
    });
    const body = await (await post({ recommendationId: "r1", status: "COMPLETED" })).json();
    expect(body.pointsEarned).toBe(0);
  });

  it("durum verilmezse başa alır", async () => {
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: true,
      result: { item: { status: "NOT_STARTED", recommendation: {} }, after: {}, earned: 0, isCompleted: false, wasCompleted: false },
    });
    await post({ recommendationId: "r1" });
    expect(mocks.updateRoadmapStatus).toHaveBeenCalledWith("user-1", expect.objectContaining({ status: "NOT_STARTED" }));
  });

  it("servis hatalarını kendi durum koduyla geçirir", async () => {
    mocks.updateRoadmapStatus.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_STATUS", message: "Geçersiz durum değeri.", httpStatus: 400 },
    });
    const response = await post({ recommendationId: "r1", status: "DONE" });
    expect(response.status).toBe(400);
  });

  it("öneri kimliği yoksa 400", async () => {
    expect((await post({ status: "COMPLETED" })).status).toBe(400);
    expect(mocks.updateRoadmapStatus).not.toHaveBeenCalled();
  });
});
