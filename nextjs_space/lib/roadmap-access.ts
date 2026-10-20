import { prisma } from "./db";
import { isUserCoordinator } from "./assessment";
import type { DbClient } from "./scoring";

export const ROADMAP_FORBIDDEN = "Yol haritasını birim yöneticisi planlar. Size atanan işlerin durumunu güncelleyebilirsiniz.";

/**
 * Yol haritası yetkisi.
 *
 * Koordinatör — birim yöneticisi, sistem yöneticisi, birime bağlı olmayan
 * kullanıcı — iş ekler, siler, planlar ve her işin durumunu değiştirir.
 * Çalışan yalnızca yol haritasında olan ve kendisine düşen işin durumunu
 * değiştirir: iş ona atanmışsa, ya da işin sorumlusu yoksa ve önerinin
 * bölümü ona atanmışsa (birim panosundaki "Sorumlu" gösterimiyle aynı kural).
 *
 * Eskiden birime bağlı her kullanıcı ortak yol haritasına iş ekleyip
 * silebiliyor ve herhangi bir işi tamamlandı diye işaretleyip birimin
 * puanını artırabiliyordu.
 */
export async function loadRoadmapAccess(userId: string, assessmentIds: string[], db: DbClient = prisma) {
  if (await isUserCoordinator(userId, db)) {
    return { canManage: true, canUpdate: (_recommendationId: string) => true };
  }
  const [items, assignments] = await Promise.all([
    db.roadmapItem.findMany({
      where: { assessmentId: { in: assessmentIds } },
      select: {
        assessmentId: true, recommendationId: true, assigneeId: true,
        recommendation: { select: {
          subCategoryId: true, subLevel: { select: { subCategoryId: true } },
          question: { select: { subCategoryId: true, subLevel: { select: { subCategoryId: true } } } },
        } },
      },
    }),
    db.sectionAssignment.findMany({ where: { assessmentId: { in: assessmentIds } }, select: { assessmentId: true, subCategoryId: true, assigneeId: true } }),
  ]);
  const sectionOwner = new Map(assignments.map(row => [row.assessmentId + ":" + row.subCategoryId, row.assigneeId]));
  const owned = new Set(items.filter(item => {
    if (item.assigneeId) return item.assigneeId === userId;
    const rec = item.recommendation;
    const section = rec.subLevel?.subCategoryId ?? rec.subCategoryId ?? rec.question?.subLevel?.subCategoryId ?? rec.question?.subCategoryId ?? null;
    return section !== null && sectionOwner.get(item.assessmentId + ":" + section) === userId;
  }).map(item => item.recommendationId));
  return { canManage: false, canUpdate: (recommendationId: string) => owned.has(recommendationId) };
}
