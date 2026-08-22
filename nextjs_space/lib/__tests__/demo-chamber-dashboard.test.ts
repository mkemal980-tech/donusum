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

  it("E-S-G ağırlıklı skoru genel sonuçla aynı tutar", () => {
    const weightedScore = demo.esgPillars.reduce(
      (sum, pillar) => sum + pillar.score * (pillar.weight / 100),
      0
    );
    expect(demo.esgPillars.reduce((sum, pillar) => sum + pillar.weight, 0)).toBe(100);
    expect(weightedScore).toBeCloseTo(demo.results.overallScore, 5);
  });

  it("Ironman dağılımını 2.000 yanıta kapatır ve kadranı eşikle doğrular", () => {
    expect(demo.ironman.distribution.reduce((sum, item) => sum + item.count, 0)).toBe(2000);
    expect(demo.ironman.distribution.reduce((sum, item) => sum + item.percentage, 0)).toBeCloseTo(100);
    expect(demo.ironman.current.velocity).toBeGreaterThanOrEqual(demo.ironman.threshold);
    expect(demo.ironman.current.endurance).toBeGreaterThanOrEqual(demo.ironman.threshold);
    expect(demo.ironman.quadrant).toBe("IRONMAN");
    expect(demo.ironman.questionMix.velocity + demo.ironman.questionMix.endurance).toBe(
      demo.campaign.questionCount
    );
  });

  it("öneri portföyü sayaçlarını ve erişim sınırlarını tutarlı tutar", () => {
    const summary = demo.recommendationSummary;
    expect(summary.byStrategy.quickWins + summary.byStrategy.projects + summary.byStrategy.bigBets).toBe(summary.total);
    expect(summary.byStatus.ready + summary.byStatus.inProgress + summary.byStatus.planned).toBe(summary.total);
    expect(new Set(demo.recommendations.map((recommendation) => recommendation.id)).size).toBe(demo.recommendations.length);
    for (const recommendation of demo.recommendations) {
      expect(recommendation.memberReach).toBeLessThanOrEqual(demo.participation.submitted);
      expect(recommendation.impact).toBeGreaterThanOrEqual(0);
      expect(recommendation.impact).toBeLessThanOrEqual(10);
    }
  });
});
