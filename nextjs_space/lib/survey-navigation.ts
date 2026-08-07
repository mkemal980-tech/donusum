/**
 * Anket ekranının navigasyon çekirdeği.
 *
 * Anket üç seviyeli bir ağaç (kategori → alt kategori → alt seviye) ama
 * kullanıcı bunu düz bir adım dizisi olarak yaşar: her ekranda bir soru
 * grubu görür, ileri/geri gider. Ekran bu ağacı üç ayrı indeksle yönetiyordu;
 * ilerleme, kaldığı yerden devam ve bölüm haritası gibi özelliklerin hepsi
 * "kaçıncı adımdayım" sorusuna dayandığı için ağaç burada bir kez düzleştirilip
 * tek bir indekse indiriliyor.
 *
 * Saf modül — React ve prisma bağımlılığı yoktur, testten doğrudan çağrılır.
 */

export type NavQuestion = { id: string };

export type NavSubLevel = {
  id: string;
  name: string;
  questions?: NavQuestion[];
};

export type NavSubCategory = {
  id: string;
  name: string;
  hasSubLevels?: boolean;
  subLevels?: NavSubLevel[];
  questions?: NavQuestion[];
  /** Doğrudan kategoriye bağlı sorular için üretilen sanal bölüm. */
  isCategoryDirect?: boolean;
};

export type NavCategory = {
  id: string;
  name: string;
  questions?: NavQuestion[];
  subCategories?: NavSubCategory[];
};

/** Kullanıcının tek ekranda gördüğü soru grubu. */
export type SurveyStep = {
  categoryId: string;
  categoryName: string;
  subCategoryName: string;
  /** Alt seviyesi olmayan bölümlerde null. */
  subLevelName: string | null;
  questionIds: string[];
  /** Ağaçtaki karşılığı — render mevcut yapıyı kullanmaya devam edebilsin diye. */
  categoryIndex: number;
  subCategoryIndex: number;
  subLevelIndex: number;
};

/**
 * Doğrudan kategoriye bağlı sorular, alt kategorilerle aynı biçimde
 * gezilebilsin diye sanal bir bölüme sarılır.
 */
export function displaySubCategories(category: NavCategory | undefined): NavSubCategory[] {
  if (!category) return [];

  const directQuestions = category.questions ?? [];
  const directSection: NavSubCategory[] =
    directQuestions.length > 0
      ? [
          {
            id: `${category.id}__direct`,
            name: "Kategori Soruları",
            hasSubLevels: false,
            subLevels: [],
            questions: directQuestions,
            isCategoryDirect: true,
          },
        ]
      : [];

  return [...directSection, ...(category.subCategories ?? [])];
}

/**
 * Anket ağacını gezilebilir adım dizisine düzleştirir.
 * Sorusu olmayan bölümler atlanır — kullanıcıya boş ekran gösterilmez.
 */
export function buildSteps(categories: NavCategory[]): SurveyStep[] {
  const steps: SurveyStep[] = [];

  categories.forEach((category, categoryIndex) => {
    displaySubCategories(category).forEach((subCategory, subCategoryIndex) => {
      const useSubLevels = subCategory.hasSubLevels ?? true;

      if (useSubLevels && (subCategory.subLevels?.length ?? 0) > 0) {
        subCategory.subLevels!.forEach((subLevel, subLevelIndex) => {
          const questionIds = (subLevel.questions ?? []).map((q) => q.id);
          if (questionIds.length === 0) return;
          steps.push({
            categoryId: category.id,
            categoryName: category.name,
            subCategoryName: subCategory.name,
            subLevelName: subLevel.name,
            questionIds,
            categoryIndex,
            subCategoryIndex,
            subLevelIndex,
          });
        });
        return;
      }

      const questionIds = (subCategory.questions ?? []).map((q) => q.id);
      if (questionIds.length === 0) return;
      steps.push({
        categoryId: category.id,
        categoryName: category.name,
        subCategoryName: subCategory.name,
        subLevelName: null,
        questionIds,
        categoryIndex,
        subCategoryIndex,
        subLevelIndex: 0,
      });
    });
  });

  return steps;
}

export type Progress = { answered: number; total: number; percentage: number };

function toProgress(answered: number, total: number): Progress {
  return {
    answered,
    total,
    percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

function isAnswered(responses: Record<string, string>, questionId: string): boolean {
  const value = responses[questionId];
  return value !== undefined && value !== null && value !== "";
}

/** Tek bir adımın (ekranın) doluluk oranı — baskın gösterge budur. */
export function stepProgress(
  step: SurveyStep | undefined,
  responses: Record<string, string>
): Progress {
  if (!step) return toProgress(0, 0);
  const answered = step.questionIds.filter((id) => isAnswered(responses, id)).length;
  return toProgress(answered, step.questionIds.length);
}

/** Bir kategorinin tüm adımları üzerinden doluluk oranı. */
export function categoryProgress(
  steps: SurveyStep[],
  categoryId: string,
  responses: Record<string, string>
): Progress {
  const ids = steps.filter((step) => step.categoryId === categoryId).flatMap((s) => s.questionIds);
  const answered = ids.filter((id) => isAnswered(responses, id)).length;
  return toProgress(answered, ids.length);
}

/** Anketin tamamı. */
export function overallProgress(
  steps: SurveyStep[],
  responses: Record<string, string>
): Progress {
  const ids = steps.flatMap((step) => step.questionIds);
  const answered = ids.filter((id) => isAnswered(responses, id)).length;
  return toProgress(answered, ids.length);
}

/** Adım sırasını koruyarak kategorileri özetler — bölüm haritası için. */
export type CategorySummary = {
  categoryId: string;
  categoryName: string;
  /** Bu kategorinin ilk adımının dizideki sırası; haritadan atlamak için. */
  firstStepIndex: number;
  stepCount: number;
};

export function categorySummaries(steps: SurveyStep[]): CategorySummary[] {
  const summaries: CategorySummary[] = [];

  steps.forEach((step, index) => {
    const last = summaries[summaries.length - 1];
    if (last && last.categoryId === step.categoryId) {
      last.stepCount++;
      return;
    }
    summaries.push({
      categoryId: step.categoryId,
      categoryName: step.categoryName,
      firstStepIndex: index,
      stepCount: 1,
    });
  });

  return summaries;
}

/**
 * Kullanıcının kaldığı yer: cevaplanmamış sorusu olan ilk adım.
 *
 * Anket tek oturumda bitmediği için her dönüşte baştan başlatmak, uzun
 * anketlerde en can sıkıcı davranıştır. Hepsi cevaplanmışsa son adıma
 * götürülür — kullanıcı "tamamla" düğmesini görsün.
 */
export function findResumeStepIndex(
  steps: SurveyStep[],
  responses: Record<string, string>
): number {
  if (steps.length === 0) return 0;

  const index = steps.findIndex((step) =>
    step.questionIds.some((id) => !isAnswered(responses, id))
  );

  return index === -1 ? steps.length - 1 : index;
}

/** Bir adımda cevaplanmamış soru sayısı — bölümden çıkarken uyarmak için. */
export function unansweredInStep(
  step: SurveyStep | undefined,
  responses: Record<string, string>
): number {
  if (!step) return 0;
  return step.questionIds.filter((id) => !isAnswered(responses, id)).length;
}

/**
 * Anketin kaba tamamlanma süresi (dakika).
 *
 * Araştırmalar ilk soruların belirgin biçimde daha yavaş cevaplandığını
 * gösteriyor; bu yüzden sabit bir çarpan yerine ilk sorulara ağırlık verilir.
 * Amaç isabet değil, kullanıcıya baştan dürüst bir beklenti vermek.
 */
export function estimateMinutes(totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  const warmUp = Math.min(totalQuestions, 5) * 45; // ilk sorular ~45 sn
  const rest = Math.max(0, totalQuestions - 5) * 20; // sonrası ~20 sn
  return Math.max(1, Math.round((warmUp + rest) / 60));
}
