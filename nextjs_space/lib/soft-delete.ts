import { prisma } from "./db";
import { buildSurveyQuestionWhere } from "./scoring";

/**
 * Soft-delete (arşivleme) yardımcıları.
 *
 * İçerik ağacı (Survey → Category → SubCategory → SubLevel → Question) artık
 * kalıcı silinmez; `archivedAt` damgalanır. Böylece bir anket/soru silindiğinde
 * kullanıcıların `SurveyResponse` kayıtları KAYBOLMAZ (denetim/uyumluluk).
 *
 * Bir düğüm arşivlenirken tüm alt-ağacı da arşivlenir; böylece okuma sorguları
 * her seviyede yalnızca `archivedAt: null` filtresi uygulayarak alt-ağacın
 * tamamını gizleyebilir.
 *
 * Tüm işlemler tek transaction içinde yürütülür (atomik).
 */

const now = () => new Date();

export async function archiveQuestion(id: string) {
  return prisma.question.update({
    where: { id },
    data: { archivedAt: now() },
  });
}

export async function archiveSubLevel(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { subLevelId: id, archivedAt: null },
      data: { archivedAt: now() },
    });
    return tx.subLevel.update({ where: { id }, data: { archivedAt: now() } });
  });
}

export async function archiveSubCategory(id: string) {
  return prisma.$transaction(async (tx) => {
    // Alt seviyelere bağlı sorular
    await tx.question.updateMany({
      where: { subLevel: { subCategoryId: id }, archivedAt: null },
      data: { archivedAt: now() },
    });
    // Doğrudan alt kategoriye bağlı sorular
    await tx.question.updateMany({
      where: { subCategoryId: id, archivedAt: null },
      data: { archivedAt: now() },
    });
    await tx.subLevel.updateMany({
      where: { subCategoryId: id, archivedAt: null },
      data: { archivedAt: now() },
    });
    return tx.subCategory.update({ where: { id }, data: { archivedAt: now() } });
  });
}

export async function archiveCategory(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: {
        OR: [
          { categoryId: id },
          { subCategory: { categoryId: id } },
          { subLevel: { subCategory: { categoryId: id } } },
        ],
        archivedAt: null,
      },
      data: { archivedAt: now() },
    });
    await tx.subLevel.updateMany({
      where: { subCategory: { categoryId: id }, archivedAt: null },
      data: { archivedAt: now() },
    });
    await tx.subCategory.updateMany({
      where: { categoryId: id, archivedAt: null },
      data: { archivedAt: now() },
    });
    return tx.category.update({ where: { id }, data: { archivedAt: now() } });
  });
}

export async function archiveSurvey(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { ...buildSurveyQuestionWhere(id), archivedAt: null },
      data: { archivedAt: now() },
    });
    await tx.subLevel.updateMany({
      where: { subCategory: { category: { surveyId: id } }, archivedAt: null },
      data: { archivedAt: now() },
    });
    await tx.subCategory.updateMany({
      where: { category: { surveyId: id }, archivedAt: null },
      data: { archivedAt: now() },
    });
    await tx.category.updateMany({
      where: { surveyId: id, archivedAt: null },
      data: { archivedAt: now() },
    });
    return tx.survey.update({ where: { id }, data: { archivedAt: now() } });
  });
}
