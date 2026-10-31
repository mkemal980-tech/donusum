import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { assessmentView, memberAssessmentView, unitDetail } from "../../test-fixtures/unit-dashboard";
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
    expect(tables["Kategoriler"][1].slice(-3)).toEqual([40, "Gelişen", 60]);
    const none = unitReportTables(assessmentView());
    expect(none["Özet"].some(row => row[0] === "Hedef (100 üzerinden)")).toBe(false);
    expect(none["Kategoriler"][1].at(-1)).toBe("");
  });
  it("alt kategorilerin puanını, seviyesini ve üst seviyeye kalan farkı panodaki gibi yazar", () => {
    const detail = unitDetail();
    const [energy] = detail.categories[0].sections;
    detail.categories[0].sections.push(
      { ...energy, id: "section-3", name: "Emisyonlar", currentPercentage: 86.04 },
      { ...energy, id: null, name: "Kategori soruları", currentPercentage: null },
    );
    const tables = unitReportTables(assessmentView(detail));
    expect(tables["Özet"]).toContainEqual(["Seviye", "Gelişen"]);
    expect(tables["Alt kategoriler"].slice(1)).toEqual([
      ["Çevresel dönüşüm", "Enerji yönetimi", 40, "Gelişen", "Olgun", 20, 1, 1],
      ["Çevresel dönüşüm", "Atık yönetimi", "", "Cevap yok", "", "", 0, 1],
      ["Çevresel dönüşüm", "Emisyonlar", 86, "Lider", "En üst seviye", "", 1, 1],
    ]);
    expect(buildUnitReportHtml(assessmentView(detail))).toContain("<h2>Alt kategoriler</h2>");
  });
  it("çalışanın raporunda başka üyeye atanmış alt kategorinin puanını verir, cevap sayısını vermez", () => {
    const view = memberAssessmentView();
    view.categories[0].sections[1].currentPercentage = 55;
    expect(unitReportTables(view)["Alt kategoriler"][2]).toEqual(["Çevresel dönüşüm", "Atık yönetimi", 55, "Gelişen", "Olgun", 5, "", 1]);
  });
});
