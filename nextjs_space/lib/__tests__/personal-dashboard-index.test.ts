import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";

const mocks = vi.hoisted(() => ({ scores: vi.fn(), scope: vi.fn() }));
vi.mock("../scoring", async original => ({
  ...(await original<typeof import("../scoring")>()),
  calculateProgressScores: mocks.scores, getScopeResolverForProfile: mocks.scope,
}));
import { loadPersonalDashboardIndex } from "../unit-dashboard";

const actor = { userId: "u1", user: { role: "USER" } };
const owner = { firstName: "Bora", lastName: "Er", email: "bora@example.com", organization: "Bora Danışmanlık", sectorId: "sector-1", subSectorId: null, unitId: null };
const db = {
  user: { findUnique: vi.fn() }, assessment: { findMany: vi.fn() },
  userSurveyAssignment: { findMany: vi.fn() }, category: { findMany: vi.fn() },
};
const client = db as unknown as DbClient;
const record = {
  id: "p1", surveyId: "s1", unitId: null, ownerUserId: "u1", status: "IN_PROGRESS", submittedAt: null, createdAt: new Date("2026-09-01T09:00:00Z"),
  campaignRecipientId: null, campaignRecipient: null, unit: null, survey: { id: "s1", name: "ESG anketi", isActive: true, archivedAt: null, isDemo: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue(owner);
  db.assessment.findMany.mockResolvedValue([record]);
  db.userSurveyAssignment.findMany.mockResolvedValue([
    { surveyId: "s1", assignedAt: new Date("2026-08-01T09:00:00Z"), deadline: new Date("2026-12-31T20:59:59Z"), hasDeadline: true, survey: { name: "ESG anketi" } },
    { surveyId: "s2", assignedAt: new Date("2026-08-02T09:00:00Z"), deadline: null, hasDeadline: false, survey: { name: "İklim anketi" } },
  ]);
  db.category.findMany.mockResolvedValue([]);
  mocks.scope.mockResolvedValue(() => ({ applicable: true }));
  mocks.scores.mockResolvedValue({ completedQuestions: 0, overallPercentage: 0, overallScore: 1 });
});

describe("kişisel pano listesi", () => {
  it("birimsiz kullanıcının değerlendirmelerini ve başlamadığı atanmış anketleri kişisel birimin altında listeler", async () => {
    const index = await loadPersonalDashboardIndex(actor, client);
    expect(index?.unit).toEqual({ id: "self", name: "Bora Danışmanlık", description: null, parentId: null, assessmentCount: 2 });
    expect(index?.assessments.map(row => [row.id, row.assessmentId, row.unitId, row.surveyId, row.periodName])).toEqual([
      ["p1", "p1", "self", "s1", "Kişisel değerlendirme"],
      ["pending:self:s2", null, "self", "s2", "Kişisel değerlendirme"],
    ]);
    expect(index?.assessments[0].deadline).toBe("2026-12-31T20:59:59.000Z");
    // Puan, sahibin sektör kapsamıyla hesaplanır.
    expect(mocks.scope).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", sectorId: "sector-1" }), "s1", client);
    expect(db.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerUserId: "u1", unitId: null, campaignRecipientId: null, survey: { isDemo: false } } }));
  });
  it("birime bağlı kullanıcıda ve hiç anketi olmayanda liste yoktur", async () => {
    db.user.findUnique.mockResolvedValue({ ...owner, unitId: "unit-1" });
    expect(await loadPersonalDashboardIndex(actor, client)).toBeNull();
    expect(db.assessment.findMany).not.toHaveBeenCalled();
    db.user.findUnique.mockResolvedValue(owner);
    db.assessment.findMany.mockResolvedValue([]);
    db.userSurveyAssignment.findMany.mockResolvedValue([]);
    expect(await loadPersonalDashboardIndex(actor, client)).toBeNull();
  });
});
