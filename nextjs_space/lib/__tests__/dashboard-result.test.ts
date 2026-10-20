import { describe, expect, it } from "vitest";
import { getDashboardResultState } from "../dashboard-result";

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
