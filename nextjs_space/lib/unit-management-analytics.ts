import type { Benchmark, IronmanBenchmark } from "@prisma/client";
import type { UnitAssessmentDetail, UnitAssessmentRow } from "./unit-dashboard";
import { classifyQuadrant, QUADRANT_THRESHOLD } from "./scoring";
import { maturityFromPercentage, median } from "./organization-campaign";

export type ManagementBasis = "answered" | "submitted";
export type ManagementUnit = {
  id: string; name: string; parentId: string | null; description: string | null;
  sectorId: string | null; subSectorId: string | null; sectorName: string | null;
  employeeCount: number | null; activeUserCount: number;
};
export type ManagementBenchmark = Pick<Benchmark, "sectorId" | "subSectorId" | "level" | "targetId" | "averageScore">;
export type ManagementIronmanBenchmark = Pick<IronmanBenchmark, "sectorId" | "subSectorId" | "velocityAverage" | "enduranceAverage" | "velocityAverageTarget" | "enduranceAverageTarget">;
const round = (value: number) => Math.round(value * 10) / 10;
export const mean = (values: (number | null | undefined)[]) => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};
const percent = (score: number) => score >= 1 && score <= 5 ? (score - 1) / 4 * 100 : null;

export function unitSizeLabel(employeeCount: number | null) {
  if (employeeCount === null) return "Belirtilmedi";
  if (employeeCount === 0) return "Çalışan yok";
  if (employeeCount < 10) return "Mikro (1–9)";
  if (employeeCount < 50) return "Küçük (10–49)";
  if (employeeCount < 250) return "Orta (50–249)";
  return "Büyük (250+)";
}

/** Hiyerarşiyi yalnızca önceden yetkilendirilmiş birim listesi içinde genişletir. */
export function managementScopeIds(units: Pick<ManagementUnit, "id" | "parentId">[], unitId: string, descendants = true) {
  if (unitId === "all") return units.map(unit => unit.id);
  if (!units.some(unit => unit.id === unitId)) return [];
  const children = new Map<string, string[]>();
  for (const unit of units) if (unit.parentId) children.set(unit.parentId, [...children.get(unit.parentId) ?? [], unit.id]);
  const selected = new Set<string>();
  const queue = [unitId];
  while (queue.length) {
    const id = queue.pop()!;
    if (selected.has(id)) continue;
    selected.add(id);
    if (descendants) queue.push(...children.get(id) ?? []);
  }
  return [...selected];
}

function benchmarkFor(unit: ManagementUnit | undefined, benchmarks: ManagementBenchmark[], categoryId?: string) {
  if (!unit?.sectorId) return null;
  const choices = benchmarks.filter(row => row.sectorId === unit.sectorId && row.level === (categoryId ? "CATEGORY" : "OVERALL") && (categoryId ? row.targetId === categoryId : row.targetId === null));
  const exact = unit.subSectorId ? choices.find(row => row.subSectorId === unit.subSectorId) : undefined;
  const selected = exact ?? choices.find(row => row.subSectorId === null);
  return selected ? percent(selected.averageScore) : null;
}

function ironmanFor(unit: ManagementUnit | undefined, benchmarks: ManagementIronmanBenchmark[]) {
  if (!unit?.sectorId) return undefined;
  const choices = benchmarks.filter(row => row.sectorId === unit.sectorId);
  return (unit.subSectorId ? choices.find(row => row.subSectorId === unit.subSectorId) : undefined) ?? choices.find(row => row.subSectorId === null);
}

function responseTrend(rows: UnitAssessmentRow[], now: Date) {
  const events = new Map<string, { started: number; submitted: number }>();
  const date = (value: string) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  for (const row of rows) {
    for (const [kind, value] of [["started", row.assessmentId ? row.createdAt : null], ["submitted", row.status === "SUBMITTED" ? row.submittedAt : null]] as const) {
      if (!value || !Number.isFinite(new Date(value).getTime())) continue;
      const key = date(value);
      const counts = events.get(key) ?? { started: 0, submitted: 0 };
      counts[kind]++;
      events.set(key, counts);
    }
  }
  if (!events.size) return [];
  const today = date(now.toISOString());
  if (today > [...events.keys()].sort().at(-1)!) events.set(today, { started: 0, submitted: 0 });
  let started = 0, submitted = 0;
  return [...events].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => {
    started += counts.started; submitted += counts.submitted;
    return { date, started, submitted };
  });
}

/** Puanları yeniden üretmez; ortak puan motorunun değerlendirme sonuçlarını toplulaştırır. */
export function buildUnitManagementAnalytics(input: {
  units: ManagementUnit[]; rows: UnitAssessmentRow[]; details: UnitAssessmentDetail[];
  benchmarks?: ManagementBenchmark[]; ironmanBenchmarks?: ManagementIronmanBenchmark[];
  basis: ManagementBasis; now?: Date;
}) {
  const { units, rows, basis } = input;
  const benchmarks = input.benchmarks ?? [];
  const ironmanBenchmarks = input.ironmanBenchmarks ?? [];
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  const rowById = new Map(rows.map(row => [row.assessmentId, row]));
  const eligibleDetails = input.details.filter(detail => {
    const row = rowById.get(detail.assessment.id);
    return row && row.unitId === detail.assessment.unitId && unitById.has(row.unitId);
  });
  const analyzed = eligibleDetails.filter(detail => detail.answeredQuestions > 0 && (basis === "answered" || rowById.get(detail.assessment.id)?.status === "SUBMITTED"));
  const scoreValues = analyzed.map(detail => detail.scores.overallPercentage);
  const average = mean(scoreValues);
  const overallPairs = analyzed.flatMap(detail => {
    const benchmark = benchmarkFor(unitById.get(detail.assessment.unitId), benchmarks);
    return benchmark === null ? [] : [{ benchmark, difference: detail.scores.overallPercentage - benchmark }];
  });
  const categories = [...new Map(eligibleDetails.flatMap(detail => detail.categories.map(category => [category.id, category] as const))).values()].map(category => {
    const values = analyzed.flatMap(detail => {
      const item = detail.categories.find(row => row.id === category.id && row.answeredQuestions > 0);
      if (!item) return [];
      const benchmark = benchmarkFor(unitById.get(detail.assessment.unitId), benchmarks, category.id);
      return [{ item, benchmark }];
    });
    const paired = values.filter(value => value.benchmark !== null);
    const sections = [...new Map(values.flatMap(value => value.item.sections.map(section => [section.id ?? "direct", section] as const))).values()].map(section => ({
      id: section.id, name: section.name,
      average: mean(values.map(value => value.item.sections.find(row => row.id === section.id)?.currentPercentage)),
      answered: values.reduce((sum, value) => sum + (value.item.sections.find(row => row.id === section.id)?.answeredCount ?? 0), 0),
      total: values.reduce((sum, value) => sum + (value.item.sections.find(row => row.id === section.id)?.questionCount ?? 0), 0),
    }));
    return {
      id: category.id, name: category.name, count: values.length,
      average: mean(values.map(value => value.item.currentPercentage)),
      baseline: mean(values.map(value => value.item.basePercentage)),
      gain: mean(values.map(value => (value.item.currentScore - value.item.baseScore) * 25)),
      weight: mean(values.map(value => value.item.weightPercentage)),
      benchmark: mean(paired.map(value => value.benchmark)), benchmarkCount: paired.length,
      difference: mean(paired.map(value => value.item.currentPercentage - value.benchmark!)), sections,
    };
  });
  const distribution = ["Başlangıç", "Farkındalık", "Gelişen", "Olgun", "Lider"].map(label => ({ label, count: scoreValues.filter(value => maturityFromPercentage(value) === label).length }));
  const leading = [...distribution].sort((a, b) => b.count - a.count)[0];
  const axes = analyzed.filter(detail => detail.scores.velocityWeight > 0 && detail.scores.enduranceWeight > 0);
  const velocity = mean(axes.map(detail => detail.scores.velocityScore));
  const endurance = mean(axes.map(detail => detail.scores.enduranceScore));
  const axisBenchmarks = axes.flatMap(detail => {
    const benchmark = ironmanFor(unitById.get(detail.assessment.unitId), ironmanBenchmarks);
    return benchmark ? [benchmark] : [];
  });
  const sectors = [...new Map(units.map(unit => [unit.sectorId ?? "none", { id: unit.sectorId ?? "none", name: unit.sectorName ?? "Sektör belirtilmedi" }])).values()].map(sector => {
    const sectorUnits = units.filter(unit => (unit.sectorId ?? "none") === sector.id);
    const ids = new Set(sectorUnits.map(unit => unit.id));
    const assigned = rows.filter(row => ids.has(row.unitId));
    const details = analyzed.filter(detail => ids.has(detail.assessment.unitId));
    const paired = details.flatMap(detail => {
      const benchmark = benchmarkFor(unitById.get(detail.assessment.unitId), benchmarks);
      return benchmark === null ? [] : [{ benchmark, difference: detail.scores.overallPercentage - benchmark }];
    });
    return { ...sector, unitCount: sectorUnits.length, assigned: assigned.length, count: details.length, submitted: assigned.filter(row => row.status === "SUBMITTED").length,
      average: mean(details.map(detail => detail.scores.overallPercentage)), benchmark: mean(paired.map(value => value.benchmark)), difference: mean(paired.map(value => value.difference)) };
  });
  const companySizes = ["Mikro (1–9)", "Küçük (10–49)", "Orta (50–249)", "Büyük (250+)", "Çalışan yok", "Belirtilmedi"].map(label => {
    const matching = units.filter(unit => unitSizeLabel(unit.employeeCount) === label);
    const ids = new Set(matching.map(unit => unit.id));
    const values = analyzed.filter(detail => ids.has(detail.assessment.unitId));
    return { label, unitCount: matching.length, count: values.length, average: mean(values.map(detail => detail.scores.overallPercentage)) };
  });
  type Recommendation = UnitAssessmentDetail["recommendations"][number];
  const recommendations = new Map<string, Pick<Recommendation, "id" | "title" | "description" | "strategicType" | "timeframe" | "estimatedImpact" | "costType" | "capexLevel" | "opexLevel" | "categoryId"> & {
    categoryName: string | null; units: { unitId: string; unitName: string; assessmentId: string; status: string; ready: boolean }[];
  }>();
  for (const detail of analyzed) for (const rec of detail.recommendations) {
    if (!rec.isInRoadmap && (!rec.isActionable || rec.stepDistance > 0)) continue;
    let item = recommendations.get(rec.id);
    if (!item) {
      item = { id: rec.id, title: rec.title, description: rec.description, strategicType: rec.strategicType, timeframe: rec.timeframe,
        estimatedImpact: rec.estimatedImpact, costType: rec.costType, capexLevel: rec.capexLevel, opexLevel: rec.opexLevel, categoryId: rec.categoryId,
        categoryName: detail.categories.find(category => category.id === rec.categoryId)?.name ?? null, units: [] };
      recommendations.set(rec.id, item);
    }
    item.units.push({ unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, assessmentId: detail.assessment.id,
      status: rec.status ?? "READY", ready: rec.isActionable && rec.stepDistance === 0 && rec.status !== "COMPLETED" && rec.status !== "CANCELLED" });
  }
  const portfolioRows = [...recommendations.values()].sort((a, b) => b.estimatedImpact - a.estimatedImpact || b.units.length - a.units.length || a.title.localeCompare(b.title, "tr"));
  const statusLabels = ["READY", "NOT_STARTED", "PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  const gain = mean(analyzed.map(detail => {
    const options = detail.recommendations.filter(rec => rec.isActionable && rec.stepDistance === 0 && rec.status !== "COMPLETED" && rec.status !== "CANCELLED");
    return Math.min(5 - detail.scores.overallScore, Math.max(0, ...options.map(rec => rec.fullContribution))) * 25;
  }));
  const submitted = rows.filter(row => row.status === "SUBMITTED").length;
  const notStarted = rows.filter(row => row.status === "NOT_STARTED").length;
  const strongest = [...categories].filter(category => category.average !== null).sort((a, b) => b.average! - a.average!)[0];
  const weakest = [...categories].filter(category => category.average !== null).sort((a, b) => a.average! - b.average!)[0];
  const ready = rows.filter(row => row.status === "READY_TO_SUBMIT").length;
  const overdueRoadmap = analyzed.reduce((sum, detail) => sum + detail.summary.overdueRoadmapCount, 0);
  const insights: { title: string; description: string; tone: "success" | "warning" | "accent" }[] = [];
  if (strongest) insights.push({ title: "En güçlü başlık", description: `${strongest.name}, %${strongest.average!.toLocaleString("tr-TR")} ile seçili kapsamın en yüksek kategori puanına sahip.`, tone: "success" });
  if (weakest && weakest.id !== strongest?.id) insights.push({ title: "Gelişim alanı", description: `${weakest.name}, %${weakest.average!.toLocaleString("tr-TR")} ile en düşük kategori puanına sahip; bu başlığın önerileri önceliklendirilebilir.`, tone: "warning" });
  if (ready) insights.push({ title: "Gönderime hazır değerlendirmeler", description: `${ready} değerlendirmede tüm sorular cevaplanmış; henüz kesinleşmiş gönderim yapılmamış.`, tone: "accent" });
  if (notStarted) insights.push({ title: "Katılımı artırın", description: `Atanmış ${notStarted} değerlendirmede henüz cevap yok. Birim listesinden değerlendirmeleri başlatabilirsiniz.`, tone: "warning" });
  if (overdueRoadmap) insights.push({ title: "Geciken yol haritası işleri", description: `${overdueRoadmap} işin hedef tarihi geçmiş. İlgili birimlerin yol haritasından sorumlu ve tarihleri takip edin.`, tone: "warning" });
  if (portfolioRows[0]) insights.push({ title: "Öncelikli öneri", description: `${portfolioRows[0].title}: ${portfolioRows[0].units.length} birimi ilgilendiriyor; tahmini etki ${portfolioRows[0].estimatedImpact}/10.`, tone: "accent" });
  const activity = input.details.flatMap(detail => [...detail.team.flatMap(member => member.lastActivityAt ? [member.lastActivityAt] : []), ...detail.history.map(item => item.recordedAt)]).sort().at(-1) ?? null;
  return {
    scope: { unitCount: units.length, activeUserCount: units.reduce((sum, unit) => sum + unit.activeUserCount, 0), lastActivityAt: activity },
    participation: { total: rows.length, submitted, notStarted, inProgress: rows.length - submitted - notStarted, readyToSubmit: ready,
      overdue: rows.filter(row => row.overdue).length, completionRate: rows.length ? round(submitted / rows.length * 100) : 0 },
    results: { count: analyzed.length, average, median: scoreValues.length ? median(scoreValues) : null,
      baseline: mean(analyzed.map(detail => detail.scores.baselineOverallPercentage)), gain: mean(analyzed.map(detail => detail.scores.deltaPercentage)),
      leadingMaturity: analyzed.length ? leading.label : null, leadingCount: analyzed.length ? leading.count : 0,
      benchmark: mean(overallPairs.map(value => value.benchmark)), benchmarkCount: overallPairs.length, difference: mean(overallPairs.map(value => value.difference)), categories, distribution },
    ironman: { count: axes.length, velocity, endurance, threshold: QUADRANT_THRESHOLD,
      questionMix: { velocity: mean(analyzed.map(detail => detail.questionMix.velocity)), endurance: mean(analyzed.map(detail => detail.questionMix.endurance)) }, benchmarkCount: axisBenchmarks.length,
      benchmarkVelocity: mean(axisBenchmarks.map(value => value.velocityAverage)), benchmarkEndurance: mean(axisBenchmarks.map(value => value.enduranceAverage)),
      targetVelocity: mean(axisBenchmarks.map(value => value.velocityAverageTarget)), targetEndurance: mean(axisBenchmarks.map(value => value.enduranceAverageTarget)),
      quadrant: velocity === null || endurance === null ? null : classifyQuadrant(velocity, endurance),
      distribution: ["IRONMAN", "SPRINTER", "MARATHON_RUNNER", "WALKER"].map(key => ({ key, count: axes.filter(detail => detail.scores.quadrant === key).length })) },
    trend: responseTrend(rows, input.now ?? new Date()), companySizes, sectors,
    portfolio: { total: portfolioRows.length, highPriority: portfolioRows.filter(rec => rec.estimatedImpact >= 8 && rec.units.some(unit => unit.ready)).length,
      memberReach: new Set(portfolioRows.flatMap(rec => rec.units.filter(unit => unit.ready).map(unit => unit.unitId))).size, potentialGain: gain,
      byStrategy: ["QUICK_WIN", "PROJECT", "BIG_BET"].map(key => ({ key, count: portfolioRows.filter(rec => rec.strategicType === key).length })),
      byStatus: statusLabels.map(key => ({ key, count: portfolioRows.reduce((sum, rec) => sum + rec.units.filter(unit => unit.status === key).length, 0) })), rows: portfolioRows },
    insights, members: rows.map(row => ({ ...row, sectorName: unitById.get(row.unitId)?.sectorName ?? null, employeeCount: unitById.get(row.unitId)?.employeeCount ?? null })),
  };
}
export type UnitManagementAnalytics = ReturnType<typeof buildUnitManagementAnalytics>;
