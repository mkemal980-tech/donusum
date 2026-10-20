import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";
import { managementRows, managementDetails, managementUnits } from "../../test-fixtures/unit-management";

const mocks = vi.hoisted(() => ({ index: vi.fn(), detail: vi.fn() }));
vi.mock("../unit-dashboard", () => ({ loadUnitDashboardIndex: mocks.index, loadUnitAssessmentDetail: mocks.detail }));
import { loadUnitManagementDashboard, updateManagedEmployeeCount } from "../unit-management";
const db = {
  unitAdmin: { findMany: vi.fn() }, unit: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  assessment: { findMany: vi.fn() }, campaignRecipient: { findMany: vi.fn() }, userSurveyAssignment: { findMany: vi.fn() },
  benchmark: { findMany: vi.fn() }, ironmanBenchmark: { findMany: vi.fn() },
};
const client = db as unknown as DbClient;
const actor = { userId: "manager", user: { role: "UNIT_MANAGER", unitId: null } };
const records = (units = managementUnits) => units.map(unit => ({ ...unit, sector: unit.sectorName ? { name: unit.sectorName } : null, _count: { users: unit.activeUserCount } }));
beforeEach(() => {
  vi.clearAllMocks();
  db.unitAdmin.findMany.mockResolvedValue([{ unitId: "root" }]);
  db.unit.findMany.mockResolvedValue(records());
  db.unit.findUnique.mockResolvedValue({ id: "unit-a" }); db.unit.update.mockImplementation(async args => ({ id: args.where.id, employeeCount: args.data.employeeCount }));
  db.assessment.findMany.mockResolvedValue([
    { surveyId: "survey-old", createdAt: new Date("2025-01-01"), survey: { name: "Eski anket" } },
    { surveyId: "survey-1", createdAt: new Date("2026-01-01"), survey: { name: "Sürdürülebilirlik olgunluk anketi" } },
  ]);
  db.campaignRecipient.findMany.mockResolvedValue([]); db.userSurveyAssignment.findMany.mockResolvedValue([]);
  db.benchmark.findMany.mockResolvedValue([]); db.ironmanBenchmark.findMany.mockResolvedValue([]);
  mocks.index.mockImplementation(async (_actor, _db, ids, filter) => ({
    units: managementUnits.filter(unit => ids.includes(unit.id)),
    assessments: managementRows.filter(row => ids.includes(row.unitId) && (!filter?.surveyId || row.surveyId === filter.surveyId)), hasAnonymousCampaigns: false,
  }));
  mocks.detail.mockImplementation(async (_actor, id) => managementDetails().find(detail => detail.assessment.id === id));
});

describe("birim yönetim panosunun kapsamı", () => {
  it("birimin yalnızca hemen altındaki üyelerini ve yalnızca seçili anketi yükler", async () => {
    const data = await loadUnitManagementDashboard(actor, { unitId: "root" }, client);
    if (data.kind !== "group") throw new Error("grup bekleniyordu");
    expect(mocks.index).toHaveBeenCalledWith(actor, client, ["unit-a", "unit-b", "unit-c", "unit-d", "unit-e", "unit-f"], { surveyId: "survey-1" });
    expect(data.selection).toMatchObject({ unitId: "root", surveyId: "survey-1", periodId: "period-2026", campaignId: "period-2026" });
    expect(data.options.surveys.map(survey => survey.id)).toEqual(["survey-1", "survey-old"]);
    expect(data.options.members.map(member => member.id)).not.toContain("unit-a1");
    // Taslak da yüklenir: katılımda kimin nerede beklediği gösterilir.
    expect(mocks.detail).toHaveBeenCalledTimes(4);
    expect(data.analytics.results.count).toBe(3);
  });
  it("üyesi olmayan birim seçilince o birimin kendi panosuna yönlendirir", async () => {
    expect(await loadUnitManagementDashboard(actor, { unitId: "unit-b" }, client)).toEqual({ kind: "member", unitId: "unit-b" });
    expect(mocks.index).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("altında departmanı olan üye kendi grubu olarak açılır", async () => {
    const data = await loadUnitManagementDashboard(actor, { unitId: "unit-a" }, client);
    expect(data.kind).toBe("group");
    expect(mocks.index).toHaveBeenCalledWith(actor, client, ["unit-a1"], expect.anything());
  });
  it("tek birim yöneten kullanıcı doğrudan kendi panosuna gider", async () => {
    db.unitAdmin.findMany.mockResolvedValue([{ unitId: "unit-b" }]);
    db.unit.findMany.mockImplementation(async args => args?.where?.id ? records().filter(unit => args.where.id.in.includes(unit.id)) : records());
    expect(await loadUnitManagementDashboard(actor, {}, client)).toEqual({ kind: "member", unitId: "unit-b" });
  });
  it("eski 'tümü' bağlantısı sanal grup yoksa ilk birime düşer", async () => {
    const data = await loadUnitManagementDashboard(actor, { unitId: "all" }, client);
    expect(data.kind === "group" && data.selection.unitId).toBe("root");
  });
  it("yetkisiz birimde sonuç veya export verisi yüklenmez", async () => {
    await expect(loadUnitManagementDashboard(actor, { unitId: "outside" }, client)).rejects.toMatchObject({ status: 403 });
    expect(mocks.index).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("normal kullanıcı, boş üyelikten yönetim yetkisi edinemez", async () => {
    await expect(loadUnitManagementDashboard({ ...actor, user: { role: "USER" } }, {}, client)).rejects.toMatchObject({ status: 403 });
    expect(mocks.index).not.toHaveBeenCalled();
  });
  it("anket ve dönemi seçili kapsamla doğrular", async () => {
    await expect(loadUnitManagementDashboard(actor, { surveyId: "outside-survey" }, client)).rejects.toMatchObject({ status: 404 });
    await expect(loadUnitManagementDashboard(actor, { periodId: "outside-period" }, client)).rejects.toMatchObject({ status: 404 });
    expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("dönemleri en yeni başlayandan sıralar ve kurum içi dönemde kampanya önermez", async () => {
    mocks.index.mockResolvedValue({ units: [], hasAnonymousCampaigns: false, assessments: [
      { ...managementRows[0], periodId: "internal", periodName: "Kuruluş içi", createdAt: "2025-02-01T00:00:00Z", locked: true },
      { ...managementRows[1], periodId: "period-2026", periodName: "2026 dönemi", createdAt: "2026-02-01T00:00:00Z", locked: true },
    ] });
    const data = await loadUnitManagementDashboard(actor, { periodId: "internal" }, client);
    if (data.kind !== "group") throw new Error("grup bekleniyordu");
    expect(data.options.periods.map(period => period.id)).toEqual(["period-2026", "internal"]);
    expect(data.selection).toMatchObject({ periodId: "internal", campaignId: null });
  });
});

describe("üye çalışan sayısını düzenleme", () => {
  it("yetkili üyenin gerçek çalışan sayısını değiştirir", async () => {
    expect(await updateManagedEmployeeCount(actor, { unitId: "unit-a", employeeCount: 10 }, client)).toEqual({ id: "unit-a", employeeCount: 10 });
    expect(db.unit.update).toHaveBeenCalledWith(expect.objectContaining({ data: { employeeCount: 10 } }));
  });
  it.each([-1, 1.5, "10", undefined, 2147483648])("geçersiz sayıyı reddeder: %s", async employeeCount => {
    await expect(updateManagedEmployeeCount(actor, { unitId: "unit-a", employeeCount }, client)).rejects.toMatchObject({ status: 400 });
    expect(db.unit.update).not.toHaveBeenCalled();
  });
  it("boş ve sıfır değerlerini ayrı korur", async () => {
    expect((await updateManagedEmployeeCount(actor, { unitId: "unit-a", employeeCount: null }, client)).employeeCount).toBeNull();
    expect((await updateManagedEmployeeCount(actor, { unitId: "unit-a", employeeCount: 0 }, client)).employeeCount).toBe(0);
  });
  it("yönetim kapsamı dışındaki birimi değiştirmez", async () => {
    await expect(updateManagedEmployeeCount(actor, { unitId: "outside", employeeCount: 10 }, client)).rejects.toMatchObject({ status: 403 });
    expect(db.unit.update).not.toHaveBeenCalled();
  });
});
