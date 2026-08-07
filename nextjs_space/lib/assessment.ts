/**
 * Değerlendirme sahipliği.
 *
 * Değerlendirmenin sahibi kişi değil kuruluştur: büyük bir şirkette anketin
 * farklı bölümlerini farklı departmanlar doldurur (atık → çevre, enerji →
 * teknik, sosyal → İK) ve ortaya tek bir kurumsal puan çıkması gerekir.
 * Cevaplar kişiye bağlıyken üç kişi üç ayrı yarım değerlendirme üretiyordu.
 *
 * Kuruluşu olmayan kullanıcı için tek kişilik değerlendirme açılır; davranış
 * bugünküyle birebir aynı kalır. Bu sayede puanlama fonksiyonlarının imzaları
 * `userId` almaya devam eder ve çağıran tarafların çoğu değişmez.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Kullanıcının bir anketteki değerlendirmesini bulur; yoksa oluşturur.
 *
 * Kullanıcı bir kuruluşa bağlıysa değerlendirme o kuruluşa aittir ve aynı
 * kuruluştaki herkes aynı değerlendirmeye katkı verir. Bağlı değilse kendi
 * adına tek kişilik bir değerlendirme açılır.
 */
export async function getOrCreateAssessment(
  userId: string,
  surveyId: string,
  db: DbClient = prisma
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { unitId: true },
  });

  const where = user?.unitId
    ? { surveyId, unitId: user.unitId }
    : { surveyId, ownerUserId: userId };

  const existing = await db.assessment.findFirst({ where });
  if (existing) return existing.id;

  const created = await db.assessment.create({
    data: user?.unitId
      ? { surveyId, unitId: user.unitId }
      : { surveyId, ownerUserId: userId },
  });
  return created.id;
}

/**
 * Kullanıcının erişebildiği değerlendirmelerin kimlikleri.
 *
 * Puanlama ve öneriler bunlar üzerinden okunur. Yazma yapmaz: henüz
 * başlanmamış bir ankette boş dizi döner ve çağıran taraf bunu "cevap yok"
 * olarak yorumlar — kullanıcı ankete girmeden kayıt oluşmaz.
 */
export async function getAssessmentIds(
  userId: string,
  surveyIds: string[],
  db: DbClient = prisma
): Promise<string[]> {
  if (surveyIds.length === 0) return [];

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { unitId: true },
  });

  const assessments = await db.assessment.findMany({
    where: {
      surveyId: { in: surveyIds },
      ...(user?.unitId ? { unitId: user.unitId } : { ownerUserId: userId }),
    },
    select: { id: true },
  });

  return assessments.map((assessment) => assessment.id);
}

/** Değerlendirmeye katkı verebilecek kullanıcılar (koordinatör panosu için). */
export async function getAssessmentMembers(
  assessmentId: string,
  db: DbClient = prisma
) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { unitId: true, ownerUserId: true },
  });

  if (!assessment) return [];

  if (assessment.unitId) {
    return db.user.findMany({
      where: { unitId: assessment.unitId, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { email: "asc" },
    });
  }

  if (assessment.ownerUserId) {
    return db.user.findMany({
      where: { id: assessment.ownerUserId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  return [];
}
