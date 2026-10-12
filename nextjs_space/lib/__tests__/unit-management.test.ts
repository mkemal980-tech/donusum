import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbClient } from "../assessment";
import { managementRows, managementDetails, managementUnits } from "../../test-fixtures/unit-management";

const mocks = vi.hoisted(() => ({ index: vi.fn(), detail: vi.fn() }));
vi.mock("../unit-dashboard", () => ({ loadUnitDashboardIndex: mocks.index, loadUnitAssessmentDetail: mocks.detail }));
import { loadUnitManagementDashboard, updateManagedEmployeeCount } from "../unit-management";
const db = { unitAdmin: { findMany: vi.fn() }, unit: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }, benchmark: { findMany: vi.fn() }, ironmanBenchmark: { findMany: vi.fn() } };
const client = db as unknown as DbClient;
const actor = { userId: "manager", user: { role: "UNIT_MANAGER", unitId: null } };
beforeEach(() => {
  vi.clearAllMocks();
  db.unitAdmin.findMany.mockResolvedValue([{ unitId: "root" }]);
  db.unit.findMany.mockResolvedValue(managementUnits.map(unit => ({ ...unit, sector: unit.sectorName ? { name: unit.sectorName } : null, _count: { users: unit.activeUserCount } })));
  db.unit.findUnique.mockResolvedValue({ id: "unit-a" }); db.unit.update.mockImplementation(async args => ({ id: args.where.id, employeeCount: args.data.employeeCount }));
  db.benchmark.findMany.mockResolvedValue([]); db.ironmanBenchmark.findMany.mockResolvedValue([]);
  mocks.index.mockImplementation(async (_actor, _db, ids) => ({ units: managementUnits.filter(unit => ids.includes(unit.id)), assessments: managementRows.filter(row => ids.includes(row.unitId)), hasAnonymousCampaigns: false }));
  mocks.detail.mockImplementation(async (_actor, id) => managementDetails().find(detail => detail.assessment.id === id));
});
describe("birim yönetici alanının kapsamı", () => {
  it("kişisel üyeliği olmayan yöneticinin kök ve alt birimlerini yükler", async () => {
    const data = await loadUnitManagementDashboard(actor, { unitId: "root" }, client);
    expect(data.analytics.results.count).toBe(2);
    expect(mocks.index).toHaveBeenCalledWith(actor, client, expect.arrayContaining(["root", "unit-a", "unit-b", "unit-c"]));
  });
  it("kardeş birimin değerlendirmesini seçili alt birime karıştırmaz", async () => {
    const data = await loadUnitManagementDashboard(actor, { unitId: "unit-a" }, client);
    expect(data.analytics.scope.unitCount).toBe(1);
    expect(mocks.detail).toHaveBeenCalledTimes(1);
    expect(data.analytics.results.average).toBe(80);
  });
  it("yetkisiz birimde sonuç veya export verisi yüklenmez", async () => {
    await expect(loadUnitManagementDashboard(actor, { unitId: "outside" }, client)).rejects.toMatchObject({ status: 403 });
    expect(mocks.index).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("normal kullanıcı, boş üyelikten yönetim yetkisi edinemez", async () => {
    await expect(loadUnitManagementDashboard({ ...actor, user: { role: "USER" } }, {}, client)).rejects.toMatchObject({ status: 403 });
    expect(mocks.index).not.toHaveBeenCalled();
  });
  it("anket ve dönemi seçili yönetim kapsamıyla doğrular", async () => {
    await expect(loadUnitManagementDashboard(actor, { surveyId: "outside-survey" }, client)).rejects.toMatchObject({ status: 404 });
    await expect(loadUnitManagementDashboard(actor, { periodId: "outside-period" }, client)).rejects.toMatchObject({ status: 404 });
    expect(mocks.detail).not.toHaveBeenCalled();
  });
});
describe("kuruluş çalışan sayısını düzenleme", () => {
  it("yetkili alt birimin gerçek çalışan sayısını değiştirir", async () => {
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
