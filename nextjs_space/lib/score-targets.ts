import { prisma } from "./db";
import type { DbClient } from "./assessment";
import type { ResolvedAssessment } from "./managed-assessment";

/**
 * Kuruluşun kendi koyduğu hedef: anketin geneli ve kategoriler için 100
 * üzerinden puan ve isteğe bağlı tarih. Hedef dönemden bağımsızdır; birim
 * değerlendirmesinde birime, kişisel değerlendirmede sahibine aittir. Hedef
 * yoksa panoda hedef gösterilmez — varsayılan bir hedef uydurulmaz.
 */
export type TargetValue = { percentage: number; targetDate: string | null };
export type AssessmentTargets = { overall: TargetValue | null; categories: Record<string, TargetValue> };

type TargetOwner = Pick<ResolvedAssessment, "surveyId" | "unitId" | "ownerUserId">;
const ownerOf = (record: TargetOwner) => record.unitId ? { unitId: record.unitId } : { ownerUserId: record.ownerUserId };
const iso = (date: Date | null) => date?.toISOString() ?? null;

export async function loadAssessmentTargets(record: TargetOwner, db: DbClient = prisma): Promise<AssessmentTargets> {
  if (!record.unitId && !record.ownerUserId) return { overall: null, categories: {} };
  const rows = await db.scoreTarget.findMany({
    where: { surveyId: record.surveyId, ...ownerOf(record) },
    select: { categoryId: true, percentage: true, targetDate: true },
  });
  const value = (row: (typeof rows)[number]) => ({ percentage: row.percentage, targetDate: iso(row.targetDate) });
  const overall = rows.find(row => row.categoryId === null);
  return {
    overall: overall ? value(overall) : null,
    categories: Object.fromEntries(rows.filter(row => row.categoryId).map(row => [row.categoryId!, value(row)])),
  };
}

export class TargetValidationError extends Error {}

/** Yüzde 0'dan büyük ve en çok 100; tarih YYYY-AA-GG (gün sonu, İstanbul) ya da boş. */
function parseTarget(input: unknown, label: string) {
  if (!input || typeof input !== "object") throw new TargetValidationError(label + " hedefi geçersiz.");
  const { percentage, targetDate } = input as { percentage?: unknown; targetDate?: unknown };
  if (typeof percentage !== "number" || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    throw new TargetValidationError(label + " hedefi 0'dan büyük, en çok 100 olmalı.");
  }
  let date: Date | null = null;
  if (targetDate !== null && targetDate !== undefined && targetDate !== "") {
    if (typeof targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || new Date(targetDate).toISOString().slice(0, 10) !== targetDate) {
      throw new TargetValidationError(label + " hedef tarihi geçerli bir tarih olmalı.");
    }
    date = new Date(targetDate + "T23:59:59.999+03:00");
  }
  return { percentage: Math.round(percentage * 10) / 10, targetDate: date };
}

/**
 * Hedefleri bütün olarak değiştirir: gönderilmeyen hedef silinir. Kategoriler
 * değerlendirmenin anketine ait ve arşivlenmemiş olmalıdır.
 */
export async function saveAssessmentTargets(
  actorId: string, record: TargetOwner, input: { overall?: unknown; categories?: unknown }, db: DbClient = prisma,
) {
  if (!record.unitId && !record.ownerUserId) throw new TargetValidationError("Bu değerlendirmeye hedef konamaz.");
  const overall = input.overall === null || input.overall === undefined ? null : parseTarget(input.overall, "Genel");
  if (input.categories !== undefined && !Array.isArray(input.categories)) throw new TargetValidationError("Kategori hedefleri liste olmalı.");
  const rows = (input.categories ?? []) as { categoryId?: unknown }[];
  const ids = rows.map(row => row?.categoryId);
  if (ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) throw new TargetValidationError("Her kategoriye en çok bir hedef konur.");
  const known = new Map((await db.category.findMany({
    where: { id: { in: ids as string[] }, surveyId: record.surveyId, archivedAt: null }, select: { id: true, name: true },
  })).map(row => [row.id, row.name]));
  if (known.size !== ids.length) throw new TargetValidationError("Kategori bu ankete ait değil.");
  const categories = rows.map(row => ({ categoryId: row.categoryId as string, ...parseTarget(row, known.get(row.categoryId as string)!) }));
  const owner = ownerOf(record);
  const data = [...(overall ? [{ categoryId: null, ...overall }] : []), ...categories]
    .map(row => ({ ...row, ...owner, surveyId: record.surveyId, setById: actorId }));
  const write = async (tx: DbClient) => {
    await tx.scoreTarget.deleteMany({ where: { surveyId: record.surveyId, ...owner } });
    if (data.length) await tx.scoreTarget.createMany({ data });
  };
  if ("$transaction" in db) await db.$transaction(tx => write(tx));
  else await write(db);
  return loadAssessmentTargets(record, db);
}
