import { describe, expect, it } from "vitest";
import { demoChamberDashboard as demo } from "@/lib/demo-chamber-dashboard";

describe("süper admin ticaret odası demosu", () => {
  it("tam olarak 2.000 tamamlanmış yanıt gösterir", () => {
    expect(demo.participation.submitted).toBe(2000);
    expect(
      demo.participation.submitted +
        demo.participation.inProgress +
        demo.participation.notStarted
    ).toBe(demo.participation.invited);
    expect(demo.responseTrend.at(-1)?.cumulative).toBe(2000);
  });

  it("toplu kırılımlarda 2.000 yanıtı eksiksiz korur", () => {
    expect(demo.maturityDistribution.reduce((sum, item) => sum + item.count, 0)).toBe(2000);
    expect(demo.companySizes.reduce((sum, item) => sum + item.count, 0)).toBe(2000);
    expect(demo.sectors.reduce((sum, item) => sum + item.responses, 0)).toBe(2000);
    expect(demo.maturityDistribution.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
  });

  it("puan ve katılım değerlerini geçerli aralıkta tutar", () => {
    for (const category of demo.categories) {
      expect(category.score).toBeGreaterThanOrEqual(0);
      expect(category.score).toBeLessThanOrEqual(100);
      expect(category.benchmark).toBeGreaterThanOrEqual(0);
      expect(category.benchmark).toBeLessThanOrEqual(100);
    }
    for (const sector of demo.sectors) {
      expect(sector.score).toBeGreaterThanOrEqual(0);
      expect(sector.score).toBeLessThanOrEqual(100);
      expect(sector.participation).toBeGreaterThanOrEqual(0);
      expect(sector.participation).toBeLessThanOrEqual(100);
    }
  });
});
