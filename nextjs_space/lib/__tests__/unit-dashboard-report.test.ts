import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { unitDetail } from "../../test-fixtures/unit-dashboard";
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
});
