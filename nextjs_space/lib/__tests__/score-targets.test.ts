import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";
import { loadAssessmentTargets, saveAssessmentTargets, TargetValidationError } from "../score-targets";

const db = {
  scoreTarget: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  category: { findMany: vi.fn() },
};
const client = db as unknown as DbClient;
const unit = { surveyId: "s1", unitId: "unit-1", ownerUserId: null };
const personal = { surveyId: "s1", unitId: null, ownerUserId: "owner-1" };

beforeEach(() => {
  vi.clearAllMocks();
  db.scoreTarget.findMany.mockResolvedValue([]);
  db.category.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.filter(id => id.startsWith("cat")).map(id => ({ id, name: "Kategori " + id })));
});

describe("kuruluş hedefi", () => {
  it("birimde birime, kişisel değerlendirmede sahibine ait hedefleri okur", async () => {
    db.scoreTarget.findMany.mockResolvedValue([
      { categoryId: null, percentage: 70, targetDate: new Date("2027-12-31T20:59:59.999Z") },
      { categoryId: "cat-1", percentage: 60, targetDate: null },
    ]);
    expect(await loadAssessmentTargets(unit, client)).toEqual({
      overall: { percentage: 70, targetDate: "2027-12-31T20:59:59.999Z" }, categories: { "cat-1": { percentage: 60, targetDate: null } },
    });
    expect(db.scoreTarget.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { surveyId: "s1", unitId: "unit-1" } }));
    await loadAssessmentTargets(personal, client);
    expect(db.scoreTarget.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { surveyId: "s1", ownerUserId: "owner-1" } }));
  });
  it("hedef yoksa uydurmaz", async () => {
    expect(await loadAssessmentTargets(unit, client)).toEqual({ overall: null, categories: {} });
  });
  it("hedefleri bütün olarak değiştirir: yüzde yuvarlanır, tarih gün sonu, kaydeden yazılır", async () => {
    await saveAssessmentTargets("manager-1", unit, {
      overall: { percentage: 72.35, targetDate: "2027-12-31" }, categories: [{ categoryId: "cat-1", percentage: 60, targetDate: null }],
    }, client);
    expect(db.scoreTarget.deleteMany).toHaveBeenCalledWith({ where: { surveyId: "s1", unitId: "unit-1" } });
    expect(db.scoreTarget.createMany).toHaveBeenCalledWith({ data: [
      { categoryId: null, percentage: 72.4, targetDate: new Date("2027-12-31T23:59:59.999+03:00"), unitId: "unit-1", surveyId: "s1", setById: "manager-1" },
      { categoryId: "cat-1", percentage: 60, targetDate: null, unitId: "unit-1", surveyId: "s1", setById: "manager-1" },
    ] });
  });
  it("hepsi boş gönderilirse hedefleri kaldırır", async () => {
    await saveAssessmentTargets("owner-1", personal, { overall: null, categories: [] }, client);
    expect(db.scoreTarget.deleteMany).toHaveBeenCalledWith({ where: { surveyId: "s1", ownerUserId: "owner-1" } });
    expect(db.scoreTarget.createMany).not.toHaveBeenCalled();
  });
  it("geçersiz yüzdeyi, tarihi, mükerrer ve başka ankete ait kategoriyi reddeder", async () => {
    const invalid = [
      { overall: { percentage: 0 } }, { overall: { percentage: 101 } }, { overall: { percentage: Number.NaN } }, { overall: { percentage: "70" } },
      { overall: { percentage: 70, targetDate: "2027-02-30" } }, { overall: { percentage: 70, targetDate: "31.12.2027" } },
      { categories: [{ categoryId: "cat-1", percentage: 50 }, { categoryId: "cat-1", percentage: 60 }] },
      { categories: [{ categoryId: "other", percentage: 50 }] }, { categories: "cat-1" },
    ];
    for (const input of invalid) await expect(saveAssessmentTargets("m", unit, input, client), JSON.stringify(input)).rejects.toBeInstanceOf(TargetValidationError);
    expect(db.scoreTarget.deleteMany).not.toHaveBeenCalled();
  });
});
