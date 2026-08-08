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
import {
  type SectionAssignment,
  type SectionVisibility,
  buildSectionVisibility,
} from "./section-assignment";

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

/**
 * Kullanıcının yönettiği birimler — alt birimler dahil.
 *
 * Bir birimin yöneticisi, o birimin altındaki birimlerin de yöneticisidir:
 * hiyerarşi zaten "sorumluluk aşağı doğru genişler" demek. Tüm birimler tek
 * sorguda çekilip kapanış bellekte hesaplanır; ağaç küçük ama bu fonksiyon
 * anket ekranının her açılışında çalışıyor.
 */
export async function getManagedUnitIds(
  userId: string,
  db: DbClient = prisma
): Promise<string[]> {
  const direct = await db.unitAdmin.findMany({
    where: { userId },
    select: { unitId: true },
  });

  if (direct.length === 0) return [];

  const units = await db.unit.findMany({ select: { id: true, parentId: true } });

  const childrenOf = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.parentId) continue;
    const siblings = childrenOf.get(unit.parentId) ?? [];
    siblings.push(unit.id);
    childrenOf.set(unit.parentId, siblings);
  }

  const managed = new Set<string>();
  const queue = direct.map((admin) => admin.unitId);

  while (queue.length > 0) {
    const unitId = queue.pop()!;
    if (managed.has(unitId)) continue; // döngüsel hiyerarşiye karşı emniyet
    managed.add(unitId);
    queue.push(...(childrenOf.get(unitId) ?? []));
  }

  return Array.from(managed);
}

/**
 * Kullanıcının bir anketteki değerlendirmesi ve oradaki rolü.
 *
 * Yazma yapmaz: değerlendirme henüz açılmamışsa `assessmentId` null döner.
 * Koordinatörlük yine de çözülür — dağıtım ekranı, ilk cevap girilmeden önce
 * de açılabilmeli.
 */
export type AssessmentContext = {
  assessmentId: string | null;
  unitId: string | null;
  /** Görev dağıtan ve sonunda gönderen kişi. */
  isCoordinator: boolean;
};

export async function getAssessmentContext(
  userId: string,
  surveyId: string,
  db: DbClient = prisma
): Promise<AssessmentContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { unitId: true, role: true },
  });

  const assessment = await db.assessment.findFirst({
    where: user?.unitId
      ? { surveyId, unitId: user.unitId }
      : { surveyId, ownerUserId: userId },
    select: { id: true, unitId: true },
  });

  const unitId = assessment?.unitId ?? user?.unitId ?? null;

  return {
    assessmentId: assessment?.id ?? null,
    unitId,
    isCoordinator: await resolveCoordinator(userId, user?.role ?? "USER", unitId, db),
  };
}

/**
 * Koordinatör kimdir?
 *
 * Birimin (ya da üstündeki bir birimin) yöneticisi. Sistem yöneticisi her
 * yerde koordinatör sayılır. Kuruluşu olmayan kullanıcı kendi tek kişilik
 * değerlendirmesinin koordinatörüdür — tek başına çalışan birinin görev
 * dağıtacak kimsesi yok, bütün bölümler zaten onun.
 */
async function resolveCoordinator(
  userId: string,
  role: string,
  unitId: string | null,
  db: DbClient
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (!unitId) return true;
  const managed = await getManagedUnitIds(userId, db);
  return managed.includes(unitId);
}

/** Bir değerlendirmenin bölüm atamaları. */
export async function getSectionAssignments(
  assessmentId: string,
  db: DbClient = prisma
): Promise<SectionAssignment[]> {
  const rows = await db.sectionAssignment.findMany({
    where: { assessmentId },
    select: { subCategoryId: true, assigneeId: true },
  });
  return rows;
}

/**
 * Kullanıcının bu ankette hangi bölümleri görebileceği.
 *
 * Anket ekranı, cevap kaydetme ve dağıtım ekranı aynı kaynaktan beslenir;
 * görünürlük kuralı tek yerde durur (bkz. lib/section-assignment).
 */
export async function getSectionVisibility(
  userId: string,
  surveyId: string,
  db: DbClient = prisma
): Promise<SectionVisibility & AssessmentContext> {
  const context = await getAssessmentContext(userId, surveyId, db);
  const assignments = context.assessmentId
    ? await getSectionAssignments(context.assessmentId, db)
    : [];

  return {
    ...context,
    ...buildSectionVisibility(assignments, {
      userId,
      isCoordinator: context.isCoordinator,
    }),
  };
}

/**
 * Değerlendirmeye katkı verebilecek kullanıcılar.
 *
 * Sahiplik üzerinden çözülür, kaydın kendisi üzerinden değil: dağıtım ekranı
 * ilk cevap girilmeden — yani değerlendirme henüz açılmadan — önce de
 * açılabilmeli.
 */
export async function getContributorCandidates(
  owner: { unitId: string | null; ownerUserId?: string | null },
  db: DbClient = prisma
) {
  if (owner.unitId) {
    return db.user.findMany({
      where: { unitId: owner.unitId, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { email: "asc" },
    });
  }

  if (owner.ownerUserId) {
    return db.user.findMany({
      where: { id: owner.ownerUserId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  return [];
}

/** Aynı liste, değerlendirme kimliğinden (koordinatör panosu için). */
export async function getAssessmentMembers(
  assessmentId: string,
  db: DbClient = prisma
) {
  const assessment = await db.assessment.findUnique({
    where: { id: assessmentId },
    select: { unitId: true, ownerUserId: true },
  });

  if (!assessment) return [];
  return getContributorCandidates(assessment, db);
}
