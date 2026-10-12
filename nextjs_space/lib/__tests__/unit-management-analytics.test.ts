import { describe, expect, it } from "vitest";
import { buildUnitManagementAnalytics, managementScopeIds, unitSizeLabel } from "../unit-management-analytics";
import { managementDashboard, managementDetails, managementRows, managementUnits } from "../../test-fixtures/unit-management";
import { buildUnitManagementReportHtml, unitManagementReportTables } from "../unit-management-report";
import * as XLSX from "xlsx";

describe("birim yönetici analizi", () => {
  it("üst birim kendi alt birimlerini kapsar; kardeş birim ayrı kalır", () => {
    expect(managementScopeIds(managementUnits, "root")).toEqual(expect.arrayContaining(["root", "unit-a", "unit-b", "unit-c"]));
    expect(managementScopeIds(managementUnits, "unit-a")).toEqual(["unit-a"]);
    expect(managementScopeIds(managementUnits, "root", false)).toEqual(["root"]);
    expect(managementScopeIds(managementUnits, "outside")).toEqual([]);
  });
  it("hiyerarşi döngüsü sonlanır ve yetkili listenin dışını eklemez", () => {
    expect(managementScopeIds([{ id: "a", parentId: "b" }, { id: "b", parentId: "a" }], "a").sort()).toEqual(["a", "b"]);
  });
  it("liste okunduktan sonra birimi değişen değerlendirmeyi eski birime mal etmez", () => {
    const details = managementDetails(); details[0].assessment.unitId = "outside";
    const data = buildUnitManagementAnalytics({ units: managementUnits, rows: managementRows, details, basis: "answered" });
    expect(data.results.count).toBe(1); expect(data.results.average).toBe(60);
  });
  it("taslaklar dahil ve yalnızca gönderilmiş sonuçları ayrı toplar", () => {
    const mixed = managementDashboard().analytics;
    expect(mixed.participation).toMatchObject({ total: 3, submitted: 1, inProgress: 1, notStarted: 1 });
    expect(mixed.results).toMatchObject({ count: 2, average: 70, median: 70, difference: 20 });
    expect(managementDashboard({ basis: "submitted" }).analytics.results).toMatchObject({ count: 1, average: 80, median: 80 });
    expect(mixed.results.distribution.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });
  it("cevaplanmamış değerlendirmeye puan veya içgörü üretmez", () => {
    const detail = managementDetails()[0]; detail.answeredQuestions = 0;
    const result = buildUnitManagementAnalytics({ units: managementUnits, rows: managementRows, details: [detail], basis: "answered" });
    expect(result.results.average).toBeNull();
    expect(result.results.categories.every(category => category.average === null)).toBe(true);
    expect(result.portfolio.total).toBe(0);
  });
  it("tek eksenli anketi iki eksenli Ironman sınıfına sokmaz", () => {
    const details = managementDetails(); details[1].scores.enduranceWeight = 0;
    const result = buildUnitManagementAnalytics({ units: managementUnits, rows: managementRows, details, basis: "answered" });
    expect(result.ironman).toMatchObject({ count: 1, velocity: 4.6, endurance: 3.8, quadrant: "IRONMAN" });
  });
  it("aynı öneriyi tek portföy satırında birleştirir ve birim erişimini korur", () => {
    const result = managementDashboard().analytics.portfolio;
    expect(result.total).toBe(2);
    expect(result.memberReach).toBe(2);
    expect(result.rows[0].units).toHaveLength(2);
    expect(result.potentialGain).toBe(15);
  });
  it("kullanıcı sayısından şirket ölçeği uydurmaz", () => {
    const unknown = managementDashboard().analytics.companySizes.find(row => row.label === "Belirtilmedi");
    expect(unknown?.unitCount).toBe(2);
    expect(unitSizeLabel(null)).toBe("Belirtilmedi");
    expect([0, 9, 10, 49, 50, 249, 250].map(unitSizeLabel)).toEqual(["Çalışan yok", "Mikro (1–9)", "Küçük (10–49)", "Küçük (10–49)", "Orta (50–249)", "Orta (50–249)", "Büyük (250+)"]);
  });
  it("kayıtlı kategori kıyası yoksa genel kıyası kategoriye kopyalamaz", () => {
    const data = managementDashboard().analytics;
    expect(data.results.benchmarkCount).toBe(2);
    expect(data.results.categories.every(category => category.benchmark === null)).toBe(true);
  });
  it("alt sektör kıyasını genel sektör kıyasından önce kullanır", () => {
    const units = structuredClone(managementUnits); units[1].subSectorId = "sub-a";
    const data = buildUnitManagementAnalytics({ units, rows: managementRows, details: managementDetails(), basis: "submitted", benchmarks: [
      { sectorId: "sector-a", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 3 },
      { sectorId: "sector-a", subSectorId: "sub-a", level: "OVERALL", targetId: null, averageScore: 4 },
    ] });
    expect(data.results).toMatchObject({ benchmark: 75, difference: 5 });
  });
  it("gelişim grafiğini gerçek tarihlerden ve İstanbul gün sınırından üretir", () => {
    const rows = [{ ...managementRows[0], createdAt: "2026-09-30T22:00:00Z", submittedAt: "2026-10-01T23:00:00Z" }];
    const data = buildUnitManagementAnalytics({ units: managementUnits, rows, details: [], basis: "answered", now: new Date("2026-10-03T12:00:00Z") });
    expect(data.trend).toEqual([{ date: "2026-10-01", started: 1, submitted: 0 }, { date: "2026-10-02", started: 1, submitted: 1 }, { date: "2026-10-03", started: 1, submitted: 1 }]);
  });
  it("boş birimde bütün bölümler boş veri sözleşmesini korur", () => {
    const data = managementDashboard({ empty: true }).analytics;
    expect(data.results).toMatchObject({ count: 0, average: null, median: null, leadingMaturity: null });
    expect(data.ironman.quadrant).toBeNull(); expect(data.trend).toEqual([]); expect(data.portfolio.rows).toEqual([]);
  });
  it("rapor alt bölümleri içerir, HTML metnini ve Excel formüllerini güvenli tutar", () => {
    const data = managementDashboard(); data.selection.unitName = '<script>alert("x")</script>';
    data.analytics.portfolio.rows[0].title = "=HYPERLINK(\"bad\")";
    const html = buildUnitManagementReportHtml(data);
    expect(html).not.toContain('<script>alert("x")</script>'); expect(html).toContain("&lt;script&gt;");
    const tables = unitManagementReportTables(data);
    expect(Object.keys(tables)).toEqual(expect.arrayContaining(["Ironman", "Şirket ölçeği", "Sektörler", "Öneriler", "İçgörüler"]));
    const sheet = XLSX.utils.aoa_to_sheet(tables["Öneriler"]);
    expect(sheet.A2).toMatchObject({ t: "s" }); expect(sheet.A2.f).toBeUndefined();
  });
});
