import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DbClient } from "../assessment";
import { resolveManagedAssessment, ManagedAssessmentError } from "../managed-assessment";
import { startManagedAssessment } from "../unit-dashboard";

const db = {
  unitAdmin: { findMany: vi.fn(), count: vi.fn() }, unit: { findMany: vi.fn() },
  assessment: { findFirst: vi.fn(), create: vi.fn() }, survey: { findFirst: vi.fn() },
  campaignRecipient: { findFirst: vi.fn(), count: vi.fn() }, userSurveyAssignment: { findFirst: vi.fn() },
};
const client = db as unknown as DbClient;
const actor = { userId: "esra", user: { role: "UNIT_MANAGER", unitId: "unrelated" } };
const record = {
  id: "a1", unitId: "child", surveyId: "s1", status: "IN_PROGRESS", submittedAt: null,
  unit: { id: "child", name: "Üretim", sectorId: "sector-unit", subSectorId: null },
  survey: { id: "s1", name: "ESG", isActive: true, isDemo: false, archivedAt: null },
  campaignRecipient: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.unitAdmin.findMany.mockResolvedValue([{ unitId: "root" }]);
  db.unitAdmin.count.mockResolvedValue(0);
  db.unit.findMany.mockResolvedValue([{ id: "root", parentId: null }, { id: "child", parentId: "root" }, { id: "outside", parentId: null }]);
  db.assessment.findFirst.mockResolvedValue(record);
  db.survey.findFirst.mockResolvedValue({ id: "s1" });
  db.campaignRecipient.count.mockResolvedValue(0);
  db.userSurveyAssignment.findFirst.mockResolvedValue({ id: "assignment" });
});

describe("birim değerlendirmesinin erişimi", () => {
  it("birim üyesi olmayan yöneticinin alt birimine erişimini doğrular ve birimin profilini kullanır", async () => {
    const resolved = await resolveManagedAssessment(actor, "a1", client);
    expect(db.assessment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "a1", unitId: { in: ["root", "child"] }, survey: { isDemo: false } },
    }));
    expect(resolved.scoring).toMatchObject({ id: "a1", sectorId: "sector-unit" });
  });
  it("normal kullanıcı yönetim bağlamını kullanamaz", async () => {
    await expect(resolveManagedAssessment({ ...actor, user: { role: "USER" } }, "a1", client)).rejects.toBeInstanceOf(ManagedAssessmentError);
    expect(db.assessment.findFirst).not.toHaveBeenCalled();
  });
  it("kapsam dışındaki değerlendirmeyi reddeder", async () => {
    db.assessment.findFirst.mockResolvedValue(null);
    await expect(resolveManagedAssessment(actor, "outside", client)).rejects.toThrow("erişiminiz yok");
  });
  it("üst birim yöneticisine anonim kampanyanın tekil sonucunu vermez", async () => {
    db.assessment.findFirst.mockResolvedValue({ ...record, campaignRecipient: { campaign: { privacyMode: "ANONYMOUS", status: "ACTIVE" } } });
    await expect(resolveManagedAssessment(actor, "a1", client)).rejects.toThrow("Anonim");
    db.unitAdmin.count.mockResolvedValue(1);
    expect((await resolveManagedAssessment(actor, "a1", client)).id).toBe("a1");
  });
  it("kapalı dönem ve gönderilmiş değerlendirmede görev değişikliğini kilitler", async () => {
    db.assessment.findFirst.mockResolvedValue({ ...record, status: "SUBMITTED" });
    expect((await resolveManagedAssessment(actor, "a1", client)).context.locked).toBe(true);
    db.assessment.findFirst.mockResolvedValue({ ...record, campaignRecipient: { campaign: { status: "CLOSED", privacyMode: "IDENTIFIED" } } });
    expect((await resolveManagedAssessment(actor, "a1", client)).context.locked).toBe(true);
  });
});

describe("değerlendirmeyi başlatma", () => {
  it("yalnızca yönetilen birimi başlatabilir", async () => {
    await expect(startManagedAssessment(actor, { unitId: "outside", surveyId: "s1" }, client)).rejects.toThrow("yetkiniz yok");
    expect(db.assessment.create).not.toHaveBeenCalled();
  });
  it("birime anket atanmamışsa boş değerlendirme açmaz", async () => {
    db.userSurveyAssignment.findFirst.mockResolvedValue(null);
    await expect(startManagedAssessment(actor, { unitId: "child", surveyId: "s1" }, client)).rejects.toThrow("atanmamış");
  });
  it("kampanya dönemi olmadan kuruluş içi kayda düşmez", async () => {
    db.campaignRecipient.count.mockResolvedValue(1);
    await expect(startManagedAssessment(actor, { unitId: "child", surveyId: "s1" }, client)).rejects.toThrow("kampanya dönemi");
  });
  it("ilk kayıttaki oluşturma yarışında kazanan değerlendirmeyi döndürür", async () => {
    db.assessment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "winner" });
    db.assessment.create.mockRejectedValue(new Error("unique"));
    expect(await startManagedAssessment(actor, { unitId: "child", surveyId: "s1" }, client)).toBe("winner");
  });
});
