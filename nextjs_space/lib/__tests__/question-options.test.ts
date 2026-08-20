import { describe, expect, it } from "vitest";
import {
  formatConditionalOptions,
  formatScoredOptions,
  parseOptionScore,
  parseScoredOptions,
  slugifyOptionValue,
} from "../question-options";

describe("parseOptionScore", () => {
  it("noktalı ve virgüllü ondalıkları kabul eder", () => {
    expect(parseOptionScore("2.5")).toBe(2.5);
    expect(parseOptionScore("2,5")).toBe(2.5);
    expect(parseOptionScore(" 5 ")).toBe(5);
    expect(parseOptionScore("0")).toBe(0);
  });

  it("sayı olmayanı sessizce sayıya çevirmez", () => {
    expect(parseOptionScore("3abc")).toBeNull();
    expect(parseOptionScore("")).toBeNull();
    expect(parseOptionScore("çok")).toBeNull();
  });
});

describe("slugifyOptionValue", () => {
  it("Türkçe karakterleri çevirir", () => {
    expect(slugifyOptionValue("Detaylı takip")).toBe("detayli_takip");
    expect(slugifyOptionValue("İyileştirme")).toBe("iyilestirme");
    expect(slugifyOptionValue("Çok Yüksek")).toBe("cok_yuksek");
  });
});

describe("parseScoredOptions", () => {
  it("önerilen tek satır biçimini ayrıştırır", () => {
    const { options, errors } = parseScoredOptions("Düşük = 1; Orta = 3; Yüksek = 5");

    expect(errors).toEqual([]);
    expect(options).toEqual([
      { value: "dusuk", label: "Düşük", score: 1 },
      { value: "orta", label: "Orta", score: 3 },
      { value: "yuksek", label: "Yüksek", score: 5 },
    ]);
  });

  it("eski deger|etiket|puan biçimini aynı sonuçla ayrıştırır", () => {
    const { options, errors } = parseScoredOptions("dusuk|Düşük|1\norta|Orta|3\nyuksek|Yüksek|5");

    expect(errors).toEqual([]);
    expect(options).toEqual([
      { value: "dusuk", label: "Düşük", score: 1 },
      { value: "orta", label: "Orta", score: 3 },
      { value: "yuksek", label: "Yüksek", score: 5 },
    ]);
  });

  it("etiket|puan biçimini ve satır sonlarını kabul eder", () => {
    const { options, errors } = parseScoredOptions("Düşük|1\r\nOrta|3");

    expect(errors).toEqual([]);
    expect(options).toEqual([
      { value: "dusuk", label: "Düşük", score: 1 },
      { value: "orta", label: "Orta", score: 3 },
    ]);
  });

  it("ondalık puanları virgülle de okur", () => {
    const { options } = parseScoredOptions("Kısmen = 2,5");
    expect(options[0].score).toBe(2.5);
  });

  it("aynı etiketten türeyen value'ları benzersizleştirir", () => {
    const { options } = parseScoredOptions("Var = 1; Var = 3");
    expect(options.map((option) => option.value)).toEqual(["var", "var_2"]);
  });

  it("puanı olmayan seçenek için hata döner", () => {
    const { options, errors } = parseScoredOptions("Düşük; Orta; Yüksek");

    expect(options).toEqual([]);
    expect(errors).toHaveLength(3);
    expect(errors[0]).toContain("Etiket = puan");
  });

  it("puanı sayı olmayan seçenek için hata döner", () => {
    const { options, errors } = parseScoredOptions("Düşük = az");

    expect(options).toEqual([]);
    expect(errors[0]).toContain("puan sayı değil");
  });

  it("negatif puanı reddeder", () => {
    const { errors } = parseScoredOptions("Düşük = -1");
    expect(errors[0]).toContain("negatif");
  });

  it("boş girdide hata üretmez", () => {
    expect(parseScoredOptions("")).toEqual({ options: [], errors: [] });
    expect(parseScoredOptions(undefined)).toEqual({ options: [], errors: [] });
    expect(parseScoredOptions(null)).toEqual({ options: [], errors: [] });
  });

  it("index modunda value'ları konuma göre üretir", () => {
    const { options } = parseScoredOptions("ISO 9001 = 2; ISO 14001 = 2", { valueMode: "index" });

    expect(options).toEqual([
      { value: "option_1", label: "ISO 9001", score: 2 },
      { value: "option_2", label: "ISO 14001", score: 2 },
    ]);
  });

  it("index modunda eski etiket|puan biçimiyle aynı sonucu verir", () => {
    const { options } = parseScoredOptions("ISO 9001|5\nISO 14001|10.5", { valueMode: "index" });

    expect(options).toEqual([
      { value: "option_1", label: "ISO 9001", score: 5 },
      { value: "option_2", label: "ISO 14001", score: 10.5 },
    ]);
  });
});

describe("formatScoredOptions", () => {
  it("value etiketten türetilebiliyorsa kısa biçimi kullanır", () => {
    const text = formatScoredOptions([
      { value: "dusuk", label: "Düşük", score: 1 },
      { value: "orta", label: "Orta", score: 3 },
    ]);

    expect(text).toBe("Düşük = 1\nOrta = 3");
  });

  it("özel value'ları korur — mevcut cevapların eşleşmesi bozulmasın", () => {
    const text = formatScoredOptions([{ value: "0-25", label: "0-25%", score: 1 }]);

    expect(text).toBe("0-25|0-25%|1");
    expect(parseScoredOptions(text).options).toEqual([{ value: "0-25", label: "0-25%", score: 1 }]);
  });

  it("kısa biçim tur atınca aynı seçeneği verir", () => {
    const original = [{ value: "detayli_takip", label: "Detaylı takip", score: 4 }];
    expect(parseScoredOptions(formatScoredOptions(original)).options).toEqual(original);
  });
});

describe("formatConditionalOptions", () => {
  it("konumsal value'ları göstermez", () => {
    const text = formatConditionalOptions([
      { value: "option_1", label: "ISO 9001", score: 2 },
      { value: "option_2", label: "ISO 14001", score: 2 },
    ]);

    expect(text).toBe("ISO 9001 = 2\nISO 14001 = 2");
  });
});
