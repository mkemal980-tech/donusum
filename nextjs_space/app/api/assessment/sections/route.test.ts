import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ManagedAssessmentError } from "@/lib/managed-assessment";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), resolve: vi.fn(), validateSurveyAccess: vi.fn(), getAssessmentContext: vi.fn(),
  create: vi.fn(), members: vi.fn(), assignments: vi.fn(), scope: vi.fn(),
  prisma: { subCategory: { findUnique: vi.fn() }, sectionAssignment: { upsert: vi.fn(), deleteMany: vi.fn() } },
}));
vi.mock("@/lib/api-utils", () => ({ withAuth: mocks.auth, validateSurveyAccess: mocks.validateSurveyAccess }));
vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/managed-assessment", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/managed-assessment")>(), resolveManagedAssessment: mocks.resolve }));
vi.mock("@/lib/assessment", () => ({ getAssessmentContext: mocks.getAssessmentContext, getOrCreateAssessment: mocks.create, getContributorCandidates: mocks.members, getSectionAssignments: mocks.assignments }));
vi.mock("@/lib/scoring", () => ({ getScopeResolver: mocks.scope, getScopeResolverForProfile: mocks.scope }));
import { POST } from "./route";

const selected = { id: "a1", surveyId: "s1", scoring: { id: "a1", surveyId: "s1", sectorId: null, subSectorId: null }, context: { assessmentId: "a1", unitId: "unit-a", isCoordinator: true, locked: false } };
const request = (body: object = {}) => new NextRequest("http://localhost/api/assessment/sections", { method: "POST", body: JSON.stringify({ assessmentId: "a1", surveyId: "s1", subCategoryId: "section-a", assigneeId: "member-a", ...body }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ success: true, userId: "esra", user: { role: "UNIT_MANAGER", unitId: null } });
  mocks.resolve.mockResolvedValue(selected);
  mocks.prisma.subCategory.findUnique.mockResolvedValue({ archivedAt: null, category: { surveyId: "s1" } });
  mocks.members.mockResolvedValue([{ id: "member-a" }]);
  mocks.scope.mockResolvedValue(() => ({ applicable: true, weight: 1 }));
  mocks.prisma.sectionAssignment.upsert.mockResolvedValue({ id: "assignment-a" });
});
describe("seçilen birimin görev dağılımı", () => {
  it("kişisel atama ve değerlendirme oluşturmadan seçili birime yazar", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.validateSurveyAccess).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.prisma.sectionAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { assessmentId_subCategoryId: { assessmentId: "a1", subCategoryId: "section-a" } },
    }));
  });
  it("başka birimin değerlendirmesine erişim reddedilir", async () => {
    mocks.resolve.mockRejectedValue(new ManagedAssessmentError("Erişim yok."));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.prisma.sectionAssignment.upsert).not.toHaveBeenCalled();
  });
  it("başka ankete ait bölüm ve istekleri reddeder", async () => {
    expect((await POST(request({ surveyId: "other" }))).status).toBe(400);
    mocks.prisma.subCategory.findUnique.mockResolvedValue({ archivedAt: null, category: { surveyId: "other" } });
    expect((await POST(request())).status).toBe(400);
  });
  it("kapsam dışı bölümün dağıtılmasını engeller", async () => {
    mocks.scope.mockResolvedValue(() => ({ applicable: false, weight: 1 }));
    expect((await POST(request())).status).toBe(400);
  });
  it("birimde olmayan kişiyi sorumlu yapmaz", async () => {
    mocks.members.mockResolvedValue([]);
    expect((await POST(request())).status).toBe(400);
  });
  it("gönderilmiş değerlendirmeye görev atamaz", async () => {
    mocks.resolve.mockResolvedValue({ ...selected, context: { ...selected.context, locked: true } });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.prisma.sectionAssignment.upsert).not.toHaveBeenCalled();
  });
});
