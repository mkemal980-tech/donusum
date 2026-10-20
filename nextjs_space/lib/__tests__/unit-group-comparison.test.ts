import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), structure: vi.fn(), inputs: vi.fn() }));
vi.mock("../managed-assessment", () => ({ resolveManagedAssessment: mocks.resolve }));
vi.mock("../unit-dashboard", () => ({ loadManagedStructure: mocks.structure }));
// Motor gerçek kalır; yalnızca cevaplar test girdisinden okunur.
vi.mock("../scoring", async original => ({ ...(await original<typeof import("../scoring")>()), loadProgressInputs: mocks.inputs }));
import { loadUnitGroupComparison, percentileBand, MINIMUM_GROUP_SIZE } from "../unit-group-comparison";

const actor = { userId: "manager-b", user: { role: "UNIT_MANAGER", unitId: null } };
const db = { unit: { findUnique: vi.fn() }, assessment: { findMany: vi.fn() }, surveyCampaign: { findUnique: vi.fn() } };
const client = db as unknown as DbClient;
const categories = [{ id: "cat-e", name: "Çevre", subCategories: [] }, { id: "cat-s", name: "Sosyal", subCategories: [] }];
/** Her üyenin iki kategoride tek sorusu var; oran 0–1, null cevapsız. */
const answers: Record<string, [number | null, number | null]> = {
  "as-b": [0.5, 0.75], "as-1": [1, 1], "as-2": [0.25, 0.5], "as-3": [0.75, null], "as-4": [0, 0.25], "as-5": [0.5, 0.5],
};
const inputsFor = (id: string) => ({
  responses: answers[id].map((ratio, index) => ({ questionId: id + "-q" + index, score: (ratio ?? 0) * 4, maxScore: 4, weight: 1, applicable: true, answered: ratio !== null,
    axisType: "VELOCITY", categoryId: categories[index].id, subCategoryId: null })),
  recommendations: [], completedIds: new Set(), completedCount: 0, totalQuestions: 2,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ id: "as-b", unitId: "unit-b", surveyId: "survey-1", status: "SUBMITTED", campaignRecipient: { campaign: { id: "camp-1" } },
    scoring: { id: "as-b", surveyId: "survey-1", sectorId: "s", subSectorId: null } });
  db.unit.findUnique.mockResolvedValue({ parentId: "root", parent: { name: "Ege Sanayi Odası" } });
  db.assessment.findMany.mockResolvedValue(Object.keys(answers).map(id => ({ id, unit: { sectorId: "s", subSectorId: null } })));
  db.surveyCampaign.findUnique.mockResolvedValue({ minimumCohortSize: 5 });
  mocks.structure.mockImplementation(async scope => ({ categories, questions: [], scoring: { ...scope, questionIds: [] } }));
  mocks.inputs.mockImplementation(async (_user, options) => inputsFor(options.assessment.id));
});

describe("yüzdelik dilim", () => {
  it("en küçük adım %5'tir", () => {
    expect([1, 3, 6, 100].map(rank => percentileBand(rank, 100).value)).toEqual([5, 5, 10, 100]);
    expect(percentileBand(1, 60)).toEqual({ value: 5, width: 5 });
  });
  it("küçük grupta dilim en az üç üyeyi kapsayacak kadar genişler", () => {
    expect(percentileBand(1, 20)).toEqual({ value: 15, width: 15 });
    expect(percentileBand(4, 20).value).toBe(30);
    expect(percentileBand(1, 10)).toEqual({ value: 30, width: 30 });
    expect([1, 5].map(rank => percentileBand(rank, 5).value)).toEqual([60, 100]);
  });
});

describe("üyenin birim kıyası", () => {
  it("aynı üst birimin aynı dönemdeki gönderilmiş sonuçlarını toplar, tekil puan veya ad vermez", async () => {
    const result = await loadUnitGroupComparison(actor, "as-b", client);
    expect(db.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "SUBMITTED", unit: { parentId: "root" }, campaignRecipient: { campaignId: "camp-1" } }) }));
    if (!result.available) throw new Error("kıyas bekleniyordu");
    // Genel puan = cevap oranlarının ortalaması; cevapsız soru paydada kalır (as-3: (0,75 + 0) / 2).
    // b %63; diğerleri 100, 38, 38, 13, 50 → ortalama 50,3. b ikinci; 6 üyede dilim %50 genişliğinde.
    expect(result).toMatchObject({ groupName: "Ege Sanayi Odası", count: 6, overall: { mine: 63, average: 50.3, difference: 12.7 }, band: { value: 50, width: 50 } });
    expect(JSON.stringify(result)).not.toMatch(/as-1|unit-/);
  });
  it("kategoriyi yeterince üye cevaplamadıysa kategori ortalamasını gizler", async () => {
    const result = await loadUnitGroupComparison(actor, "as-b", client);
    if (!result.available) throw new Error("kıyas bekleniyordu");
    expect(result.categories.map(row => [row.name, row.mine, row.average])).toEqual([["Çevre", 50, 50], ["Sosyal", 75, 60]]);
    answers["as-5"][1] = null;
    const fewer = await loadUnitGroupComparison(actor, "as-b", client);
    if (!fewer.available) throw new Error("kıyas bekleniyordu");
    expect(fewer.categories[1]).toMatchObject({ mine: 75, average: null, difference: null });
    answers["as-5"][1] = 0.5;
  });
  it("asgari üye sayısının altında ortalama göstermez", async () => {
    db.assessment.findMany.mockResolvedValue([{ id: "as-b", unit: null }, { id: "as-1", unit: null }]);
    expect(await loadUnitGroupComparison(actor, "as-b", client)).toEqual({ available: false, reason: "COHORT", groupName: "Ege Sanayi Odası", count: 2, required: MINIMUM_GROUP_SIZE });
    expect(mocks.inputs).not.toHaveBeenCalled();
  });
  it("kampanyanın daha yüksek anonimlik eşiğine uyar", async () => {
    db.surveyCampaign.findUnique.mockResolvedValue({ minimumCohortSize: 8 });
    expect(await loadUnitGroupComparison(actor, "as-b", client)).toMatchObject({ available: false, reason: "COHORT", required: 8 });
  });
  it("gönderilmemiş değerlendirmede ve üst birimi olmayan üyede kıyas yapmaz", async () => {
    mocks.resolve.mockResolvedValueOnce({ id: "as-b", unitId: "unit-b", status: "IN_PROGRESS", campaignRecipient: null });
    expect(await loadUnitGroupComparison(actor, "as-b", client)).toEqual({ available: false, reason: "NOT_SUBMITTED", groupName: "Ege Sanayi Odası" });
    db.unit.findUnique.mockResolvedValue({ parentId: null, parent: null });
    expect(await loadUnitGroupComparison(actor, "as-b", client)).toEqual({ available: false, reason: "NO_GROUP", groupName: null });
    expect(db.assessment.findMany).not.toHaveBeenCalled();
  });
  it("kurum içi dönemde yalnızca kampanyasız gönderimleri karşılaştırır", async () => {
    mocks.resolve.mockResolvedValue({ id: "as-b", unitId: "unit-b", surveyId: "survey-1", status: "SUBMITTED", campaignRecipient: null, scoring: { id: "as-b", surveyId: "survey-1", sectorId: "s", subSectorId: null } });
    await loadUnitGroupComparison(actor, "as-b", client);
    expect(db.assessment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ campaignRecipientId: null }) }));
    expect(db.surveyCampaign.findUnique).not.toHaveBeenCalled();
  });
});
