import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  prisma: {
    assessment: { findMany: vi.fn() }, unit: { findMany: vi.fn() }, category: { findMany: vi.fn() },
    userSurveyAssignment: { findMany: vi.fn() }, campaignRecipient: { findMany: vi.fn() }, unitAdmin: { findMany: vi.fn() },
  },
  getManagedUnitIds: vi.fn(), withAuth: vi.fn(), calculateProgressScores: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/assessment", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/assessment")>(), getManagedUnitIds: mocks.getManagedUnitIds }));
vi.mock("@/lib/scoring", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/scoring")>(),
  getScopeResolverForProfile: vi.fn(async () => () => ({ applicable: true, weight: 1 })),
  calculateProgressScores: mocks.calculateProgressScores,
}));
import { GET } from "./route";

const request = () => new NextRequest("http://localhost/api/unit-manager/team");
const record = (id = "a1", surveyId = "s1") => ({
  id, unitId: "unit-1", surveyId, status: "IN_PROGRESS", createdAt: new Date("2026-01-01"), submittedAt: null, campaignRecipientId: null,
  unit: { id: "unit-1", name: "Birim", sectorId: null, subSectorId: null },
  survey: { id: surveyId, name: "Anket", isActive: true, isDemo: false, archivedAt: null }, campaignRecipient: null,
});

describe("GET /api/unit-manager/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withAuth.mockResolvedValue({ success: true, userId: "mgr-1", user: { role: "UNIT_MANAGER", unitId: null } });
    mocks.getManagedUnitIds.mockResolvedValue(["unit-1"]);
    mocks.prisma.assessment.findMany.mockResolvedValue([]);
    mocks.prisma.userSurveyAssignment.findMany.mockResolvedValue([]);
    mocks.prisma.campaignRecipient.findMany.mockResolvedValue([]);
    mocks.prisma.unitAdmin.findMany.mockResolvedValue([{ unitId: "unit-1" }]);
    mocks.prisma.unit.findMany.mockResolvedValue([{ id: "unit-1", name: "Gerçek Ad", description: null, parentId: null }]);
    mocks.prisma.category.findMany.mockResolvedValue([{ id: "cat-1", name: "Kategori", questions: [{ id: "q1" }, { id: "q2" }], subCategories: [] }]);
    mocks.calculateProgressScores.mockResolvedValue({ completedQuestions: 1, totalQuestions: 2, overallScore: 3.4, overallPercentage: 60 });
  });

  it("değerlendirmesi olmayan birimi de listeler", async () => {
    const body = await (await GET(request())).json();
    expect(body.units[0]).toMatchObject({ id: "unit-1", name: "Gerçek Ad", assessmentCount: 0 });
  });

  it("birim adını Unit kaydından okur", async () => {
    mocks.prisma.assessment.findMany.mockResolvedValue([record()]);
    const body = await (await GET(request())).json();
    expect(body.units[0].name).toBe("Gerçek Ad");
  });

  it("puanı ortak motordan ve tamamlanmayı soru kapsamından alır", async () => {
    mocks.prisma.assessment.findMany.mockResolvedValue([record()]);
    const body = await (await GET(request())).json();
    expect(body.assessments[0]).toMatchObject({ score: 60, maturityScore: 3.4, responseCount: 1, totalQuestions: 2, completionPercentage: 50, status: "IN_PROGRESS" });
    expect(mocks.calculateProgressScores).toHaveBeenCalledWith("mgr-1", expect.objectContaining({
      assessment: expect.objectContaining({ id: "a1", surveyId: "s1", questionIds: ["q1", "q2"] }),
    }));
  });

  it("hiç birim yönetmeyen kullanıcıya boş liste döner", async () => {
    mocks.getManagedUnitIds.mockResolvedValue([]);
    mocks.prisma.unit.findMany.mockResolvedValue([]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).units).toEqual([]);
    expect(mocks.prisma.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: { in: [] } }),
    }));
  });

  it("üyelik veya kişisel anket aramadan yönetilen birimler ve alt birimlere bakar", async () => {
    mocks.withAuth.mockResolvedValue({ success: true, userId: "mgr-1", user: { role: "UNIT_MANAGER", unitId: "unrelated-unit" } });
    mocks.getManagedUnitIds.mockResolvedValue(["managed-unit", "child-unit"]);
    await GET(request());
    expect(mocks.prisma.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: { in: ["managed-unit", "child-unit"] } }),
    }));
  });

  it("platform yöneticisi için bütün birimleri listeler", async () => {
    mocks.withAuth.mockResolvedValue({ success: true, userId: "admin-1", user: { role: "ADMIN" } });
    await GET(request());
    expect(mocks.prisma.unit.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    expect(mocks.prisma.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ unitId: { not: null } }),
    }));
  });

  it("atanmış ama başlanmamış anketi gösterir; okuma sırasında kayıt açmaz", async () => {
    mocks.prisma.userSurveyAssignment.findMany.mockResolvedValue([{
      surveyId: "s1", assignedAt: new Date("2026-01-01"), deadline: null, hasDeadline: false,
      user: { unitId: "unit-1" }, survey: { name: "Birim anketi" },
    }]);
    const body = await (await GET(request())).json();
    expect(body.assessments[0]).toMatchObject({ assessmentId: null, surveyId: "s1", status: "NOT_STARTED", score: null });
  });

  it("üst birim anonim kampanyanın tekil sonucunu göremez", async () => {
    mocks.prisma.unitAdmin.findMany.mockResolvedValue([{ unitId: "root" }]);
    mocks.prisma.assessment.findMany.mockResolvedValue([{ ...record(), campaignRecipient: {
      campaign: { id: "c1", privacyMode: "ANONYMOUS", name: "Dönem", status: "ACTIVE", deadline: null },
    } }]);
    const body = await (await GET(request())).json();
    expect(body.assessments).toEqual([]);
    expect(mocks.calculateProgressScores).not.toHaveBeenCalled();
  });
});
