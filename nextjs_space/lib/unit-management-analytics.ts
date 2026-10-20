import type { Benchmark, IronmanBenchmark } from "@prisma/client";
import type { UnitAssessmentDetail, UnitAssessmentRow } from "./unit-dashboard";
import { classifyQuadrant, QUADRANT_THRESHOLD } from "./scoring";
import { maturityFromPercentage, median } from "./organization-campaign";
import { buildRoadmapAnalytics } from "./unit-management-roadmap";

export type ManagementUnit = {
  id: string; name: string; parentId: string | null; description: string | null;
  sectorId: string | null; subSectorId: string | null; sectorName: string | null;
  employeeCount: number | null; activeUserCount: number;
};
export type ManagementBenchmark = Pick<Benchmark, "sectorId" | "subSectorId" | "level" | "targetId" | "averageScore">;
export type ManagementIronmanBenchmark = Pick<IronmanBenchmark, "sectorId" | "subSectorId" | "velocityAverage" | "enduranceAverage" | "velocityAverageTarget" | "enduranceAverageTarget">;
/** Birimin altında üye olmadığında seçilen sanal grup: yetki kapsamındaki en üst birimler. */
export const ROOT_GROUP = "all";
export const MATURITY_LEVELS = ["Başlangıç", "Farkındalık", "Gelişen", "Olgun", "Lider"] as const;
/** Ortak gelişim alanı: cevap, sorunun puan ölçeğinin alt yarısında. */
export const LOW_ANSWER_RATIO = 0.5;
/** "Gelişen" seviyesinin alt sınırı. */
const DEVELOPING = 40;
const round = (value: number) => Math.round(value * 10) / 10;
const raw = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export const mean = (values: (number | null | undefined)[]) => {
  const valid = raw(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)));
  return valid === null ? null : round(valid);
};
/** İki grubun ortalama farkı; yuvarlanmış ortalamalardan çıkarma yapılmaz. */
const difference = (pairs: { current: number; previous: number }[]) =>
  pairs.length ? round(raw(pairs.map(pair => pair.current))! - raw(pairs.map(pair => pair.previous))!) : null;
const percent = (score: number) => score >= 1 && score <= 5 ? (score - 1) / 4 * 100 : null;
const levelCounts = (values: number[]) => MATURITY_LEVELS.map(label => ({ label, count: values.filter(value => maturityFromPercentage(value) === label).length }));

export function unitSizeLabel(employeeCount: number | null) {
  if (employeeCount === null) return "Belirtilmedi";
  if (employeeCount === 0) return "Çalışan yok";
  if (employeeCount < 10) return "Mikro (1–9)";
  if (employeeCount < 50) return "Küçük (10–49)";
  if (employeeCount < 250) return "Orta (50–249)";
  return "Büyük (250+)";
}

export type ManagementGroup = { id: string; name: string; memberIds: string[] };
/**
 * Karşılaştırılan küme her zaman "birim → hemen altındaki üyeler"dir; oda,
 * holding ya da şirket olması fark etmez. Daha alt seviyeler üyenin kendi
 * grubunda görünür, tek listede düzleştirilmez. Yetki kapsamında birden çok
 * en üst birim varsa onlar da sanal bir grup olarak karşılaştırılabilir.
 */
export function managementGroups(units: Pick<ManagementUnit, "id" | "name" | "parentId">[]): ManagementGroup[] {
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const children = new Map<string, string[]>();
  for (const unit of units) if (unit.parentId && byId.has(unit.parentId) && unit.parentId !== unit.id) children.set(unit.parentId, [...children.get(unit.parentId) ?? [], unit.id]);
  const path = (unit: Pick<ManagementUnit, "id" | "name" | "parentId">) => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let current: typeof unit | undefined = unit; current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
      seen.add(current.id); names.unshift(current.name);
    }
    return names;
  };
  const groups = units.filter(unit => children.has(unit.id)).map(unit => ({ id: unit.id, path: path(unit), memberIds: children.get(unit.id)! }))
    .sort((a, b) => a.path.length - b.path.length || a.path.join(" › ").localeCompare(b.path.join(" › "), "tr"))
    .map(group => ({ id: group.id, name: group.path.join(" › "), memberIds: group.memberIds }));
  const roots = units.filter(unit => !unit.parentId || !byId.has(unit.parentId));
  if (roots.length > 1) groups.push({ id: ROOT_GROUP, name: "Yönetilen en üst birimler", memberIds: roots.map(unit => unit.id) });
  return groups;
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

const questionsOf = (detail: UnitAssessmentDetail) => detail.categories.flatMap(category => category.sections.flatMap(section =>
  section.questions.map(question => ({ ...question, categoryId: category.id, categoryName: category.name, sectionName: section.name }))));

function evidenceOf(detail: UnitAssessmentDetail) {
  const required = questionsOf(detail).filter(question => question.requiresEvidence && question.value);
  return { required: required.length, documented: required.filter(question => question.evidenceCount > 0).length };
}

function lastActivity(detail: UnitAssessmentDetail) {
  return [...detail.team.flatMap(member => member.lastActivityAt ? [member.lastActivityAt] : []), ...detail.history.map(item => item.recordedAt)].sort().at(-1) ?? null;
}

/**
 * Yönetim panosunun bütün sayıları. Puanları yeniden üretmez; ortak puan
 * motorunun değerlendirme sonuçlarını toplar. Sonuçlar yalnızca gönderilmiş
 * değerlendirmelerden gelir: cevaplanmamış soru en düşük seviye sayıldığı
 * için taslak, olgunluğu değil doluluğu ölçer. Taslaklar katılımda görünür.
 */
export function buildUnitManagementAnalytics(input: {
  members: ManagementUnit[]; rows: UnitAssessmentRow[]; details: UnitAssessmentDetail[];
  benchmarks?: ManagementBenchmark[]; ironmanBenchmarks?: ManagementIronmanBenchmark[]; now?: Date;
}) {
  const { members, rows } = input;
  const now = input.now ?? new Date();
  const benchmarks = input.benchmarks ?? [];
  const ironmanBenchmarks = input.ironmanBenchmarks ?? [];
  const memberById = new Map(members.map(unit => [unit.id, unit]));
  const rowByAssessment = new Map(rows.flatMap(row => row.assessmentId ? [[row.assessmentId, row] as const] : []));
  const rowByUnit = new Map(rows.map(row => [row.unitId, row]));
  const started = input.details.filter(detail => {
    const row = rowByAssessment.get(detail.assessment.id);
    return row && row.unitId === detail.assessment.unitId && memberById.has(row.unitId);
  });
  const submitted = started.filter(detail => rowByAssessment.get(detail.assessment.id)!.status === "SUBMITTED" && detail.answeredQuestions > 0);
  const detailByUnit = new Map(started.map(detail => [detail.assessment.unitId, detail]));
  const resultByUnit = new Map(submitted.map(detail => [detail.assessment.unitId, detail]));

  // Sonuçlar
  const scores = submitted.map(detail => detail.scores.overallPercentage);
  const overallPairs = submitted.flatMap(detail => {
    const benchmark = benchmarkFor(memberById.get(detail.assessment.unitId), benchmarks);
    return benchmark === null ? [] : [{ current: detail.scores.overallPercentage, previous: benchmark }];
  });
  const withPrevious = submitted.filter(detail => detail.previous);
  const results = {
    count: submitted.length, average: mean(scores), median: scores.length ? median(scores) : null, levels: levelCounts(scores),
    benchmark: mean(overallPairs.map(pair => pair.previous)), benchmarkCount: overallPairs.length, difference: difference(overallPairs),
    previousAverage: mean(withPrevious.map(detail => detail.previous!.percentage)), pairedCount: withPrevious.length,
    change: difference(withPrevious.map(detail => ({ current: detail.scores.overallPercentage, previous: detail.previous!.percentage }))),
  };

  // Soru düzeyi: birden çok üyenin ölçeğin alt yarısında kaldığı sorular
  type QuestionStat = { id: string; text: string; categoryId: string; categoryName: string; sectionName: string; answered: number; low: number; ratioSum: number };
  const questionStats = new Map<string, QuestionStat>();
  for (const detail of submitted) for (const question of questionsOf(detail)) {
    if (question.ratio === null) continue;
    const stat = questionStats.get(question.id) ?? { id: question.id, text: question.text, categoryId: question.categoryId, categoryName: question.categoryName, sectionName: question.sectionName, answered: 0, low: 0, ratioSum: 0 };
    stat.answered++; stat.ratioSum += question.ratio;
    if (question.ratio < LOW_ANSWER_RATIO) stat.low++;
    questionStats.set(question.id, stat);
  }
  const recommendationByQuestion = new Map<string, { id: string; title: string; impact: number }>();
  for (const detail of submitted) for (const rec of detail.recommendations) {
    if (!rec.questionId) continue;
    const known = recommendationByQuestion.get(rec.questionId);
    if (!known || rec.estimatedImpact > known.impact) recommendationByQuestion.set(rec.questionId, { id: rec.id, title: rec.title, impact: rec.estimatedImpact });
  }
  const byGap = (a: QuestionStat, b: QuestionStat) =>
    b.low - a.low || b.low / b.answered - a.low / a.answered || a.ratioSum / a.answered - b.ratioSum / b.answered || a.text.localeCompare(b.text, "tr");
  const toGap = (stat: QuestionStat) => {
    const rec = recommendationByQuestion.get(stat.id);
    return { id: stat.id, text: stat.text, categoryId: stat.categoryId, categoryName: stat.categoryName, sectionName: stat.sectionName,
      answered: stat.answered, low: stat.low, share: Math.round(stat.low / stat.answered * 100), recommendation: rec ? { id: rec.id, title: rec.title } : null };
  };
  const commonGaps = [...questionStats.values()].filter(stat => stat.low >= 2).sort(byGap).slice(0, 10).map(toGap);

  // Kategoriler
  const categoryList = [...new Map(started.flatMap(detail => detail.categories.map(category => [category.id, category.name] as const))).entries()].map(([id, name]) => ({ id, name }));
  const categories = categoryList.map(category => {
    const entries = submitted.flatMap(detail => {
      const item = detail.categories.find(row => row.id === category.id && row.answeredQuestions > 0);
      return item ? [{ detail, item, value: round(item.currentPercentage) }] : [];
    });
    const points = entries.map(({ detail, value }) => ({ unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, value }))
      .sort((a, b) => b.value - a.value || a.unitName.localeCompare(b.unitName, "tr"));
    const average = mean(points.map(point => point.value));
    const paired = entries.flatMap(({ detail, item }) => {
      const benchmark = benchmarkFor(memberById.get(detail.assessment.unitId), benchmarks, category.id);
      return benchmark === null ? [] : [{ current: item.currentPercentage, previous: benchmark }];
    });
    const previous = entries.flatMap(({ detail, item }) => {
      const value = detail.previous?.categories.find(row => row.id === category.id)?.currentPercentage;
      return value == null ? [] : [{ current: item.currentPercentage, previous: value }];
    });
    const lowest = [...questionStats.values()].filter(stat => stat.categoryId === category.id && stat.low > 0).sort(byGap)[0];
    return {
      id: category.id, name: category.name, count: points.length, average, median: points.length ? median(points.map(point => point.value)) : null,
      highest: points[0] ?? null, lowest: points.at(-1) ?? null,
      above: average === null ? 0 : points.filter(point => point.value > average).length,
      below: average === null ? 0 : points.filter(point => point.value < average).length,
      belowDeveloping: points.filter(point => point.value < DEVELOPING).length,
      levels: levelCounts(points.map(point => point.value)),
      benchmark: mean(paired.map(pair => pair.previous)), benchmarkCount: paired.length,
      change: difference(previous), pairedCount: previous.length,
      points, lowestQuestion: lowest ? toGap(lowest) : null,
    };
  });

  // Üye tablosu: atanmış olsun olmasın bütün üyeler
  const memberRows = members.map(unit => {
    const row = rowByUnit.get(unit.id) ?? null;
    const detail = detailByUnit.get(unit.id) ?? null;
    const result = resultByUnit.get(unit.id) ?? null;
    const score = result ? result.scores.overallPercentage : null;
    const benchmark = result ? benchmarkFor(unit, benchmarks) : null;
    return {
      unitId: unit.id, unitName: unit.name, sectorName: unit.sectorName, employeeCount: unit.employeeCount, sizeLabel: unitSizeLabel(unit.employeeCount),
      rowId: row?.id ?? null, assessmentId: row?.assessmentId ?? null, surveyId: row?.surveyId ?? null,
      status: row?.status ?? null, overdue: row?.overdue ?? false, deadline: row?.deadline ?? null, completion: row ? row.completionPercentage : null,
      score, level: score === null ? null : maturityFromPercentage(score),
      categories: Object.fromEntries(categoryList.map(category => {
        const item = result?.categories.find(row => row.id === category.id && row.answeredQuestions > 0);
        return [category.id, item ? round(item.currentPercentage) : null];
      })) as Record<string, number | null>,
      previous: result?.previous?.percentage ?? null,
      change: result?.previous ? result.scores.overallPercentage - result.previous.percentage : null,
      benchmarkDifference: score === null || benchmark === null ? null : round(score - benchmark),
      evidence: detail ? evidenceOf(detail) : { required: 0, documented: 0 },
      contributorCount: detail?.summary.contributorCount ?? 0,
      lastActivityAt: detail ? lastActivity(detail) : null,
      nextGap: detail?.work[0] ? { title: detail.work[0].title, assigneeName: detail.work[0].assigneeName } : null,
    };
  });

  // Katılım
  const submittedCount = rows.filter(row => row.status === "SUBMITTED").length;
  const notStarted = rows.filter(row => row.status === "NOT_STARTED").length;
  const participation = {
    members: members.length, assigned: rows.length, unassigned: members.filter(unit => !rowByUnit.has(unit.id)).length,
    submitted: submittedCount, notStarted, inProgress: rows.length - submittedCount - notStarted,
    readyToSubmit: rows.filter(row => row.status === "READY_TO_SUBMIT").length, overdue: rows.filter(row => row.overdue).length,
    completionRate: rows.length ? round(submittedCount / rows.length * 100) : 0,
    pending: memberRows.filter(row => row.status && row.status !== "SUBMITTED")
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.completion ?? 0) - (b.completion ?? 0) || a.unitName.localeCompare(b.unitName, "tr")),
  };

  // Dönemler arası: anketle ölçülen değişim ve önceki dönemde beyan edilen gelişim
  const changeRows = withPrevious.map(detail => {
    const previous = detail.previous!;
    const measured = detail.scores.baselineOverallPercentage - previous.baselinePercentage;
    return {
      unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, assessmentId: detail.assessment.id, surveyId: detail.assessment.surveyId,
      previousPeriod: previous.period, previousSurvey: previous.baselinePercentage, currentSurvey: detail.scores.baselineOverallPercentage,
      measured: round(measured), declared: previous.deltaPercentage, gap: round(previous.deltaPercentage - measured),
    };
  }).sort((a, b) => b.gap - a.gap || a.unitName.localeCompare(b.unitName, "tr"));
  const change = {
    pairedCount: changeRows.length, measured: mean(changeRows.map(row => row.measured)), declared: mean(changeRows.map(row => row.declared)), rows: changeRows,
  };

  // Ironman: iki ekseni birlikte ölçülen gönderimler
  const axes = submitted.filter(detail => detail.scores.velocityWeight > 0 && detail.scores.enduranceWeight > 0);
  const velocity = mean(axes.map(detail => detail.scores.velocityScore));
  const endurance = mean(axes.map(detail => detail.scores.enduranceScore));
  const axisBenchmarks = axes.flatMap(detail => {
    const benchmark = ironmanFor(memberById.get(detail.assessment.unitId), ironmanBenchmarks);
    return benchmark ? [benchmark] : [];
  });
  const ironman = {
    count: axes.length, velocity, endurance, threshold: QUADRANT_THRESHOLD, benchmarkCount: axisBenchmarks.length,
    benchmarkVelocity: mean(axisBenchmarks.map(value => value.velocityAverage)), benchmarkEndurance: mean(axisBenchmarks.map(value => value.enduranceAverage)),
    targetVelocity: mean(axisBenchmarks.map(value => value.velocityAverageTarget)), targetEndurance: mean(axisBenchmarks.map(value => value.enduranceAverageTarget)),
    quadrant: velocity === null || endurance === null ? null : classifyQuadrant(velocity, endurance),
    distribution: ["IRONMAN", "SPRINTER", "MARATHON_RUNNER", "WALKER"].map(key => ({ key, count: axes.filter(detail => detail.scores.quadrant === key).length })),
    points: axes.map(detail => ({ unitId: detail.assessment.unitId, unitName: detail.assessment.unitName, velocity: detail.scores.velocityScore, endurance: detail.scores.enduranceScore, quadrant: detail.scores.quadrant })),
  };

  const roadmap = buildRoadmapAnalytics({ details: submitted, categories: categories.map(({ id, name, average }) => ({ id, name, average })), now });

  // Cevap şeridi ve yazılı özet
  const ranked = categories.filter(category => category.average !== null).sort((a, b) => a.average! - b.average! || a.name.localeCompare(b.name, "tr"));
  const lowestCategory = ranked[0] ?? null;
  const evidence = submitted.map(evidenceOf).reduce((sum, row) => ({ required: sum.required + row.required, documented: sum.documented + row.documented }), { required: 0, documented: 0 });
  const answer = {
    score: results.average, change: results.change, pairedCount: results.pairedCount, benchmarkDifference: results.difference,
    lowestCategory: lowestCategory ? { id: lowestCategory.id, name: lowestCategory.name, average: lowestCategory.average!, belowDeveloping: lowestCategory.belowDeveloping, count: lowestCategory.count } : null,
    nextAction: roadmap.nextAction,
    data: { members: members.length, assigned: rows.length, submitted: submittedCount, evidenceRequired: evidence.required, evidenceDocumented: evidence.documented,
      evidenceRate: evidence.required ? Math.round(evidence.documented / evidence.required * 100) : null },
  };
  const n = (value: number) => value.toLocaleString("tr-TR");
  const signed = (value: number) => (value > 0 ? "+" : "") + value.toLocaleString("tr-TR");
  const summary: string[] = [];
  if (results.average !== null) {
    summary.push(`Birim puanı %${n(results.average)}, gönderilen ${results.count} değerlendirmeden hesaplandı` +
      (results.change !== null ? `; aynı ${results.pairedCount} üyede önceki döneme göre ${signed(results.change)} puan` : "") +
      (results.difference !== null ? `; sektör kıyasına göre ${signed(results.difference)} puan` : "") + ".");
  }
  if (ranked.length > 1) summary.push(`En yüksek kategori ortalaması ${ranked.at(-1)!.name} (%${n(ranked.at(-1)!.average!)}), en düşük ${ranked[0].name} (%${n(ranked[0].average!)}).`);
  if (rows.length && submittedCount < rows.length) summary.push(`Atanan ${rows.length} üyenin ${submittedCount} tanesi gönderdi; gönderilmeyen değerlendirmeler sonuçlara katılmaz.`);
  if (roadmap.totals.overdue) summary.push(`${roadmap.totals.overdue} yol haritası işinin hedef tarihi geçti.`);
  if (roadmap.untouched[0]) summary.push(`“${roadmap.untouched[0].title}” önerisi ${roadmap.untouched[0].eligible} üyeye uygulanabilir; henüz hiçbir üyenin yol haritasında değil.`);
  if (evidence.required) summary.push(`Belge gerektiren ${evidence.required} cevabın ${evidence.documented} tanesi belgeli.`);

  const activity = started.map(lastActivity).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return {
    scope: { memberCount: members.length, activeUserCount: members.reduce((sum, unit) => sum + unit.activeUserCount, 0), lastActivityAt: activity },
    answer, summary, participation, results, categories, members: memberRows, commonGaps, roadmap, change, ironman,
  };
}
export type UnitManagementAnalytics = ReturnType<typeof buildUnitManagementAnalytics>;
