import { describe, expect, it } from "vitest";
import { isLocked, readinessSummary, submissionReadiness } from "../submission";

describe("isLocked", () => {
  it("yalnızca gönderilmiş değerlendirme kilitlidir", () => {
    expect(isLocked("SUBMITTED")).toBe(true);
    expect(isLocked("IN_PROGRESS")).toBe(false);
    // Değerlendirme henüz açılmamışsa (kayıt yok) kilit de yoktur.
    expect(isLocked(null)).toBe(false);
    expect(isLocked(undefined)).toBe(false);
  });
});

describe("submissionReadiness", () => {
  const sections = [
    { name: "Atık", questionCount: 10, answeredCount: 10 },
    { name: "Enerji", questionCount: 8, answeredCount: 3 },
    { name: "Sosyal", questionCount: 6, answeredCount: 0 },
  ];

  it("toplamı ve doluluğu çıkarır", () => {
    const readiness = submissionReadiness(sections);

    expect(readiness.totalQuestions).toBe(24);
    expect(readiness.answeredQuestions).toBe(13);
    expect(readiness.percentage).toBe(54);
    expect(readiness.complete).toBe(false);
    expect(readiness.missingQuestions).toBe(11);
  });

  it("eksik bölümleri en çok eksiği olandan sıralar", () => {
    // Koordinatörün ilk arayacağı yer en çok eksiği olan bölüm.
    expect(submissionReadiness(sections).incompleteSections).toEqual([
      { name: "Sosyal", missing: 6 },
      { name: "Enerji", missing: 5 },
    ]);
  });

  it("hepsi doluysa eksik listesi boştur", () => {
    const readiness = submissionReadiness([
      { name: "Atık", questionCount: 4, answeredCount: 4 },
    ]);

    expect(readiness.complete).toBe(true);
    expect(readiness.incompleteSections).toEqual([]);
    expect(readiness.percentage).toBe(100);
  });

  it("sorusu olmayan anket eksik sayılmaz", () => {
    // Sıfıra bölme yok; boş anket "tam" görünür ve gönderim engellenmez.
    const readiness = submissionReadiness([]);

    expect(readiness.percentage).toBe(100);
    expect(readiness.complete).toBe(true);
  });

  it("beklenenden çok cevap eksiği negatife düşürmez", () => {
    // Bölümden soru çıkarılırsa cevap sayısı soru sayısını aşabilir.
    const readiness = submissionReadiness([
      { name: "Atık", questionCount: 3, answeredCount: 5 },
      { name: "Enerji", questionCount: 4, answeredCount: 1 },
    ]);

    expect(readiness.answeredQuestions).toBe(4);
    expect(readiness.missingQuestions).toBe(3);
    expect(readiness.incompleteSections).toEqual([{ name: "Enerji", missing: 3 }]);
  });
});

describe("readinessSummary", () => {
  it("eksikleri sayıyla söyler", () => {
    const readiness = submissionReadiness([
      { name: "Atık", questionCount: 10, answeredCount: 10 },
      { name: "Enerji", questionCount: 8, answeredCount: 3 },
      { name: "Sosyal", questionCount: 6, answeredCount: 0 },
    ]);

    expect(readinessSummary(readiness)).toBe("2 bölümde 11 soru boş.");
  });

  it("tamamlanmışı ve boş anketi ayırır", () => {
    expect(
      readinessSummary(submissionReadiness([{ name: "Atık", questionCount: 2, answeredCount: 2 }]))
    ).toBe("Bütün sorular cevaplandı.");
    expect(readinessSummary(submissionReadiness([]))).toBe("Bu ankette cevaplanacak soru yok.");
  });
});
