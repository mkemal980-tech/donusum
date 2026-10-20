import { prisma } from "./db";
import type { DbClient } from "./assessment";
import type { ManagedActor } from "./managed-assessment";
import { resolveViewableAssessment } from "./assessment-view";
import { loadManagedStructure } from "./unit-dashboard";
import { loadProgressInputs, summarizeProgress, computeProgressBreakdown } from "./scoring";

/** Birim ortalaması en az bu kadar üye gönderdiğinde gösterilir; küçük grupta ortalama tek tek puanları ele verir. */
export const MINIMUM_GROUP_SIZE = 5;
/** Yüzdelik dilimin en küçük adımı. */
const BAND_STEP = 5;
/** Bir dilimde en az bu kadar üye kalır; dilim sıranın yerine geçmez. */
const BAND_MIN_MEMBERS = 3;
const round = (value: number) => Math.round(value * 10) / 10;
const average = (values: number[]) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;

/**
 * Yüzdelik dilim: üyenin, en yüksek puandan başlayarak üyelerin ilk yüzde
 * kaçı içinde kaldığı. En küçük adım %5'tir; küçük grupta dilim, en az üç
 * üyeyi kapsayacak kadar genişler (20 üye → %15, 10 üye → %30).
 */
export function percentileBand(rank: number, count: number) {
  const width = Math.max(BAND_STEP, Math.ceil(BAND_MIN_MEMBERS * 100 / (count * BAND_STEP)) * BAND_STEP);
  return { value: Math.min(100, Math.ceil(rank * 100 / (count * width)) * width), width };
}

/**
 * Üyenin kendi panosundaki birim kıyası: aynı üst birimin altındaki üyelerin
 * aynı anket ve dönemdeki gönderilmiş sonuçları. Kardeş üyeler üyenin yetki
 * kapsamında değildir; bu yüzden dışarıya yalnızca toplu sayı çıkar, ad veya
 * tekil puan çıkmaz. Puanlar üyenin kendi panosundaki "mevcut puan"la aynı
 * motordan gelir.
 */
export async function loadUnitGroupComparison(actor: ManagedActor, assessmentId: string, db: DbClient = prisma) {
  // Yönetici kapsamındaki ya da kişinin kendi birimindeki değerlendirme; çıktı yalnızca toplu sayı.
  const { record } = await resolveViewableAssessment(actor, assessmentId, db);
  if (!record.unitId) return { available: false as const, reason: "NO_GROUP" as const, groupName: null };
  const unit = await db.unit.findUnique({ where: { id: record.unitId }, select: { parentId: true, parent: { select: { name: true } } } });
  if (!unit?.parentId || !unit.parent) return { available: false as const, reason: "NO_GROUP" as const, groupName: null };
  const groupName = unit.parent.name;
  if (record.status !== "SUBMITTED") return { available: false as const, reason: "NOT_SUBMITTED" as const, groupName };
  const campaign = record.campaignRecipient?.campaign ?? null;
  const [siblings, cohort] = await Promise.all([
    db.assessment.findMany({
      where: { surveyId: record.surveyId, status: "SUBMITTED", survey: { isDemo: false }, unit: { parentId: unit.parentId },
        ...(campaign ? { campaignRecipient: { campaignId: campaign.id } } : { campaignRecipientId: null }) },
      select: { id: true, unit: { select: { sectorId: true, subSectorId: true } } },
    }),
    campaign ? db.surveyCampaign.findUnique({ where: { id: campaign.id }, select: { minimumCohortSize: true } }) : null,
  ]);
  const required = Math.max(MINIMUM_GROUP_SIZE, cohort?.minimumCohortSize ?? 0);
  if (siblings.length < required) return { available: false as const, reason: "COHORT" as const, groupName, count: siblings.length, required };

  // Aynı sektör profilindeki üyeler aynı soru kapsamını paylaşır; yapı bir kez yüklenir.
  const structures = new Map<string, ReturnType<typeof loadManagedStructure>>();
  const structureFor = (row: (typeof siblings)[number]) => {
    const key = (row.unit?.sectorId ?? "") + ":" + (row.unit?.subSectorId ?? "");
    if (!structures.has(key)) structures.set(key, loadManagedStructure({ id: row.id, surveyId: record.surveyId, sectorId: row.unit?.sectorId ?? null, subSectorId: row.unit?.subSectorId ?? null }, db));
    return structures.get(key)!;
  };
  const results: { id: string; overall: number; categories: Map<string, number | null> }[] = [];
  for (let offset = 0; offset < siblings.length; offset += 4) {
    results.push(...await Promise.all(siblings.slice(offset, offset + 4).map(async row => {
      const structure = await structureFor(row);
      const inputs = await loadProgressInputs(actor.userId, { assessment: { ...structure.scoring, id: row.id }, db });
      return {
        id: row.id, overall: summarizeProgress(inputs).overallPercentage,
        categories: new Map(computeProgressBreakdown(inputs, structure.categories).map(category => [category.id, category.totalScore ? round(Math.max(0, (category.totalScore - 1) / 4 * 100)) : null])),
      };
    })));
  }
  const mine = results.find(row => row.id === record.id)!;
  const own = await loadManagedStructure(record.scoring, db);
  const overallAverage = average(results.map(row => row.overall))!;
  return {
    available: true as const, groupName, count: results.length,
    overall: { mine: mine.overall, average: overallAverage, difference: round(mine.overall - overallAverage) },
    categories: own.categories.map(category => {
      const values = results.flatMap(row => { const value = row.categories.get(category.id); return value == null ? [] : [value]; });
      const value = mine.categories.get(category.id) ?? null;
      // Kategoriyi yeterince üye cevaplamadıysa ortalama, tek tek puanları ele verebilir.
      const groupAverage = values.length >= required ? average(values) : null;
      return { id: category.id, name: category.name, mine: value, average: groupAverage, difference: value === null || groupAverage === null ? null : round(value - groupAverage) };
    }),
    band: percentileBand(1 + results.filter(row => row.overall > mine.overall).length, results.length),
  };
}
export type UnitGroupComparison = Awaited<ReturnType<typeof loadUnitGroupComparison>>;
