import { describe, expect, it } from "vitest";
import {
  maturityFromPercentage,
  median,
  memberStatus,
} from "@/lib/organization-campaign";

describe("organization campaign dashboard helpers", () => {
  it("taslak cevabı kesin sonuç saymaz", () => {
    expect(memberStatus({ assessmentStatus: "IN_PROGRESS", responseCount: 8 })).toBe("IN_PROGRESS");
    expect(memberStatus({ assessmentStatus: null, responseCount: 0 })).toBe("NOT_STARTED");
    expect(memberStatus({ assessmentStatus: "SUBMITTED", responseCount: 3 })).toBe("SUBMITTED");
  });

  it("tek ve çift elemanlı dizilerde medyanı hesaplar", () => {
    expect(median([])).toBeNull();
    expect(median([70])).toBe(70);
    expect(median([90, 20, 70])).toBe(70);
    expect(median([20, 40, 60, 80])).toBe(50);
  });

  it("olgunluk eşiklerini yüzdeyle aynı sınırda tutar", () => {
    expect(maturityFromPercentage(0)).toBe("Başlangıç");
    expect(maturityFromPercentage(20)).toBe("Farkındalık");
    expect(maturityFromPercentage(40)).toBe("Gelişen");
    expect(maturityFromPercentage(60)).toBe("Olgun");
    expect(maturityFromPercentage(80)).toBe("Lider");
  });
});
