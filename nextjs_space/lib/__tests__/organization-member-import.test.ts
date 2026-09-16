import { describe, expect, it } from "vitest";
import {
  MEMBER_IMPORT_TEMPLATE,
  parseMemberImportCsv,
} from "@/lib/organization-member-import";

describe("organization member CSV import", () => {
  it("Türkçe şablonu ve NACE kodlarını ayrıştırır", () => {
    const result = parseMemberImportCsv(`\uFEFF${MEMBER_IMPORT_TEMPLATE}`);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        rowNumber: 2,
        memberName: "Örnek Tersane",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        email: "ayse@example.com",
        sectorCode: "C",
        subSectorCode: "30.1",
      },
    ]);
  });

  it("Türkçe Excel çıktısındaki noktalı virgülü destekler", () => {
    const result = parseMemberImportCsv(
      "üye kuruluş;ad;soyad;e-posta;sektör kodu;alt sektör kodu\n" +
      "Mavi Deniz;Mehmet;Kaya;MEHMET@EXAMPLE.COM;C;30.1"
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      memberName: "Mavi Deniz",
      email: "mehmet@example.com",
      sectorCode: "C",
      subSectorCode: "30.1",
    });
  });

  it("aynı e-postayı ve eksik zorunlu alanları reddeder", () => {
    const result = parseMemberImportCsv(
      "uye_kurulus,ad,soyad,e_posta,sektor_kodu,alt_sektor_kodu\n" +
      "Birinci,Ali,,ortak@example.com,C,30.1\n" +
      ",Veli,,ortak@example.com,,"
    );

    expect(result.errors).toContain("3. satır: Üye kuruluş adı gerekli.");
    expect(result.errors).toContain("3. satır: Sektör kodu gerekli.");
    expect(result.errors).toContain("3. satır: E-posta CSV içinde tekrar ediyor.");
  });

  it("boş dosyayı reddeder", () => {
    expect(parseMemberImportCsv("  ").errors).toEqual(["CSV dosyası boş."]);
  });
});
