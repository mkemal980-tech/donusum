import { describe, expect, it } from "vitest";
import {
  buildDashboardResultSummary,
  getDashboardResultState,
  getNextMaturityLevel,
} from "../dashboard-result";

describe("dashboard result state", () => {
  it("gönderilmiş değerlendirmeyi cevap sayısından bağımsız kesin kabul eder", () => {
    expect(
      getDashboardResultState({
        answeredQuestions: 5,
        totalQuestions: 10,
        submitted: true,
        isCoordinator: false,
      })
    ).toBe("SUBMITTED");
  });

  it("tamamlanan değerlendirmede gönderim yetkisini ayırır", () => {
    expect(
      getDashboardResultState({
        answeredQuestions: 10,
        totalQuestions: 10,
        submitted: false,
        isCoordinator: true,
      })
    ).toBe("READY_TO_SUBMIT");
    expect(
      getDashboardResultState({
        answeredQuestions: 10,
        totalQuestions: 10,
        submitted: false,
        isCoordinator: false,
      })
    ).toBe("AWAITING_SUBMISSION");
  });

  it("boş ve kısmi değerlendirmeleri ayırır", () => {
    expect(
      getDashboardResultState({
        answeredQuestions: 0,
        totalQuestions: 10,
        submitted: false,
        isCoordinator: true,
      })
    ).toBe("NOT_STARTED");
    expect(
      getDashboardResultState({
        answeredQuestions: 4,
        totalQuestions: 10,
        submitted: false,
        isCoordinator: true,
      })
    ).toBe("IN_PROGRESS");
  });
});

describe("dashboard result summary", () => {
  it("ölçülen en yüksek ve en düşük kategoriyi açıklar", () => {
    expect(
      buildDashboardResultSummary({
        score: 64.2,
        maturityLabel: "Olgun",
        state: "SUBMITTED",
        categories: [
          { name: "Sosyal", percentage: 46 },
          { name: "Çevresel", percentage: 75 },
          { name: "Yönetişim", percentage: 71 },
        ],
      })
    ).toBe(
      "Kesin kurumsal olgunluk puanınız %64 ile Olgun seviyesindedir. Çevresel en yüksek, Sosyal ise en düşük puanlı kategorinizdir."
    );
  });

  it("kategori yokken yalnızca genel sonucu açıklar", () => {
    expect(
      buildDashboardResultSummary({
        score: 42,
        maturityLabel: "Gelişen",
        state: "IN_PROGRESS",
        categories: [],
      })
    ).toBe("Mevcut taslak kurumsal olgunluk puanınız %42 ile Gelişen seviyesindedir.");
  });
});

describe("next maturity level", () => {
  it("1-5 ölçeğinde bir sonraki seviye farkını hesaplar", () => {
    expect(getNextMaturityLevel(3)).toEqual({ label: "Olgun", pointsNeeded: 0.4 });
    expect(getNextMaturityLevel(4.1)).toEqual({ label: "Lider", pointsNeeded: 0.1 });
  });

  it("lider seviyesinde sonraki seviye döndürmez", () => {
    expect(getNextMaturityLevel(4.2)).toBeNull();
    expect(getNextMaturityLevel(5)).toBeNull();
  });
});
