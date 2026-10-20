import { unitDetail, unitRow } from "./unit-dashboard";
import { buildUnitManagementAnalytics, type ManagementUnit } from "../lib/unit-management-analytics";
import type { UnitAssessmentDetail } from "../lib/unit-dashboard";
import type { UnitManagementDashboard } from "../lib/unit-management";

const unit = (id: string, name: string, parentId: string | null, sector: [string, string] | null, employeeCount: number | null, activeUserCount = 1): ManagementUnit =>
  ({ id, name, parentId, description: null, sectorId: sector?.[0] ?? null, subSectorId: null, sectorName: sector?.[1] ?? null, employeeCount, activeUserCount });

/** Bir üst birim, altında altı üye; bir üyenin kendi departmanı da var (karşılaştırmaya girmez). */
export const managementUnits: ManagementUnit[] = [
  unit("root", "Ege Sanayi Odası", null, ["sector-a", "İmalat"], null, 2),
  unit("unit-a", "Akdeniz Tekstil", "root", ["sector-a", "İmalat"], 270, 3),
  unit("unit-b", "Bora Gıda", "root", ["sector-b", "Gıda"], 12, 2),
  unit("unit-c", "Çınar Metal", "root", ["sector-a", "İmalat"], null, 2),
  unit("unit-d", "Deniz Lojistik", "root", null, 60),
  unit("unit-e", "Ece Kimya", "root", ["sector-a", "İmalat"], 8),
  unit("unit-f", "Fırat Enerji", "root", ["sector-b", "Gıda"], null, 0),
  unit("unit-a1", "Akdeniz Tekstil Boyahane", "unit-a", ["sector-a", "İmalat"], 40),
];
export const memberUnits = managementUnits.filter(row => row.parentId === "root");

export const managementRows = [
  { ...unitRow("assessment-a", "unit-a", "Akdeniz Tekstil"), status: "SUBMITTED" as const, score: 72, maturityScore: 3.9, submittedAt: "2026-10-01T12:00:00Z", responseCount: 6, totalQuestions: 6, completionPercentage: 100 },
  { ...unitRow("assessment-b", "unit-b", "Bora Gıda"), status: "SUBMITTED" as const, score: 48, maturityScore: 2.9, submittedAt: "2026-10-03T12:00:00Z", responseCount: 6, totalQuestions: 6, completionPercentage: 100 },
  { ...unitRow("assessment-c", "unit-c", "Çınar Metal"), status: "SUBMITTED" as const, score: 61, maturityScore: 3.4, submittedAt: "2026-10-05T12:00:00Z", responseCount: 5, totalQuestions: 6, completionPercentage: 83 },
  { ...unitRow("assessment-d", "unit-d", "Deniz Lojistik"), score: 20, maturityScore: 1.8, responseCount: 3, totalQuestions: 6, completionPercentage: 50, overdue: true, deadline: "2026-10-10T20:59:59Z" },
  { ...unitRow("pending-e", "unit-e", "Ece Kimya"), assessmentId: null, score: null, maturityScore: null, responseCount: 0, status: "NOT_STARTED" as const, completionPercentage: 0 },
];

type Spec = {
  row: (typeof managementRows)[number]; overall: number; baseline: number; categories: [number, number, number]; previous: UnitAssessmentDetail["previous"];
  ratios: Record<string, number | null>; evidence: [number, number]; recs: Record<string, Partial<UnitAssessmentDetail["recommendations"][number]>>;
  history: [string, string, string][]; axes: [number, number];
};
const CATEGORIES = ["Çevre", "Sosyal", "Yönetişim"];
const QUESTIONS: [string, string, number][] = [["q-carbon", "Karbon ayak izi ölçülüyor mu?", 0], ["q-energy", "Enerji tüketimi izleniyor mu?", 0], ["q-water", "Su tüketimi izleniyor mu?", 0],
  ["q-safety", "İş sağlığı kayıtları tutuluyor mu?", 1], ["q-policy", "Sürdürülebilirlik politikası yazılı mı?", 2], ["q-board", "Yönetim kurulu hedefleri izliyor mu?", 2]];
const REC = { isActionable: true, stepDistance: 0, isInRoadmap: false, status: null, overdue: false, dueDate: null, assigneeName: "Atanmamış", fullContribution: 0.4, currentContribution: 0 };
const RECS = [
  { id: "rec-carbon", title: "Karbon envanteri hazırla", questionId: "q-carbon", categoryId: "category-0", estimatedImpact: 9, strategicType: "QUICK_WIN" as const, timeframe: "SHORT_TERM" as const, costType: "OPEX" as const },
  { id: "rec-energy", title: "Enerji izleme sistemi kur", questionId: "q-energy", categoryId: "category-0", estimatedImpact: 8, strategicType: "PROJECT" as const, timeframe: "MEDIUM_TERM" as const, costType: "CAPEX" as const },
  { id: "rec-policy", title: "Sürdürülebilirlik politikası yayımla", questionId: "q-policy", categoryId: "category-2", estimatedImpact: 6, strategicType: "QUICK_WIN" as const, timeframe: "SHORT_TERM" as const, costType: "OPEX" as const },
];

function memberDetail(spec: Spec): UnitAssessmentDetail {
  const detail = unitDetail(spec.row.id, spec.row.unitId, spec.row.unitName);
  const template = detail.categories[0];
  const question = template.sections[0].questions[0];
  detail.assessment.status = spec.row.status;
  detail.assessment.submittedAt = spec.row.submittedAt;
  detail.answeredQuestions = spec.row.responseCount; detail.totalQuestions = spec.row.totalQuestions; detail.completionPercentage = spec.row.completionPercentage;
  Object.assign(detail.scores, {
    overallPercentage: spec.overall, overallScore: 1 + spec.overall / 25, baselineOverallPercentage: spec.baseline, baselineOverallScore: 1 + spec.baseline / 25,
    deltaPercentage: spec.overall - spec.baseline, delta: (spec.overall - spec.baseline) / 25, velocityScore: spec.axes[0], enduranceScore: spec.axes[1],
    velocityWeight: 3, enduranceWeight: 3, quadrant: spec.axes[0] >= 3 ? (spec.axes[1] >= 3 ? "IRONMAN" : "SPRINTER") : spec.axes[1] >= 3 ? "MARATHON_RUNNER" : "WALKER",
  });
  let evidence = 0;
  detail.categories = CATEGORIES.map((name, index) => ({
    ...structuredClone(template), id: "category-" + index, name, weightPercentage: index ? 25 : 50,
    currentPercentage: spec.categories[index], basePercentage: spec.categories[index] - 4, currentScore: 1 + spec.categories[index] / 25, baseScore: 1 + (spec.categories[index] - 4) / 25,
    answeredQuestions: 2, totalQuestions: 2,
    sections: [{ ...structuredClone(template.sections[0]), id: "section-" + index, name: name + " uygulamaları",
      questions: QUESTIONS.filter(row => row[2] === index).map(([id, text]) => {
        const ratio = spec.ratios[id] ?? null;
        const requiresEvidence = ratio !== null && evidence < spec.evidence[0];
        const documented = requiresEvidence && evidence < spec.evidence[1];
        if (requiresEvidence) evidence++;
        return { ...question, id, text, ratio, value: ratio === null ? null : String(ratio), requiresEvidence, evidenceCount: documented ? 1 : 0 };
      }) }],
  }));
  detail.recommendations = RECS.flatMap(rec => spec.recs[rec.id] ? [{ ...detail.recommendations[0], ...REC, ...rec, reasons: [], ...spec.recs[rec.id] }] : []);
  detail.summary = { ...detail.summary, completedRoadmapCount: detail.recommendations.filter(rec => rec.status === "COMPLETED").length,
    overdueRoadmapCount: detail.recommendations.filter(rec => rec.overdue).length, contributorCount: 2 };
  detail.history = spec.history.map(([recordedAt, triggerType, recommendationId], index) => ({ id: spec.row.id + "-h" + index, recordedAt, score: 3, percentage: 50, triggerType, completedRecommendations: 1, recommendationId }));
  detail.previous = spec.previous;
  return detail;
}

const previous = (percentage: number, baselinePercentage: number, categories: [number, number, number]): UnitAssessmentDetail["previous"] => ({
  id: "previous", period: "2025 dönemi", submittedAt: "2025-10-01T09:00:00Z", percentage, baselinePercentage, deltaPercentage: percentage - baselinePercentage,
  categories: categories.map((value, index) => ({ id: "category-" + index, currentPercentage: value, basePercentage: value })),
});

export function managementDetails(): UnitAssessmentDetail[] {
  return [
    memberDetail({ row: managementRows[0], overall: 72, baseline: 66, categories: [60, 80, 76], previous: previous(64, 60, [50, 74, 70]), axes: [3.9, 3.6], evidence: [3, 3],
      ratios: { "q-carbon": 0.25, "q-energy": 1, "q-water": 0.75, "q-safety": 0.75, "q-policy": 1, "q-board": 0.75 },
      recs: { "rec-carbon": {}, "rec-energy": { isInRoadmap: true, status: "IN_PROGRESS", overdue: true, dueDate: "2026-09-12T20:59:59Z", assigneeName: "Ayşe Kaya" }, "rec-policy": { isInRoadmap: true, status: "COMPLETED", fullContribution: 1.5 } },
      history: [["2026-09-15T09:00:00Z", "RECOMMENDATION_COMPLETED", "rec-policy"]] }),
    memberDetail({ row: managementRows[1], overall: 48, baseline: 48, categories: [30, 62, 52], previous: previous(50, 46, [36, 60, 50]), axes: [2.6, 2.8], evidence: [2, 0],
      ratios: { "q-carbon": 0, "q-energy": 0.25, "q-water": 0.25, "q-safety": 0.5, "q-policy": 0.75, "q-board": 0.5 },
      recs: { "rec-carbon": {}, "rec-energy": { isInRoadmap: true, status: "PLANNED", assigneeName: "Bora Er" } },
      history: [] }),
    memberDetail({ row: managementRows[2], overall: 61, baseline: 53, categories: [44, 70, 72], previous: null, axes: [3.2, 2.7], evidence: [2, 1],
      ratios: { "q-carbon": 0.75, "q-energy": 0.25, "q-water": 0.5, "q-safety": 0.75, "q-policy": 1, "q-board": null },
      recs: { "rec-carbon": { isActionable: false, stepDistance: 1 }, "rec-energy": { isInRoadmap: true, status: "COMPLETED", fullContribution: 1 }, "rec-policy": { isInRoadmap: true, status: "COMPLETED", fullContribution: 1 } },
      history: [["2026-03-10T09:00:00Z", "RECOMMENDATION_COMPLETED", "rec-energy"], ["2026-10-01T09:00:00Z", "RECOMMENDATION_COMPLETED", "rec-policy"], ["2026-10-02T09:00:00Z", "RECOMMENDATION_REVERTED", "rec-policy"], ["2026-10-04T09:00:00Z", "RECOMMENDATION_COMPLETED", "rec-policy"]] }),
    memberDetail({ row: managementRows[3], overall: 20, baseline: 20, categories: [10, 30, 20], previous: null, axes: [1.8, 1.8], evidence: [0, 0],
      ratios: { "q-carbon": 0, "q-energy": 0, "q-water": null, "q-safety": 0.25, "q-policy": null, "q-board": null },
      recs: { "rec-carbon": {} }, history: [] }),
  ].map((detail, index) => {
    if (index === 3) detail.work = [{ kind: "INCOMPLETE", sectionId: "section-1", categoryId: "category-1", title: "Sosyal uygulamaları bölümünde cevaplar eksik", assigneeName: "Deniz Ak", count: 2 }];
    return detail;
  });
}

export const NOW = new Date("2026-10-12T10:00:00Z");

export function managementDashboard({ empty = false, units = managementUnits }: { empty?: boolean; units?: ManagementUnit[] } = {}): UnitManagementDashboard {
  const members = units.filter(row => row.parentId === "root");
  return {
    kind: "group",
    selection: { unitId: "root", unitName: "Ege Sanayi Odası", surveyId: empty ? null : "survey-1", surveyName: empty ? null : "Sürdürülebilirlik olgunluk anketi",
      periodId: empty ? null : "period-2026", periodName: empty ? null : "2026 dönemi", campaignId: empty ? null : "period-2026" },
    options: { groups: [{ id: "root", name: "Ege Sanayi Odası" }, { id: "unit-a", name: "Ege Sanayi Odası › Akdeniz Tekstil" }],
      surveys: empty ? [] : [{ id: "survey-1", name: "Sürdürülebilirlik olgunluk anketi" }], periods: empty ? [] : [{ id: "period-2026", name: "2026 dönemi" }],
      members: members.map(row => ({ id: row.id, name: row.name, employeeCount: row.employeeCount })) },
    hasAnonymousCampaigns: false, generatedAt: NOW.toISOString(),
    analytics: buildUnitManagementAnalytics({ members, rows: empty ? [] : managementRows, details: empty ? [] : managementDetails(), now: NOW,
      benchmarks: [{ sectorId: "sector-a", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 3.4 }, { sectorId: "sector-b", subSectorId: null, level: "OVERALL", targetId: null, averageScore: 2.6 },
        { sectorId: "sector-a", subSectorId: null, level: "CATEGORY", targetId: "category-0", averageScore: 3 }],
      ironmanBenchmarks: [{ sectorId: "sector-a", subSectorId: null, velocityAverage: 3.2, enduranceAverage: 2.8, velocityAverageTarget: 4, enduranceAverageTarget: 4 }] }),
  };
}
