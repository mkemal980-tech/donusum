import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { ExistingRoadmapPlan, RoadmapCandidate } from "@/lib/roadmap-planner";

const mocks = vi.hoisted(() => ({
  withAuth: vi.fn(), isLLMConfigured: vi.fn(), callLLMForJSON: vi.fn(),
  getAccessibleSurveyIds: vi.fn(), getAssessmentIds: vi.fn(), getRecommendationsForUser: vi.fn(), getScopeResolver: vi.fn(),
  prisma: {
    roadmapItem: { findMany: vi.fn() }, assessment: { findMany: vi.fn() },
    subCategory: { findMany: vi.fn() }, $transaction: vi.fn(),
  },
  upsert: vi.fn(),
}));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/assessment", () => ({ getAssessmentIds: mocks.getAssessmentIds }));
vi.mock("@/lib/scoring", () => ({
  getAccessibleSurveyIds: mocks.getAccessibleSurveyIds,
  getRecommendationsForUser: mocks.getRecommendationsForUser, getScopeResolver: mocks.getScopeResolver,
}));
vi.mock("@/lib/llm", () => ({ isLLMConfigured: mocks.isLLMConfigured, callLLMForJSON: mocks.callLLMForJSON }));
import { POST } from "./route";

type StoredItem = ExistingRoadmapPlan & { priority: number };
let rows: StoredItem[];
const candidate = (id: string, subCategoryId = "sub-a", extra: Partial<RoadmapCandidate> = {}): RoadmapCandidate => ({
  id, title: id, description: "Açıklama", timeframe: "SHORT_TERM", strategicType: "QUICK_WIN",
  estimatedImpact: 8, costType: "OPEX", order: 0, isActionable: true, stepDistance: 0,
  resolvedSubCategoryId: subCategoryId, ...extra,
});
const candidates = [candidate("a1"), candidate("a2"), candidate("a3"), candidate("a4"), candidate("b1", "sub-b"), candidate("b2", "sub-b")];
const post = () => POST(new NextRequest("http://localhost/api/roadmap/generate", { method: "POST" }));

beforeEach(() => {
  vi.resetAllMocks();
  rows = [];
  mocks.withAuth.mockResolvedValue({ success: true, userId: "user-1", user: { role: "USER" } });
  mocks.isLLMConfigured.mockReturnValue(true);
  mocks.getAccessibleSurveyIds.mockResolvedValue(["survey-1"]);
  mocks.getAssessmentIds.mockResolvedValue(["assessment-1"]);
  mocks.getScopeResolver.mockResolvedValue(() => ({ applicable: true }));
  mocks.getRecommendationsForUser.mockResolvedValue(candidates);
  mocks.prisma.roadmapItem.findMany.mockImplementation(async () => rows);
  mocks.prisma.assessment.findMany.mockResolvedValue([{ id: "assessment-1", surveyId: "survey-1" }]);
  mocks.prisma.subCategory.findMany.mockResolvedValue(["sub-a", "sub-b"].map((id) => ({
    id, name: id, category: { name: "Çevre", surveyId: "survey-1" },
  })));
  mocks.callLLMForJSON.mockImplementation(async (prompt: string) => ({
    groups: JSON.parse(prompt).groups.map((group: { subCategoryId: string; candidates: { recommendationId: string }[] }) => ({
      subCategoryId: group.subCategoryId,
      items: group.candidates.slice(0, 3).map((item) => ({
        recommendationId: item.recommendationId, quarterOffset: 0, reason: "Yüksek etki ve kısa vade.",
      })),
    })),
  }));
  mocks.prisma.$transaction.mockImplementation(async (callback) => {
    const working = rows.map((item) => ({ ...item }));
    mocks.upsert.mockImplementation(async ({ create, update }) => {
      const existing = working.find((item) => item.recommendationId === create.recommendationId && item.assessmentId === create.assessmentId);
      if (existing) Object.assign(existing, update);
      else working.push({ status: "NOT_STARTED", ...create });
    });
    const result = await callback({ roadmapItem: { findMany: async () => working, upsert: mocks.upsert } });
    rows = working;
    return result;
  });
});

describe("POST /api/roadmap/generate", () => {
  it("her alt kategoriden en fazla üç öneriyi tek işlemde ekler", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ categoryCount: 2, selectedCount: 5, addedCount: 5 });
    expect(rows).toHaveLength(5);
    expect(rows.every((item) => item.plannedQuarter && item.plannedYear && item.status === "NOT_STARTED")).toBe(true);
    expect(mocks.withAuth).toHaveBeenCalledWith(expect.anything(), { rateLimit: "ai" });
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable", timeout: 15_000 });
  });

  it("yeniden oluşturulunca mükerrer kayıt üretmez ve mevcut tarihleri korur", async () => {
    await post();
    rows[0].plannedQuarter = 3;
    rows[0].plannedYear = 2030;
    const result = await (await post()).json();
    expect(result).toMatchObject({ addedCount: 0, scheduledCount: 0, preservedCount: 5 });
    expect(rows).toHaveLength(5);
    expect(result.selections.find((item: { recommendationId: string }) => item.recommendationId === "a1")).toMatchObject({ plannedQuarter: 3, plannedYear: 2030 });
  });

  it("tarihsiz devam eden işi tarihlendirir, durumunu değiştirmez", async () => {
    rows = [{ recommendationId: "a1", assessmentId: "assessment-1", status: "IN_PROGRESS", priority: 0, plannedQuarter: null, plannedYear: null }];
    expect(await (await post()).json()).toMatchObject({ scheduledCount: 1, addedCount: 4 });
    expect(rows.find((item) => item.recommendationId === "a1")?.status).toBe("IN_PROGRESS");
  });

  it("kilitli ve tamamlanan önerilerin yerine kalan adayları seçer", async () => {
    rows = [{ recommendationId: "a1", assessmentId: "assessment-1", status: "COMPLETED", priority: 0, plannedQuarter: null, plannedYear: null }];
    mocks.getRecommendationsForUser.mockResolvedValue(candidates.map((item) => item.id === "a2" ? { ...item, isActionable: false, stepDistance: 1 } : item));
    const result = await (await post()).json();
    expect(result.selectedCount).toBe(4);
    expect(result.selections.map((item: { recommendationId: string }) => item.recommendationId)).not.toContain("a1");
    expect(result.selections.map((item: { recommendationId: string }) => item.recommendationId)).not.toContain("a2");
  });

  it("sektör kapsamı dışındaki alt kategoriyi modele göndermez", async () => {
    mocks.getScopeResolver.mockResolvedValue((id: string) => ({ applicable: id !== "sub-b" }));
    expect(await (await post()).json()).toMatchObject({ categoryCount: 1, selectedCount: 3 });
    expect(JSON.parse(mocks.callLLMForJSON.mock.calls[0][0]).groups.map((group: { subCategoryId: string }) => group.subCategoryId)).toEqual(["sub-a"]);
  });

  it("birden fazla ankette öneriyi kendi değerlendirmesine kaydeder", async () => {
    mocks.getAccessibleSurveyIds.mockResolvedValue(["survey-1", "survey-2"]);
    mocks.getAssessmentIds.mockResolvedValue(["assessment-1", "assessment-2"]);
    mocks.prisma.assessment.findMany.mockResolvedValue([
      { id: "assessment-1", surveyId: "survey-1" }, { id: "assessment-2", surveyId: "survey-2" },
    ]);
    mocks.prisma.subCategory.findMany.mockResolvedValue([
      { id: "sub-a", name: "Enerji", category: { name: "Çevre", surveyId: "survey-1" } },
      { id: "sub-b", name: "Enerji", category: { name: "Çevre", surveyId: "survey-2" } },
    ]);
    expect((await post()).status).toBe(200);
    expect(rows.filter((item) => item.recommendationId.startsWith("a")).every((item) => item.assessmentId === "assessment-1")).toBe(true);
    expect(rows.filter((item) => item.recommendationId.startsWith("b")).every((item) => item.assessmentId === "assessment-2")).toBe(true);
  });

  it("birden fazla AI grubunda tek bir yanıt geçersizse hiçbir grubu kaydetmez", async () => {
    mocks.getRecommendationsForUser.mockResolvedValue(Array.from({ length: 5 }, (_, index) => candidate(`rec-${index}`, `sub-${index}`)));
    mocks.prisma.subCategory.findMany.mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
      id: `sub-${index}`, name: `Alt kategori ${index}`, category: { name: "Çevre", surveyId: "survey-1" },
    })));
    const generate = mocks.callLLMForJSON.getMockImplementation()!;
    mocks.callLLMForJSON.mockImplementationOnce(generate).mockResolvedValueOnce({ groups: [] });
    expect((await post()).status).toBe(502);
    expect(mocks.callLLMForJSON).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("AI aday listesi dışında kimlik döndürürse hiçbir şey kaydetmez", async () => {
    mocks.callLLMForJSON.mockResolvedValue({ groups: [
      { subCategoryId: "sub-a", items: ["a1", "a2", "foreign"].map((id) => ({ recommendationId: id, quarterOffset: 0, reason: "Etki" })) },
      { subCategoryId: "sub-b", items: ["b1", "b2"].map((id) => ({ recommendationId: id, quarterOffset: 0, reason: "Etki" })) },
    ] });
    expect((await post()).status).toBe(502);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it("AI isteği başarısız olursa plan yazılmaz", async () => {
    mocks.callLLMForJSON.mockRejectedValue(new Error("Provider timeout"));
    expect((await post()).status).toBe(502);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("AI beklenirken kademe veya erişim değişirse planı reddeder", async () => {
    mocks.getRecommendationsForUser.mockResolvedValueOnce(candidates).mockResolvedValue([]);
    expect((await post()).status).toBe(409);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("yazma hatasını başarı yanıtına dönüştürmez", async () => {
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) => {
      let count = 0;
      return callback({ roadmapItem: { findMany: async () => [], upsert: async () => {
        if (++count === 2) throw new Error("Write failure");
      } } });
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post()).status).toBe(500);
    expect(rows).toHaveLength(0);
    spy.mockRestore();
  });

  it("oturumsuz isteği AI çağrılmadan reddeder", async () => {
    mocks.withAuth.mockResolvedValue({ success: false, response: NextResponse.json({ error: "Oturum gerekli" }, { status: 401 }) });
    expect((await post()).status).toBe(401);
    expect(mocks.callLLMForJSON).not.toHaveBeenCalled();
  });

  it("AI yapılandırılmamışsa anlaşılır hata döner", async () => {
    mocks.isLLMConfigured.mockReturnValue(false);
    expect((await post()).status).toBe(503);
    expect(mocks.getRecommendationsForUser).not.toHaveBeenCalled();
  });

  it("aday yoksa AI çağırmaz", async () => {
    mocks.getRecommendationsForUser.mockResolvedValue([]);
    expect((await post()).status).toBe(400);
    expect(mocks.callLLMForJSON).not.toHaveBeenCalled();
  });
});
