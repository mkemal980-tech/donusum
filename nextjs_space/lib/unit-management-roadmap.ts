import type { UnitAssessmentDetail } from "./unit-dashboard";

type Recommendation = UnitAssessmentDetail["recommendations"][number];
const DAY = 86_400_000;
const OPEN_STATUSES = new Set(["NOT_STARTED", "PLANNED", "IN_PROGRESS"]);
const round = (value: number) => Math.round(value * 10) / 10;
/** Yol haritasına alınabilir: bugün uygulanabilir ve henüz kapanmamış. */
const isReady = (rec: Recommendation) => rec.isActionable && rec.stepDistance === 0 && rec.status !== "COMPLETED" && rec.status !== "CANCELLED";
const isOpen = (rec: Recommendation) => rec.isInRoadmap && OPEN_STATUSES.has(rec.status ?? "");
const inRoadmap = (rec: Recommendation) => rec.isInRoadmap && rec.status !== "CANCELLED";
const monthOf = (value: string | Date) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }).slice(0, 7);

export type RoadmapRankKey = "completed" | "gain" | "efficiency" | "notStarted";
export const ROADMAP_RANK_LABELS: Record<RoadmapRankKey, string> = {
  completed: "En çok tamamlayan", gain: "En çok ilerleyen", efficiency: "İş başına en çok kazanan", notStarted: "Henüz başlamayan",
};

/**
 * Üyelerin öneri uygulaması. Puanları yeniden hesaplamaz; değerlendirme
 * detayındaki durum, katkı ve tamamlama kayıtlarını toplar.
 *
 * "Gelişim" yol haritasında beyan edilen ilerlemedir: üye bir öneriyi
 * tamamlandı diye işaretlediğinde puanı artar ve sistem o anda kanıt istemez.
 * Ölçülen ilerleme bir sonraki dönemin anketinden gelir (bkz. dönem değişimi).
 */
export function buildRoadmapAnalytics(input: {
  details: UnitAssessmentDetail[];
  categories: { id: string; name: string; average: number | null }[];
  now: Date;
}) {
  const { details, now } = input;
  const since = now.getTime() - 90 * DAY;

  const members = details.map(detail => {
    const recs = detail.recommendations;
    const completed = recs.filter(rec => rec.status === "COMPLETED");
    const lastCompletion = new Map<string, number>();
    for (const event of detail.history) {
      if (event.triggerType !== "RECOMMENDATION_COMPLETED" || !event.recommendationId) continue;
      lastCompletion.set(event.recommendationId, Math.max(lastCompletion.get(event.recommendationId) ?? 0, Date.parse(event.recordedAt)));
    }
    const declared = detail.scores.deltaPercentage;
    // Açık önerilerin katkısı ölçeğin tavanını aşamaz (kural 7).
    const remaining = Math.min(100 - detail.scores.overallPercentage, recs.filter(isReady).reduce((sum, rec) => sum + rec.fullContribution * 25, 0));
    return {
      unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, assessmentId: detail.assessment.id, surveyId: detail.assessment.surveyId,
      inRoadmap: recs.filter(inRoadmap).length, completed: completed.length,
      inProgress: recs.filter(rec => rec.isInRoadmap && rec.status === "IN_PROGRESS").length,
      planned: recs.filter(rec => rec.isInRoadmap && (rec.status === "PLANNED" || rec.status === "NOT_STARTED")).length,
      overdue: recs.filter(rec => rec.overdue).length, ready: recs.filter(isReady).length,
      declaredGain: declared,
      /** Beyan edilen gelişimin, açık önerilerle ulaşılabilecek toplam içindeki payı. */
      realization: declared + remaining > 0 ? Math.round(declared / (declared + remaining) * 100) : null,
      completedLast90: completed.filter(rec => (lastCompletion.get(rec.id) ?? 0) >= since).length,
      gainPerItem: completed.length ? round(declared / completed.length) : null,
    };
  });

  const byId = new Map<string, Pick<Recommendation, "id" | "title" | "description" | "strategicType" | "timeframe" | "estimatedImpact" | "costType" | "capexLevel" | "opexLevel" | "categoryId"> & {
    categoryName: string | null;
    units: { unitId: string; unitName: string; assessmentId: string; surveyId: string; status: string; inRoadmap: boolean; ready: boolean; overdue: boolean }[];
  }>();
  for (const detail of details) for (const rec of detail.recommendations) {
    if (!rec.isInRoadmap && !isReady(rec)) continue;
    let item = byId.get(rec.id);
    if (!item) {
      item = { id: rec.id, title: rec.title, description: rec.description, strategicType: rec.strategicType, timeframe: rec.timeframe,
        estimatedImpact: rec.estimatedImpact, costType: rec.costType, capexLevel: rec.capexLevel, opexLevel: rec.opexLevel, categoryId: rec.categoryId,
        categoryName: detail.categories.find(category => category.id === rec.categoryId)?.name ?? null, units: [] };
      byId.set(rec.id, item);
    }
    item.units.push({ unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, assessmentId: detail.assessment.id, surveyId: detail.assessment.surveyId,
      status: rec.status ?? "READY", inRoadmap: inRoadmap(rec), ready: isReady(rec), overdue: rec.overdue });
  }
  const recommendations = [...byId.values()].map(item => ({
    ...item,
    eligible: item.units.length,
    adopted: item.units.filter(unit => unit.inRoadmap).length,
    completed: item.units.filter(unit => unit.status === "COMPLETED").length,
    open: item.units.filter(unit => unit.inRoadmap && OPEN_STATUSES.has(unit.status)).length,
    overdue: item.units.filter(unit => unit.overdue).length,
  })).sort((a, b) => b.estimatedImpact - a.estimatedImpact || b.eligible - a.eligible || a.title.localeCompare(b.title, "tr"));

  const adopted = recommendations.filter(rec => rec.adopted > 0)
    .sort((a, b) => b.adopted - a.adopted || b.completed - a.completed || b.estimatedImpact - a.estimatedImpact).slice(0, 10);
  /** Birden çok üyede açık kalan iş ortak bir engele işaret eder. */
  const stuck = recommendations.filter(rec => rec.open >= 2)
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open || b.estimatedImpact - a.estimatedImpact).slice(0, 10);
  /** Birden çok üyeye uygulanabilir ama hiçbir üyenin yol haritasında olmayan öneriler. */
  const untouched = recommendations.filter(rec => rec.adopted === 0 && rec.eligible >= 2)
    .sort((a, b) => b.estimatedImpact * b.eligible - a.estimatedImpact * a.eligible || a.title.localeCompare(b.title, "tr")).slice(0, 10);

  const allRecs = details.flatMap(detail => detail.recommendations);
  const focus = {
    categories: input.categories.map(category => ({
      ...category,
      completed: allRecs.filter(rec => rec.categoryId === category.id && rec.status === "COMPLETED").length,
      open: allRecs.filter(rec => rec.categoryId === category.id && isOpen(rec)).length,
    })),
    strategies: ["QUICK_WIN", "PROJECT", "BIG_BET"].map(key => ({
      key, completed: allRecs.filter(rec => rec.strategicType === key && rec.status === "COMPLETED").length,
      open: allRecs.filter(rec => rec.strategicType === key && isOpen(rec)).length,
    })),
  };

  const overdue = details.flatMap(detail => detail.recommendations.filter(rec => rec.overdue && rec.dueDate).map(rec => ({
    recommendationId: rec.id, title: rec.title, unitId: detail.assessment.unitId, unitName: detail.assessment.unitName,
    assessmentId: detail.assessment.id, surveyId: detail.assessment.surveyId, assigneeName: rec.assigneeName, dueDate: rec.dueDate!,
    daysLate: Math.max(1, Math.floor((now.getTime() - Date.parse(rec.dueDate!)) / DAY)),
  }))).sort((a, b) => b.daysLate - a.daysLate || a.unitName.localeCompare(b.unitName, "tr"));

  return {
    totals: {
      inRoadmap: members.reduce((sum, row) => sum + row.inRoadmap, 0), completed: members.reduce((sum, row) => sum + row.completed, 0),
      open: members.reduce((sum, row) => sum + row.inProgress + row.planned, 0), overdue: overdue.length,
      notStarted: members.filter(row => row.inRoadmap === 0 && row.ready > 0).length,
    },
    members, recommendations, adopted, stuck, untouched, focus, overdue,
    monthly: monthlyCompletions(details, now),
    nextAction: untouched[0] ? { kind: "untouched" as const, id: untouched[0].id, title: untouched[0].title, reach: untouched[0].eligible, overdue: 0 }
      : stuck[0] ? { kind: "stuck" as const, id: stuck[0].id, title: stuck[0].title, reach: stuck[0].open, overdue: stuck[0].overdue } : null,
  };
}

/** Son 12 ayda tamamlanan iş sayısı; geri alınan tamamlama ayından düşer. */
function monthlyCompletions(details: UnitAssessmentDetail[], now: Date) {
  const counts = new Map<string, number>();
  for (const detail of details) for (const event of detail.history) {
    const step = event.triggerType === "RECOMMENDATION_COMPLETED" ? 1 : event.triggerType === "RECOMMENDATION_REVERTED" ? -1 : 0;
    if (step) counts.set(monthOf(event.recordedAt), (counts.get(monthOf(event.recordedAt)) ?? 0) + step);
  }
  if (!counts.size) return [];
  const [year, month] = monthOf(now).split("-").map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const offset = year * 12 + (month - 1) - (11 - index);
    const key = Math.floor(offset / 12) + "-" + String(offset % 12 + 1).padStart(2, "0");
    return { month: key, completed: Math.max(0, counts.get(key) ?? 0) };
  });
}

export type RoadmapAnalytics = ReturnType<typeof buildRoadmapAnalytics>;
export type RoadmapMember = RoadmapAnalytics["members"][number];

/** Aynı sıralama panoda ve raporda kullanılır. */
export function rankRoadmapMembers(members: RoadmapMember[], key: RoadmapRankKey) {
  const byName = (a: RoadmapMember, b: RoadmapMember) => a.unitName.localeCompare(b.unitName, "tr");
  if (key === "notStarted") return members.filter(row => row.inRoadmap === 0 && row.ready > 0).sort((a, b) => b.ready - a.ready || byName(a, b));
  if (key === "efficiency") return members.filter(row => row.gainPerItem !== null).sort((a, b) => b.gainPerItem! - a.gainPerItem! || byName(a, b));
  if (key === "gain") return [...members].sort((a, b) => b.declaredGain - a.declaredGain || b.completed - a.completed || byName(a, b));
  return [...members].sort((a, b) => b.completed - a.completed || b.declaredGain - a.declaredGain || byName(a, b));
}
