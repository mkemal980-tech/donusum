import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getScopeResolver } from "./scoring";
import { getSectionVisibility } from "./assessment";
import { canReadSurveyTemplate } from "./survey-management";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Kullanıcının bir ankette gerçekten göreceği yapı — tek kaynak.
 *
 * Aynı ağacı iki yer çiziyordu ve kuralları ayrışmıştı:
 *
 * - `/api/survey/structure` erişimi doğruluyor, arşivlenmiş düğümleri eliyor,
 *   sektör kapsamını ve bölüm görünürlüğünü uyguluyordu.
 * - `/api/dashboard/unified` bunların hiçbirini yapmıyordu. Sonucu iki türlüydü:
 *   (a) herhangi bir oturum sahibi, başka bir kiracıya ait özel anketin
 *   kategori/bölüm adlarını okuyabiliyordu; (b) arşivlenmiş ve sektör kapsamı
 *   dışındaki sorular toplam sayıya girdiği için tamamlanma yüzdesi hiçbir
 *   zaman %100 olmuyordu — kullanıcı cevaplayamayacağı soruları bekliyordu.
 *
 * Alt kategori sorularının nereden sayılacağı da ayrışmıştı: pano
 * `hasSubLevels` bayrağına, puanlama ise alt seviyenin gerçekten var olup
 * olmadığına bakıyordu. Burada tek kural geçerli: alt seviye **varsa** sorular
 * oradan, yoksa alt kategoriden sayılır (puanlamayla aynı).
 */
export type VisibleStructure = Awaited<ReturnType<typeof loadVisibleSurveyStructure>>;

export async function loadVisibleSurveyStructure(
  userId: string,
  role: string,
  surveyId: string,
  db: DbClient = prisma
) {
  if (!(await canReadSurveyTemplate(userId, role, surveyId, db))) {
    return null;
  }

  const categories = await db.category.findMany({
    where: { surveyId, archivedAt: null },
    orderBy: { order: "asc" },
    include: {
      questions: { where: { archivedAt: null }, orderBy: { order: "asc" } },
      subCategories: {
        where: { archivedAt: null },
        orderBy: { order: "asc" },
        include: {
          questions: { where: { archivedAt: null }, orderBy: { order: "asc" } },
          subLevels: {
            where: { archivedAt: null },
            orderBy: { order: "asc" },
            include: {
              questions: { where: { archivedAt: null }, orderBy: { order: "asc" } },
            },
          },
        },
      },
    },
  });

  const scopeOf = await getScopeResolver(userId, surveyId, db);
  const visibility = await getSectionVisibility(userId, surveyId, db);

  const scoped = categories.map((category) => ({
    ...category,
    // Doğrudan kategoriye bağlı sorular dağıtılamaz; koordinatörde kalırlar.
    questions: visibility.canSeeDirect ? category.questions : [],
    subCategories: category.subCategories.filter(
      (subCategory) =>
        scopeOf(subCategory.id).applicable && visibility.canSee(subCategory.id)
    ),
  }));

  return scoped.filter(
    (category) => category.subCategories.length > 0 || category.questions.length > 0
  );
}

/** Görünür yapıdaki soru kimlikleri — kategori kırılımıyla. */
export function countStructureQuestions(structure: NonNullable<VisibleStructure>) {
  return structure.map((category) => {
    const questionIds: string[] = category.questions.map((question) => question.id);

    for (const subCategory of category.subCategories) {
      // Tek kural: alt seviye varsa sorular oradan, yoksa alt kategoriden.
      if (subCategory.subLevels.length > 0) {
        for (const subLevel of subCategory.subLevels) {
          questionIds.push(...subLevel.questions.map((question) => question.id));
        }
      } else {
        questionIds.push(...subCategory.questions.map((question) => question.id));
      }
    }

    return { id: category.id, name: category.name, questionIds };
  });
}
