import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";

const mocks = vi.hoisted(() => ({ structure: vi.fn(), recs: vi.fn(), update: vi.fn(), access: vi.fn() }));
vi.mock("../unit-dashboard", () => ({ loadManagedStructure: mocks.structure }));
vi.mock("../scoring", () => ({ getRecommendationsForUser: mocks.recs }));
vi.mock("../roadmap-status", () => ({ updateRoadmapStatus: mocks.update }));
vi.mock("../roadmap-access", () => ({ loadRoadmapAccess: mocks.access, ROADMAP_FORBIDDEN: "yetki yok" }));
import { saveAssessmentRoadmap } from "../unit-roadmap";

const db = { roadmapItem: { findUnique: vi.fn(), update: vi.fn() }, user: { findFirst: vi.fn() } };
const client = db as unknown as DbClient;
const actor = { userId: "member-1", user: { role: "USER" } };
const record = (overrides: Record<string, unknown> = {}) => ({
  id: "as-1", unitId: "unit-b", survey: { isActive: true, archivedAt: null }, campaignRecipient: null, scoring: { id: "as-1", surveyId: "s1" }, ...overrides,
}) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.structure.mockResolvedValue({ scoring: { id: "as-1", surveyId: "s1", questionIds: [] } });
  mocks.update.mockResolvedValue({ ok: true, result: { earned: 0.2 } });
  mocks.access.mockResolvedValue({ canManage: false, canUpdate: (id: string) => id === "mine" });
  db.roadmapItem.findUnique.mockResolvedValue({ id: "item-1" });
});

describe("panodan yol haritası kaydı", () => {
  it("çalışan kendi işinin durumunu açık olan değerlendirmeye yazar", async () => {
    const outcome = await saveAssessmentRoadmap(actor, "member", record(), { recommendationId: "mine", status: "COMPLETED" }, client);
    expect(outcome).toEqual({ status: 200, body: { success: true, earned: 0.2 } });
    expect(mocks.update).toHaveBeenCalledWith("member-1", { recommendationId: "mine", assessment: { id: "as-1", surveyId: "s1", questionIds: [] }, status: "COMPLETED" });
  });
  it("çalışan başkasının işini, yol haritasında olmayan öneriyi ve planlamayı değiştiremez", async () => {
    expect((await saveAssessmentRoadmap(actor, "member", record(), { recommendationId: "other", status: "COMPLETED" }, client)).status).toBe(403);
    expect((await saveAssessmentRoadmap(actor, "member", record(), { recommendationId: "mine", status: "PLANNED", assigneeId: "member-1" }, client)).status).toBe(403);
    expect((await saveAssessmentRoadmap(actor, "member", record(), { recommendationId: "mine", dueDate: "2027-01-01" }, client)).status).toBe(403);
    db.roadmapItem.findUnique.mockResolvedValue(null);
    expect((await saveAssessmentRoadmap(actor, "member", record(), { recommendationId: "mine", status: "PLANNED" }, client)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("kapalı dönemde kimse yazamaz", async () => {
    expect((await saveAssessmentRoadmap(actor, "manager", record({ survey: { isActive: false, archivedAt: null } }), { recommendationId: "mine", status: "PLANNED" }, client)).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("yönetici sorumluyu yalnızca birimin aktif üyelerinden seçer", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const outcome = await saveAssessmentRoadmap({ userId: "manager", user: { role: "UNIT_MANAGER" } }, "manager", record(), { recommendationId: "mine", assigneeId: "outsider" }, client);
    expect(outcome).toEqual({ status: 400, body: { error: "Sorumlu bu birimin aktif üyesi olmalı." } });
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "outsider", unitId: "unit-b", isActive: true } }));
  });
  it("kişisel değerlendirmede sorumlu yalnızca sahibi olabilir; başka birimsiz kullanıcı seçilemez", async () => {
    const owner = { userId: "owner-1", user: { role: "USER" } };
    const personal = record({ unitId: null, ownerUserId: "owner-1" });
    const outcome = await saveAssessmentRoadmap(owner, "owner", personal, { recommendationId: "mine", assigneeId: "someone-else" }, client);
    expect(outcome).toEqual({ status: 400, body: { error: "Kişisel değerlendirmede sorumlu yalnızca değerlendirmenin sahibi olabilir." } });
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect((await saveAssessmentRoadmap(owner, "owner", personal, { recommendationId: "mine", assigneeId: "owner-1", dueDate: null }, client)).status).toBe(200);
    expect(db.roadmapItem.update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { assigneeId: "owner-1", dueDate: null } });
  });
});
