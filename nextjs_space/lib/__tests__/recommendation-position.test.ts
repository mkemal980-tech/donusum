import { describe, expect, it } from "vitest";
import { derivePosition } from "../recommendation-position";

describe("derivePosition", () => {
  it("stratejileri X ekseninde ayrı bantlara koyar", () => {
    const quick = derivePosition({ strategicType: "QUICK_WIN", timeframe: "MEDIUM_TERM", estimatedImpact: 5 });
    const project = derivePosition({ strategicType: "PROJECT", timeframe: "MEDIUM_TERM", estimatedImpact: 5 });
    const bigBet = derivePosition({ strategicType: "BIG_BET", timeframe: "MEDIUM_TERM", estimatedImpact: 5 });

    expect(bigBet.xPosition).toBeLessThan(project.xPosition);
    expect(project.xPosition).toBeLessThan(quick.xPosition);
  });

  it("kısa vade aciliyet ucuna, uzun vade kaynak ucuna kaydırır", () => {
    const short = derivePosition({ strategicType: "PROJECT", timeframe: "SHORT_TERM", estimatedImpact: 5 });
    const medium = derivePosition({ strategicType: "PROJECT", timeframe: "MEDIUM_TERM", estimatedImpact: 5 });
    const long = derivePosition({ strategicType: "PROJECT", timeframe: "LONG_TERM", estimatedImpact: 5 });

    expect(long.xPosition).toBeLessThan(medium.xPosition);
    expect(medium.xPosition).toBeLessThan(short.xPosition);
  });

  it("Y eksenini tahmini etkiden alır", () => {
    expect(derivePosition({ estimatedImpact: 9 }).yPosition).toBe(9);
    expect(derivePosition({ estimatedImpact: 2 }).yPosition).toBe(2);
  });

  it("aralık dışı ve eksik değerleri güvenli aralığa çeker", () => {
    const high = derivePosition({ strategicType: "QUICK_WIN", timeframe: "SHORT_TERM", estimatedImpact: 99 });
    expect(high.xPosition).toBeLessThanOrEqual(9.5);
    expect(high.yPosition).toBeLessThanOrEqual(9.5);

    const empty = derivePosition({});
    expect(empty.xPosition).toBeGreaterThan(0);
    expect(empty.yPosition).toBeGreaterThan(0);
  });

  it("aynı girdi için her zaman aynı konumu verir", () => {
    const input = { strategicType: "PROJECT", timeframe: "SHORT_TERM", estimatedImpact: 7 };
    expect(derivePosition(input)).toEqual(derivePosition(input));
  });
});
