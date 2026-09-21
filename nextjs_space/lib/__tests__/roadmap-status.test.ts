import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Yol haritası durum servisi — docs/GELISIM-PUANI.md kural 5-6.
 */

const mocks = vi.hoisted(() => {
  const tx = {
    roadmapItem: { findUnique: vi.fn(), upsert: vi.fn() },
    scoreHistory: { create: vi.fn() },
  };
  return {
    tx,
    prisma: {
      ...tx,
      recommendation: { findUnique: vi.fn() },
      category: { findUnique: vi.fn() },
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    },
    calculateProgressScores: vi.fn(),
    isRecommendationActionable: vi.fn(),
    getAccessibleSurveyIds: vi.fn(),
    getAssessmentIds: vi.fn(),
    getOrCreateAssessment: vi.fn(),
  };
});

vi.mock("../db", () => ({ prisma: mocks.prisma }));
vi.mock("../scoring", () => ({
  calculateProgressScores: mocks.calculateProgressScores,
  isRecommendationActionable: mocks.isRecommendationActionable,
  getAccessibleSurveyIds: mocks.getAccessibleSurveyIds,
}));
vi.mock("../assessment", () => ({
  getAssessmentIds: mocks.getAssessmentIds,
  getOrCreateAssessment: mocks.getOrCreateAssessment,
}));

import {
  ROADMAP_STATUSES,
  isForwardMove,
  isRoadmapStatus,
  surveyIdForRecommendation,
  updateRoadmapStatus,
} from "../roadmap-status";

const scores = (delta: number, overall = 3) => ({
  overallScore: overall,
  overallPercentage: 50,
  velocityScore: overall,
  enduranceScore: overall,
  quadrant: "IRONMAN",
  completedQuestions: 4,
  totalQuestions: 4,
  completedRecommendations: 1,
  velocityWeight: 2,
  enduranceWeight: 2,
  velocityBase: 2,
  enduranceBase: 2,
  velocityBonus: 0,
  enduranceBonus: 0,
  baselineOverallScore: 2,
  baselineOverallPercentage: 25,
  delta,
  deltaPercentage: delta * 25,
});

describe("durum kümesi", () => {
  it("enum'daki beş durumu tanır, başka hiçbir şeyi tanımaz", () => {
    expect(ROADMAP_STATUSES).toEqual(["NOT_STARTED", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
    expect(isRoadmapStatus("PLANNED")).toBe(true);
    expect(isRoadmapStatus("DONE")).toBe(false);
    expect(isRoadmapStatus(undefined)).toBe(false);
  });

  it("yalnızca ilerletme yönü kilide tabidir", () => {
    expect(isForwardMove("IN_PROGRESS")).toBe(true);
    expect(isForwardMove("COMPLETED")).toBe(true);
    expect(isForwardMove("NOT_STARTED")).toBe(false);
    expect(isForwardMove("CANCELLED")).toBe(false);
    expect(isForwardMove("PLANNED")).toBe(false);
  });
});

describe("surveyIdForRecommendation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soruya bağlı öneride anketi sorudan okur", async () => {
    mocks.prisma.recommendation.findUnique.mockResolvedValue({
      categoryId: null,
      question: { subLevel: { subCategory: { category: { surveyId: "s-q" } } } },
    });
    expect(await surveyIdForRecommendation("r")).toBe("s-q");
  });

  it("yalnızca kategoriye bağlı öneride kategoriden okur", async () => {
    mocks.prisma.recommendation.findUnique.mockResolvedValue({ categoryId: "cat", question: null });
    mocks.prisma.category.findUnique.mockResolvedValue({ surveyId: "s-cat" });
    expect(await surveyIdForRecommendation("r")).toBe("s-cat");
  });

  it("kapsamsız öneride null döner", async () => {
    mocks.prisma.recommendation.findUnique.mockResolvedValue({ categoryId: null, question: null });
    expect(await surveyIdForRecommendation("r")).toBeNull();
  });
});

describe("updateRoadmapStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRecommendationActionable.mockResolvedValue(true);
    mocks.prisma.recommendation.findUnique.mockResolvedValue({
      categoryId: null,
      question: { category: { surveyId: "survey-1" } },
    });
    mocks.getOrCreateAssessment.mockResolvedValue("assessment-1");
    mocks.getAssessmentIds.mockResolvedValue(["assessment-1"]);
    mocks.getAccessibleSurveyIds.mockResolvedValue(["survey-1"]);
    mocks.tx.roadmapItem.findUnique.mockResolvedValue({ status: "NOT_STARTED" });
    mocks.tx.roadmapItem.upsert.mockImplementation(async ({ update }: any) => ({
      id: "item-1",
      status: update.status,
      recommendation: { id: "rec-1" },
    }));
    mocks.tx.scoreHistory.create.mockResolvedValue({});
  });

  it("geçersiz durumu 400 ile reddeder, hiçbir şey yazmaz", async () => {
    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "DONE" });
    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_STATUS", httpStatus: 400 } });
    expect(mocks.tx.roadmapItem.upsert).not.toHaveBeenCalled();
  });

  it("sırası gelmemiş basamağı ilerletmeyi 409 ile reddeder", async () => {
    mocks.isRecommendationActionable.mockResolvedValue(false);
    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "COMPLETED" });
    expect(outcome).toMatchObject({ ok: false, error: { code: "LOCKED", httpStatus: 409 } });
    expect(mocks.tx.roadmapItem.upsert).not.toHaveBeenCalled();
  });

  it("kilitliyken bile başa alma serbesttir", async () => {
    mocks.isRecommendationActionable.mockResolvedValue(false);
    mocks.calculateProgressScores.mockResolvedValue(scores(0));
    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "NOT_STARTED" });
    expect(outcome.ok).toBe(true);
    expect(mocks.isRecommendationActionable).not.toHaveBeenCalled();
  });

  it("tamamlamada skor geçmişine kayıt düşer ve kazanılan fark döner", async () => {
    // Önce 0, sonra +0.8 fark.
    mocks.calculateProgressScores
      .mockResolvedValueOnce(scores(0))
      .mockResolvedValueOnce(scores(0.8, 3.8));

    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "COMPLETED" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.result).toMatchObject({
      surveyId: "survey-1",
      wasCompleted: false,
      isCompleted: true,
      earned: 0.8,
    });
    expect(mocks.tx.scoreHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assessmentId: "assessment-1",
          surveyId: "survey-1",
          triggerType: "RECOMMENDATION_COMPLETED",
          triggerEntityId: "rec-1",
          overallScore: 3.8,
        }),
      })
    );
    // upsert ve kayıt aynı transaction'da
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("tamamlamayı geri almak da trend grafiğine düşer", async () => {
    mocks.tx.roadmapItem.findUnique.mockResolvedValue({ status: "COMPLETED" });
    mocks.calculateProgressScores
      .mockResolvedValueOnce(scores(0.8, 3.8))
      .mockResolvedValueOnce(scores(0, 3));

    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "IN_PROGRESS" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.earned).toBe(-0.8);
    expect(mocks.tx.scoreHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ triggerType: "RECOMMENDATION_REVERTED" }) })
    );
  });

  it("tamamlanma değişmiyorsa kayıt düşmez ama güncel puan yine döner", async () => {
    mocks.calculateProgressScores.mockResolvedValue(scores(0));
    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "IN_PROGRESS" });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(mocks.tx.scoreHistory.create).not.toHaveBeenCalled();
    expect(outcome.result.after.delta).toBe(0);
    expect(outcome.result.earned).toBe(0);
  });

  it("zaten tamamlanmış öneri tekrar tamamlanınca ikinci kayıt düşmez", async () => {
    mocks.tx.roadmapItem.findUnique.mockResolvedValue({ status: "COMPLETED" });
    mocks.calculateProgressScores.mockResolvedValue(scores(0.8, 3.8));
    const outcome = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "COMPLETED" });
    expect(outcome.ok).toBe(true);
    expect(mocks.tx.scoreHistory.create).not.toHaveBeenCalled();
  });

  it("zamanlama alanları da aynı çağrıda yazılabilir", async () => {
    mocks.calculateProgressScores.mockResolvedValue(scores(0));
    await updateRoadmapStatus("user-1", {
      recommendationId: "rec-1",
      status: "PLANNED",
      plannedQuarter: 2,
      plannedYear: 2027,
    });
    expect(mocks.tx.roadmapItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { status: "PLANNED", plannedQuarter: 2, plannedYear: 2027 },
        create: expect.objectContaining({ status: "PLANNED", plannedQuarter: 2, plannedYear: 2027, priority: 0 }),
      })
    );
  });

  it("öneri hiçbir ankete bağlı değilse verilen anketi, o da yoksa erişilebilen ilkini kullanır", async () => {
    mocks.prisma.recommendation.findUnique.mockResolvedValue({ categoryId: null, question: null });
    mocks.calculateProgressScores.mockResolvedValue(scores(0));

    const withHint = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "PLANNED", surveyId: "hint" });
    expect(withHint.ok && withHint.result.surveyId).toBe("hint");

    const fallback = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "PLANNED" });
    expect(fallback.ok && fallback.result.surveyId).toBe("survey-1");

    mocks.getAccessibleSurveyIds.mockResolvedValue([]);
    const none = await updateRoadmapStatus("user-1", { recommendationId: "rec-1", status: "PLANNED" });
    expect(none).toMatchObject({ ok: false, error: { code: "NO_SURVEY", httpStatus: 400 } });
  });
});
