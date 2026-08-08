import { describe, expect, it } from "vitest";
import { nextCopyName, stripCopySuffix, summarizeDuplicate } from "../survey-duplicate";

describe("stripCopySuffix", () => {
  it("kopya ekini temizler", () => {
    expect(stripCopySuffix("Tersane 2026 (kopya)")).toBe("Tersane 2026");
    expect(stripCopySuffix("Tersane 2026 (kopya 3)")).toBe("Tersane 2026");
  });

  it("ek yoksa dokunmaz", () => {
    expect(stripCopySuffix("Tersane 2026")).toBe("Tersane 2026");
    // Ortadaki parantez ad'ın kendisidir, ek değil.
    expect(stripCopySuffix("Tersane (Demo) 2026")).toBe("Tersane (Demo) 2026");
  });

  it("baştaki ve sondaki boşlukları alır", () => {
    // Üretimdeki anket adı "Tersane 2026 " — sonda boşlukla kaydedilmiş.
    expect(stripCopySuffix("Tersane 2026 ")).toBe("Tersane 2026");
  });
});

describe("nextCopyName", () => {
  it("ilk kopyaya ek koyar", () => {
    expect(nextCopyName("Tersane 2026", [])).toBe("Tersane 2026 (kopya)");
  });

  it("ad doluysa numaralandırır", () => {
    expect(nextCopyName("Tersane 2026", ["Tersane 2026", "Tersane 2026 (kopya)"])).toBe(
      "Tersane 2026 (kopya 2)"
    );
  });

  it("kopyanın kopyası eki üst üste bindirmez", () => {
    // "X (kopya) (kopya)" okunmaz; numaraya devam edilir.
    expect(nextCopyName("Tersane 2026 (kopya)", ["Tersane 2026 (kopya)"])).toBe(
      "Tersane 2026 (kopya 2)"
    );
  });

  it("boşluk ve büyük/küçük harf farkını çakışma sayar", () => {
    expect(nextCopyName("Tersane 2026", ["  tersane 2026 (KOPYA)  "])).toBe(
      "Tersane 2026 (kopya 2)"
    );
  });

  it("arada boşalan numarayı kullanır", () => {
    expect(
      nextCopyName("Anket", ["Anket (kopya)", "Anket (kopya 3)"])
    ).toBe("Anket (kopya 2)");
  });
});

describe("summarizeDuplicate", () => {
  it("tek cümlede özetler", () => {
    expect(
      summarizeDuplicate({
        categories: 3,
        subCategories: 13,
        subLevels: 0,
        questions: 71,
        recommendations: 8,
        scopeRules: 0,
        benchmarks: 0,
      })
    ).toBe("3 kategori, 13 bölüm, 71 soru, 8 öneri kopyalandı.");
  });
});
