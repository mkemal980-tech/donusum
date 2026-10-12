import { unitDetail, unitRow } from "./unit-dashboard";
import { buildUnitManagementAnalytics, managementScopeIds, type ManagementBasis, type ManagementUnit } from "../lib/unit-management-analytics";
import type { UnitManagementDashboard } from "../lib/unit-management";

export const managementUnits: ManagementUnit[] = [
  { id: "root", name: "Dönüşüm birimi", parentId: null, description: null, sectorId: "sector-a", subSectorId: null, sectorName: "İmalat", employeeCount: null, activeUserCount: 0 },
  { id: "unit-a", name: "Üretim birimi", parentId: "root", description: null, sectorId: "sector-a", subSectorId: null, sectorName: "İmalat", employeeCount: 270, activeUserCount: 3 },
  { id: "unit-b", name: "Hizmet birimi", parentId: "root", description: null, sectorId: "sector-b", subSectorId: null, sectorName: "Hizmet", employeeCount: 12, activeUserCount: 2 },
  { id: "unit-c", name: "Yeni birim", parentId: "root", description: null, sectorId: null, subSectorId: null, sectorName: null, employeeCount: null, activeUserCount: 1 },
];
export const managementRows = [
  { ...unitRow("assessment-a", "unit-a", "Üretim birimi"), status: "SUBMITTED" as const, score: 80, maturityScore: 4.2, submittedAt: "2026-10-01T12:00:00Z", responseCount: 6, totalQuestions: 6, completionPercentage: 100 },
  { ...unitRow("assessment-b", "unit-b", "Hizmet birimi"), score: 60, maturityScore: 3.4, responseCount: 4, totalQuestions: 6, completionPercentage: 67 },
  { ...unitRow("pending-c", "unit-c", "Yeni birim"), assessmentId: null, score: null, maturityScore: null, responseCount: 0, status: "NOT_STARTED" as const, completionPercentage: 0 },
];
export function managementDetails() {
  return managementRows.filter(row => row.assessmentId).map((row, index) => {
    const detail = unitDetail(row.id, row.unitId, row.unitName);
    detail.assessment.status = row.status;
    detail.assessment.submittedAt = row.submittedAt;
    detail.scores.overallPercentage = index ? 60 : 80;
    detail.scores.overallScore = index ? 3.4 : 4.2;
    detail.scores.baselineOverallPercentage = index ? 55 : 70;
    detail.scores.baselineOverallScore = index ? 3.2 : 3.8;
    detail.scores.deltaPercentage = index ? 5 : 10;
    detail.scores.delta = index ? 0.2 : 0.4;
    detail.scores.velocityScore = index ? 3.8 : 4.6;
    detail.scores.enduranceScore = index ? 3.0 : 3.8;
    detail.scores.velocityWeight = 3; detail.scores.enduranceWeight = 3;
    detail.scores.quadrant = "IRONMAN";
    detail.questionMix = { velocity: 3, endurance: 3 };
    detail.categories = ["Çevresel", "Sosyal", "Yönetişim"].map((name, i) => {
      const current = index ? [45, 75, 75][i] : [75, 85, 85][i];
      const base = current - (index ? 5 : 10);
      return { ...structuredClone(detail.categories[0]), id: "category-" + i, name, weightPercentage: i === 0 ? 50 : 25,
        currentPercentage: current, basePercentage: base, currentScore: 1 + current / 25, baseScore: 1 + base / 25,
        sections: detail.categories[0].sections.map(section => ({ ...section, id: section.id + "-" + i, currentPercentage: section.currentPercentage === null ? null : current })) };
    });
    for (const rec of detail.recommendations) rec.categoryId = rec.id === "rec-1" ? "category-0" : "category-2";
    detail.recommendations[0].fullContribution = index ? 0.8 : 0.4;
    return detail;
  });
}
export function managementDashboard({ unitId = "root", basis = "answered", includeDescendants = true, empty = false, units = managementUnits }: { unitId?: string; basis?: ManagementBasis; includeDescendants?: boolean; empty?: boolean; units?: ManagementUnit[] } = {}): UnitManagementDashboard {
  const ids = managementScopeIds(units, unitId, includeDescendants);
  const selectedUnits = units.filter(unit => ids.includes(unit.id));
  const rows = empty ? [] : managementRows.filter(row => ids.includes(row.unitId));
  return {
    selection: { unitId, unitName: managementUnits.find(unit => unit.id === unitId)?.name ?? "Tüm yönetilen birimler", surveyId: empty ? null : "survey-1", surveyName: empty ? null : "Birim olgunluk değerlendirmesi", periodId: empty ? null : "period-2026", periodName: empty ? null : "2026 dönemi", basis, includeDescendants },
    options: { units, surveys: empty ? [] : [{ id: "survey-1", name: "Birim olgunluk değerlendirmesi" }], periods: empty ? [] : [{ id: "period-2026", name: "2026 dönemi" }] },
    hasAnonymousCampaigns: false, generatedAt: "2026-10-12T10:00:00Z",
    analytics: buildUnitManagementAnalytics({ units: selectedUnits, rows, details: empty ? [] : managementDetails(), basis, now: new Date("2026-10-12T10:00:00Z"),
      benchmarks: [{ sectorId: "sector-a", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 3.4 }, { sectorId: "sector-b", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 2.6 }],
      ironmanBenchmarks: [{ sectorId: "sector-a", subSectorId: null, velocityAverage: 3.2, enduranceAverage: 2.8, velocityAverageTarget: 4, enduranceAverageTarget: 4 }] }),
  };
}
