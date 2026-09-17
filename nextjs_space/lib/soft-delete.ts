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

/**
 * Arşivi geri alma.
 *
 * `archive*` fonksiyonları vardı ama geri alma yoktu: yanlışlıkla arşivlenen
 * bir kategori yalnızca veritabanına elle müdahaleyle geri geliyordu. Oysa
 * soft-delete'in amacı tam olarak geri alınabilirlikti.
 *
 * Geri alma, arşivlemenin aynadaki hâli değildir ve olmamalıdır: bir düğüm
 * geri alınırken **kendi** alt ağacı da geri gelir, ama üstündeki arşivli bir
 * düğüm varsa o kendiliğinden açılmaz — üst düğüm hâlâ arşivli olduğu için
 * okuma sorguları alt ağacı zaten gizler. Kullanıcı üstten aşağı geri alır.
 */
export async function unarchiveQuestion(id: string) {
  return prisma.question.update({ where: { id }, data: { archivedAt: null } });
}

export async function unarchiveSubLevel(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { subLevelId: id },
      data: { archivedAt: null },
    });
    return tx.subLevel.update({ where: { id }, data: { archivedAt: null } });
  });
}

export async function unarchiveSubCategory(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: { OR: [{ subCategoryId: id }, { subLevel: { subCategoryId: id } }] },
      data: { archivedAt: null },
    });
    await tx.subLevel.updateMany({
      where: { subCategoryId: id },
      data: { archivedAt: null },
    });
    return tx.subCategory.update({ where: { id }, data: { archivedAt: null } });
  });
}

export async function unarchiveCategory(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: {
        OR: [
          { categoryId: id },
          { subCategory: { categoryId: id } },
          { subLevel: { subCategory: { categoryId: id } } },
        ],
      },
      data: { archivedAt: null },
    });
    await tx.subLevel.updateMany({
      where: { subCategory: { categoryId: id } },
      data: { archivedAt: null },
    });
    await tx.subCategory.updateMany({
      where: { categoryId: id },
      data: { archivedAt: null },
    });
    return tx.category.update({ where: { id }, data: { archivedAt: null } });
  });
}

export async function unarchiveSurvey(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.question.updateMany({
      where: buildSurveyQuestionWhere(id),
      data: { archivedAt: null },
    });
    await tx.subLevel.updateMany({
      where: { subCategory: { category: { surveyId: id } } },
      data: { archivedAt: null },
    });
    await tx.subCategory.updateMany({
      where: { category: { surveyId: id } },
      data: { archivedAt: null },
    });
    await tx.category.updateMany({
      where: { surveyId: id },
      data: { archivedAt: null },
    });
    return tx.survey.update({ where: { id }, data: { archivedAt: null } });
  });
}
