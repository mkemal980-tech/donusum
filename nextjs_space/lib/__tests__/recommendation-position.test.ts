import { describe, expect, it } from "vitest";
import {
  MAX_BUBBLE_RADIUS,
  MIN_BUBBLE_RADIUS,
  bubbleRadiusFor,
  derivePosition,
  spreadOverlapping,
} from "../recommendation-position";

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

describe("bubbleRadiusFor", () => {
  it("1-10 aralığının tamamını ayırt edilebilir yarıçapa yayar", () => {
    // Eski formül (max(15, min(40, etki*3))) 1-5 arasını aynı boyutta
    // gösteriyordu; artık her adım farklı olmalı.
    const radii = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(bubbleRadiusFor);
    const unique = new Set(radii.map((radius) => Math.round(radius * 100)));

    expect(unique.size).toBe(10);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });

  it("uçları sabit tutar", () => {
    expect(bubbleRadiusFor(1)).toBe(MIN_BUBBLE_RADIUS);
    expect(bubbleRadiusFor(10)).toBe(MAX_BUBBLE_RADIUS);
  });

  it("aralık dışı ve boş değerleri sınırlar", () => {
    expect(bubbleRadiusFor(0)).toBe(MIN_BUBBLE_RADIUS);
    expect(bubbleRadiusFor(50)).toBe(MAX_BUBBLE_RADIUS);
    expect(bubbleRadiusFor(null)).toBeGreaterThan(MIN_BUBBLE_RADIUS);
  });
});

describe("spreadOverlapping", () => {
  it("aynı noktadaki baloncukları ayırır", () => {
    const spread = spreadOverlapping([
      { id: "a", xPosition: 5, yPosition: 5 },
      { id: "b", xPosition: 5, yPosition: 5 },
      { id: "c", xPosition: 5, yPosition: 5 },
    ]);

    const points = new Set(spread.map((item) => `${item.xPosition},${item.yPosition}`));
    expect(points.size).toBe(3);
    expect(spread[0]).toEqual({ id: "a", xPosition: 5, yPosition: 5 });
  });

  it("farklı noktalardaki baloncuklara dokunmaz", () => {
    const items = [
      { id: "a", xPosition: 2, yPosition: 3 },
      { id: "b", xPosition: 8, yPosition: 7 },
    ];
    expect(spreadOverlapping(items)).toEqual(items);
  });

  it("grafik sınırları içinde kalır", () => {
    const items = Array.from({ length: 15 }, (_, index) => ({ id: String(index), xPosition: 9.5, yPosition: 9.5 }));

    for (const item of spreadOverlapping(items)) {
      expect(item.xPosition).toBeGreaterThanOrEqual(0);
      expect(item.xPosition).toBeLessThanOrEqual(10);
      expect(item.yPosition).toBeGreaterThanOrEqual(0);
      expect(item.yPosition).toBeLessThanOrEqual(10);
    }
  });

  it("aynı liste için her zaman aynı yerleşimi verir", () => {
    const items = [
      { id: "a", xPosition: 5, yPosition: 5 },
      { id: "b", xPosition: 5, yPosition: 5 },
    ];
    expect(spreadOverlapping(items)).toEqual(spreadOverlapping(items));
  });
});
