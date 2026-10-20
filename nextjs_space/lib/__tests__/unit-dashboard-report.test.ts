import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { assessmentView, unitDetail } from "../../test-fixtures/unit-dashboard";
import { buildUnitReportHtml, unitReportTables } from "../unit-dashboard-report";
import { surveyAnswer } from "../unit-dashboard-display";

describe("birim raporu", () => {
  it("koşullu cevabı seçenek kodları yerine okunabilir etiketlerle gösterir", () => {
    expect(surveyAnswer({
      value: JSON.stringify({ threshold: "yes", selected: ["metering"] }), type: "CONDITIONAL_CHOICE", options: null,
      conditionalOptions: { options: [{ value: "metering", label: "Sayaçla izleniyor" }] },
    })).toBe("Evet · Sayaçla izleniyor");
  });
  it("birim, dönem, ekip, cevap ve gelişim katkısını rapora dahil eder", () => {
    const html = buildUnitReportHtml(unitDetail());
    expect(html).toContain("2026 dönemi");
    expect(html).toContain("Enerji tüketimi izleniyor mu?");
    expect(html).toContain("Ayşe Üye");
    expect(html).toContain("Gelişim katkısı");
  });
  it("kullanıcı denetimindeki ad ve cevapları HTML olarak çalıştırmaz", () => {
    const fixture = unitDetail();
    fixture.assessment.unitName = '<img src=x onerror="alert(1)">';
    const html = buildUnitReportHtml(fixture);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("Excel'de kuruluş adını formül yerine metin hücresi olarak yazar", () => {
    const fixture = unitDetail();
    fixture.assessment.unitName = "=HYPERLINK(\"https://example.com\")";
    const sheet = XLSX.utils.aoa_to_sheet(unitReportTables(fixture)["Özet"]);
    expect(sheet.B2.t).toBe("s");
    expect(sheet.B2.f).toBeUndefined();
  });
  it("kuruluşun hedefini ve 100 üzerinden puanı panodaki gibi rapora koyar; hedef yoksa uydurmaz", () => {
    const view = assessmentView(unitDetail(), "manager", () => true, {
      overall: { percentage: 70, targetDate: "2027-12-31T20:59:59.999Z" }, categories: { "category-1": { percentage: 60, targetDate: null } },
    });
    const tables = unitReportTables(view);
    expect(tables["Özet"]).toContainEqual(["Mevcut puan (100 üzerinden)", 40]);
    expect(tables["Özet"]).toContainEqual(["Hedef (100 üzerinden)", 70]);
    expect(tables["Kategoriler"][1].slice(-2)).toEqual([40, 60]);
    const none = unitReportTables(assessmentView());
    expect(none["Özet"].some(row => row[0] === "Hedef (100 üzerinden)")).toBe(false);
    expect(none["Kategoriler"][1].at(-1)).toBe("");
  });
});
