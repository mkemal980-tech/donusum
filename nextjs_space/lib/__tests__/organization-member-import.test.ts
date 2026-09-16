import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  MEMBER_IMPORT_EXAMPLE_EMAIL,
  buildMemberImportWorkbook,
  parseMemberImportExcel,
} from "@/lib/organization-member-import";

function workbookFromRows(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Üye Aktarımı");
  return new Uint8Array(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe("organization member Excel import", () => {
  it("iki sayfalı şablon, tek örnek satır ve doldurma rehberi üretir", () => {
    const buffer = buildMemberImportWorkbook([
      { naicsCode: "C", name: "İmalat", subSectors: [{ name: "[30.1] Gemi, tekne ve yüzer yapı inşası" }] },
    ]);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    expect(workbook.SheetNames).toEqual(["Üye Aktarımı", "Doldurma Rehberi"]);
    const importRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Üye Aktarımı"], { header: 1 });
    expect(importRows).toHaveLength(2);
    expect(importRows[0]).toEqual([
      "uye_kurulus",
      "ad",
      "soyad",
      "e_posta",
      "sektor_kodu",
      "alt_sektor_kodu",
    ]);
    expect(importRows[1]).toContain(MEMBER_IMPORT_EXAMPLE_EMAIL);

    const guide = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Doldurma Rehberi"], { header: 1 });
    expect(guide.flat()).toContain("ÜYE AKTARIM ŞABLONU — DOLDURMA REHBERİ");
    expect(guide.flat()).toContain("30.1");
    expect(guide.flat()).toContain("[30.1] Gemi, tekne ve yüzer yapı inşası");
  });

  it("Türkçe başlıkları ve NACE kodlarını ayrıştırır", () => {
    const result = parseMemberImportExcel(workbookFromRows([
      ["üye kuruluş", "ad", "soyad", "e-posta", "sektör kodu", "alt sektör kodu"],
      ["Mavi Deniz", "Mehmet", "Kaya", "MEHMET@EXAMPLE.COM", "C", "30.1"],
    ]));

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual({
      rowNumber: 2,
      memberName: "Mavi Deniz",
      firstName: "Mehmet",
      lastName: "Kaya",
      email: "mehmet@example.com",
      sectorCode: "C",
      subSectorCode: "30.1",
    });
  });

  it("örnek satırı, aynı e-postayı ve eksik zorunlu alanları reddeder", () => {
    const result = parseMemberImportExcel(workbookFromRows([
      ["uye_kurulus", "ad", "soyad", "e_posta", "sektor_kodu", "alt_sektor_kodu"],
      ["Örnek Tersane", "Ayşe", "Yılmaz", MEMBER_IMPORT_EXAMPLE_EMAIL, "C", "30.1"],
      ["Birinci", "Ali", "", "ortak@example.com", "C", "30.1"],
      ["", "Veli", "", "ortak@example.com", "", ""],
    ]));

    expect(result.errors).toContain("2. satır: Örnek satırı silin veya gerçek bilgilerle değiştirin.");
    expect(result.errors).toContain("4. satır: Üye kuruluş adı gerekli.");
    expect(result.errors).toContain("4. satır: Sektör kodu gerekli.");
    expect(result.errors).toContain("4. satır: E-posta Excel içinde tekrar ediyor.");
  });

  it("değiştirilmiş başlıkları reddeder", () => {
    const result = parseMemberImportExcel(workbookFromRows([
      ["uye_kurulus", "ad", "e_posta", "sektor_kodu"],
      ["Mavi Deniz", "Mehmet", "mehmet@example.com", "C"],
    ]));

    expect(result.errors[0]).toContain("soyad");
    expect(result.errors[0]).toContain("alt_sektor_kodu");
  });

  it("boş dosyayı reddeder", () => {
    expect(parseMemberImportExcel(new Uint8Array()).errors).toEqual(["Excel dosyası boş."]);
  });
});
