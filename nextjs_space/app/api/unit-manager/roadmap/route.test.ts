import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";

const mocks = vi.hoisted(() => ({
  withAuth: vi.fn(), resolve: vi.fn(), structure: vi.fn(), recommendations: vi.fn(), update: vi.fn(),
  prisma: { roadmapItem: { findUnique: vi.fn(), update: vi.fn() }, user: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.withAuth }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/managed-assessment", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/managed-assessment")>(), resolveManagedAssessment: mocks.resolve }));
vi.mock("@/lib/unit-dashboard", () => ({ loadManagedStructure: mocks.structure }));
vi.mock("@/lib/scoring", () => ({ getRecommendationsForUser: mocks.recommendations }));
vi.mock("@/lib/roadmap-status", () => ({ updateRoadmapStatus: mocks.update }));
import { POST } from "./route";

const request = (body: object) => new NextRequest("http://localhost/api/unit-manager/roadmap", { method: "POST", body: JSON.stringify({ assessmentId: "a1", recommendationId: "r1", ...body }) });
const scope = { id: "a1", surveyId: "s1", sectorId: null, subSectorId: null, questionIds: ["q1"] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.withAuth.mockResolvedValue({ success: true, userId: "esra", user: { role: "UNIT_MANAGER", unitId: null } });
  mocks.resolve.mockResolvedValue({ id: "a1", unitId: "unit-a", scoring: scope, survey: { isActive: true, archivedAt: null }, campaignRecipient: null });
  mocks.structure.mockResolvedValue({ scoring: scope });
  mocks.recommendations.mockResolvedValue([{ id: "r1", isActionable: true }]);
  mocks.prisma.roadmapItem.findUnique.mockResolvedValue({ id: "item-1", status: "PLANNED" });
  mocks.prisma.roadmapItem.update.mockResolvedValue({});
  mocks.prisma.user.findFirst.mockResolvedValue({ id: "member" });
  mocks.update.mockResolvedValue({ ok: true, result: { earned: 0.8 } });
});

describe("birimin yol haritası", () => {
  it("durum değişikliğini seçili değerlendirme ve ortak durum servisi üzerinden yapar", async () => {
    const response = await POST(request({ status: "COMPLETED" }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith("esra", expect.objectContaining({ assessment: scope, recommendationId: "r1", status: "COMPLETED" }));
  });
  it("başka birimin üyesini sorumlu yapmaz", async () => {
    mocks.prisma.user.findFirst.mockResolvedValue(null);
    expect((await POST(request({ assigneeId: "outside-user" }))).status).toBe(400);
    expect(mocks.prisma.roadmapItem.update).not.toHaveBeenCalled();
    expect(mocks.prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "outside-user", unitId: "unit-a", isActive: true } }));
  });
  it("sorumlu ve hedef tarih değişirken tamamlanmış işin durumuna dokunmaz", async () => {
    mocks.prisma.roadmapItem.findUnique.mockResolvedValue({ id: "item-1", status: "COMPLETED" });
    expect((await POST(request({ assigneeId: "member", dueDate: "2026-12-01" }))).status).toBe(200);
    expect(mocks.prisma.roadmapItem.update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { assigneeId: "member", dueDate: new Date("2026-12-01T23:59:59.999+03:00") } });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("geçersiz takvim tarihini reddeder", async () => {
    expect((await POST(request({ dueDate: "2026-02-31" }))).status).toBe(400);
    expect(mocks.prisma.roadmapItem.update).not.toHaveBeenCalled();
  });
  it("kapsam dışı ve anonim sonuçlar için hiçbir yazma yapmaz", async () => {
    mocks.resolve.mockRejectedValue(new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok."));
    expect((await POST(request({ status: "COMPLETED" }))).status).toBe(403);
    expect(mocks.prisma.roadmapItem.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("kapalı dönemi değiştirmez", async () => {
    mocks.resolve.mockResolvedValue({ id: "a1", unitId: "unit-a", scoring: scope, survey: { isActive: true }, campaignRecipient: { campaign: { status: "CLOSED" } } });
    expect((await POST(request({ status: "COMPLETED" }))).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("kilitli ve birime gösterilmeyen öneriyi yol haritasına eklemez", async () => {
    mocks.prisma.roadmapItem.findUnique.mockResolvedValue(null);
    mocks.recommendations.mockResolvedValue([{ id: "r1", isActionable: false }]);
    expect((await POST(request({ status: "PLANNED" }))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
