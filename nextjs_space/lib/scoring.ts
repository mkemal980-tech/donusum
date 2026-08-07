import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  type ResolvedScope,
  type ScopeRule,
  buildScopeResolver,
} from "./sector-scope";

/** Transaction içinde de çalışabilmek için: prisma ya da tx istemcisi. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Yeni Puanlama Sistemi:
 * 
 * 1. Puan Yüzdesi = (Alınan Puan / Maksimum Puan) × 100
 * 
 * 2. Seviyelendirme (Yüzdeye Göre):
 *    - %0-19: Seviye 1 (Başlangıç)
 *    - %20-39: Seviye 2 (Farkındalık)
 *    - %40-59: Seviye 3 (Gelişen)
 *    - %60-79: Seviye 4 (Olgun)
 *    - %80-100: Seviye 5 (Lider)
 * 
 * 3. Puan Hesaplama (1-5 Ölçeği):
 *    Puan = (Yüzde / 100) × 4 + 1
 *    - %0 başarı → 1.0 puan
 *    - %100 başarı → 5.0 puan
 */

// Yüzdeden 1-5 puana dönüştürme
function percentageToScore(percentage: number): number {
  return (percentage / 100) * 4 + 1;
}

/**
 * Bir sorunun alabileceği maksimum ham puanın üst sınırı (1-5 ölçeği).
 * Tek bir soru bu değerden fazla puan üretemez.
 */
export const MAX_QUESTION_SCORE = 5;

/**
 * Eski ham ortalamayı (0-5) yürürlükteki 1-5 ölçeğine çevirir.
 *
 * Yalnızca eski yöntemle yazılmış `ScoreHistory` kayıtlarını taşımak için
 * vardır (bkz. scripts/rescale-score-history.ts). Yeni hesaplar zaten bu
 * ölçekte üretildiği için canlı kodda kullanılmaz.
 */
export function rawAverageToScaledScore(rawAverage: number): number {
  if (!Number.isFinite(rawAverage)) return 1;
  const ratio = Math.min(1, Math.max(0, rawAverage / MAX_QUESTION_SCORE));
  return Math.round(percentageToScore(ratio * 100) * 10) / 10;
}

type QuestionForMaxScore = {
  type?: string | null;
  options?: unknown;
  conditionalOptions?: unknown;
};

function highestOptionScore(options: unknown): number {
  if (!Array.isArray(options)) return 0;
  return options.reduce((highest: number, option) => {
    if (!option || typeof option !== "object") return highest;
    const score = Number((option as Record<string, unknown>).score);
    return Number.isFinite(score) && score > highest ? score : highest;
  }, 0);
}

/**
 * Sorunun kendi şıklarından türetilen tavan puanı.
 *
 * Önceden her sorunun tavanı sabit 5 kabul ediliyordu. En yüksek şıkkı 3 puan
 * veren bir soruda bu, en olgun cevabı veren kullanıcıyı bile %60'ta
 * bırakıyordu — yüzdeler, 1-5 ölçeği ve puan aralığına bağlı öneri eşikleri
 * hep aşağı kayıyordu. Tavan artık sorunun tanımından okunur.
 *
 * - SCALE: ekran 1-5 arası kaydeder, tavan 5
 * - YES_NO / MULTIPLE_CHOICE: şıkların en yüksek puanı
 * - CONDITIONAL_CHOICE: alt seçenek puanlarının toplamı (5 ile sınırlı)
 *
 * Şık tanımı yoksa ya da tüm şıklar 0 ise güvenli varsayılan olan 5 döner;
 * böylece sıfıra bölme oluşmaz.
 */
export function maxScoreForQuestion(question: QuestionForMaxScore): number {
  let max: number;

  switch (question.type) {
    case "SCALE":
      max = MAX_QUESTION_SCORE;
      break;

    case "CONDITIONAL_CHOICE": {
      const container = question.conditionalOptions as { options?: unknown } | null | undefined;
      const subOptions = Array.isArray(container?.options) ? container!.options : [];
      max = subOptions.reduce((total: number, option) => {
        if (!option || typeof option !== "object") return total;
        const score = Number((option as Record<string, unknown>).score);
        return total + (Number.isFinite(score) ? score : 0);
      }, 0);
      break;
    }

    default:
      // YES_NO ve MULTIPLE_CHOICE — ayrıca tanımsız tipler için güvenli yol.
      max = highestOptionScore(question.options);
      break;
  }

  if (!Number.isFinite(max) || max <= 0) return MAX_QUESTION_SCORE;
  return Math.min(max, MAX_QUESTION_SCORE);
}

/**
 * Ham soru puanını geçerli [0, MAX_QUESTION_SCORE] aralığına sıkıştırır.
 * CONDITIONAL_CHOICE gibi birden çok alt-seçenek puanının toplandığı tiplerde
 * toplamın 5'i aşarak yüzdeyi %100 üzerine çıkarmasını engeller.
 */
export function clampScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.min(score, MAX_QUESTION_SCORE);
}

/**
 * CONDITIONAL_CHOICE cevabını puana çevirir.
 * value: JSON string — { threshold: 'yes'|'no', selected?: string[] }
 * conditionalOptions: { options: { value: string; score: number }[] }
 * "Hayır" → 0; "Evet" → seçilen alt-seçenek puanları toplamı (5 ile sınırlı).
 */
export function scoreConditionalChoice(
  value: string,
  conditionalOptions: { options?: { value: string; score?: number }[] } | null | undefined
): number {
  let parsed: { threshold?: string; selected?: string[] };
  try {
    parsed = JSON.parse(value);
  } catch {
    return 0;
  }
  if (parsed.threshold !== "yes" || !Array.isArray(parsed.selected)) {
    return 0;
  }
  const subOptions = conditionalOptions?.options ?? [];
  const rawSum = parsed.selected.reduce((total: number, selectedValue: string) => {
    const option = subOptions.find((o) => o.value === selectedValue);
    return total + (option?.score ?? 0);
  }, 0);
  return clampScore(rawSum);
}

// Ironman kadran eşiği (Velocity/Endurance ekseni)
export const QUADRANT_THRESHOLD = 3.0;

export type Quadrant = "IRONMAN" | "SPRINTER" | "MARATHON_RUNNER" | "WALKER";

/**
 * Velocity/Endurance skorlarına göre kadran sınıflandırması.
 * Tek doğru kaynak — ironman, score-history ve recommendations/completion
 * rotalarındaki tekrarlanan mantığın yerini alır.
 */
export function classifyQuadrant(velocity: number, endurance: number): Quadrant {
  if (velocity >= QUADRANT_THRESHOLD && endurance >= QUADRANT_THRESHOLD) return "IRONMAN";
  if (velocity >= QUADRANT_THRESHOLD && endurance < QUADRANT_THRESHOLD) return "SPRINTER";
  if (velocity < QUADRANT_THRESHOLD && endurance >= QUADRANT_THRESHOLD) return "MARATHON_RUNNER";
  return "WALKER";
}

export function buildSurveyQuestionWhere(surveyId: string | string[]) {
  // Tek anket için birebir eşitlik, çoklu anket için `in` filtresi.
  const match = Array.isArray(surveyId) ? { in: surveyId } : surveyId;
  return {
    OR: [
      { category: { surveyId: match } },
      { subCategory: { category: { surveyId: match } } },
      { subLevel: { subCategory: { category: { surveyId: match } } } }
    ]
  };
}

/**
 * Kullanıcının gerçekten erişebildiği anketler.
 *
 * Öneriler ve gelişim puanı bu kümeyle sınırlanır; aksi hâlde kullanıcıya
 * atanmamış anketlerin önerileri de listeye sızar.
 *
 * - ADMIN: tüm aktif anketler
 * - Diğer roller: aktif atamaları olan aktif anketler
 *
 * `requestedSurveyId` verilirse sonuç o ankete daraltılır; kullanıcı o ankete
 * erişemiyorsa boş dizi döner (sessiz yetki aşımı yerine boş sonuç).
 */
export async function getAccessibleSurveyIds(
  userId: string,
  requestedSurveyId?: string,
  db: DbClient = prisma
): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });

  let surveyIds: string[];

  if (user?.role === "ADMIN") {
    const surveys = await db.survey.findMany({
      where: { isActive: true, archivedAt: null },
      select: { id: true }
    });
    surveyIds = surveys.map(s => s.id);
  } else {
    const assignments = await db.userSurveyAssignment.findMany({
      where: {
        userId,
        isActive: true,
        survey: { isActive: true, archivedAt: null }
      },
      select: { surveyId: true }
    });
    surveyIds = assignments.map(a => a.surveyId);
  }

  if (requestedSurveyId) {
    return surveyIds.filter(id => id === requestedSurveyId);
  }
  return surveyIds;
}

/**
 * Bir önerinin verilen anketlere ait olup olmadığını sınayan Prisma koşulu.
 *
 * Öneri dört ayrı yoldan bir ankete bağlanabilir (soru / alt seviye / alt
 * kategori / kategori). `Recommendation.categoryId` şemada ilişki değil düz
 * bir alan olduğu için kategori kimlikleri ayrıca çekilir.
 *
 * Hiçbir kapsamı olmayan "genel" öneriler her ankete dahildir.
 */
export async function buildRecommendationSurveyWhere(
  surveyIds: string[],
  db: DbClient = prisma
) {
  const categories = await db.category.findMany({
    where: { surveyId: { in: surveyIds } },
    select: { id: true }
  });
  const categoryIds = categories.map(c => c.id);

  return {
    OR: [
      { question: buildSurveyQuestionWhere(surveyIds) },
      { subLevel: { subCategory: { category: { surveyId: { in: surveyIds } } } } },
      { subCategory: { category: { surveyId: { in: surveyIds } } } },
      { categoryId: { in: categoryIds } },
      // Kapsamsız genel öneri
      { questionId: null, subLevelId: null, subCategoryId: null, categoryId: null }
    ]
  };
}

/**
 * Kullanıcının sektörüne göre bölüm kapsam/ağırlık çözücüsü.
 *
 * Kuralı olmayan bölüm varsayılan olarak kapsamdadır ve ağırlığı 1'dir; bu
 * yüzden hiç kural tanımlanmamış bir kurulumda puanlar birebir aynı kalır.
 * Kapsam dışı bölümlerin soruları hem alınan puana hem de tavana hiç
 * girmez — sorulmayan soru kullanıcıyı cezalandırmamalı.
 */
export async function getScopeResolver(
  userId: string,
  surveyId: string | undefined,
  db: DbClient = prisma
): Promise<(subCategoryId: string | null | undefined) => ResolvedScope> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { sectorId: true, subSectorId: true },
  });

  if (!user?.sectorId) {
    // Sektörü olmayan kullanıcıya her şey sorulur.
    return buildScopeResolver([], { sectorId: null, subSectorId: null });
  }

  const rules = await db.sectorScopeRule.findMany({
    where: {
      sectorId: user.sectorId,
      ...(surveyId ? { surveyId } : {}),
    },
    select: {
      sectorId: true,
      subSectorId: true,
      subCategoryId: true,
      applicable: true,
      weight: true,
    },
  });

  return buildScopeResolver(rules as ScopeRule[], user);
}

export async function calculateUserScore(userId: string, surveyId?: string) {
  // Önce tüm kategorileri getir (ankete göre filtrelenebilir)
  const allCategories = await prisma.category.findMany({
    where: { archivedAt: null, ...(surveyId ? { surveyId } : {}) },
    include: {
      questions: { where: { archivedAt: null } },  // Doğrudan kategoriye bağlı sorular
      subCategories: {
        where: { archivedAt: null },
        include: {
          subLevels: {
            where: { archivedAt: null },
            include: { questions: { where: { archivedAt: null } } }
          },
          questions: { where: { archivedAt: null } }
        }
      }
    },
    orderBy: { order: 'asc' }
  });

  // Sektöre göre kapsam/ağırlık — kural yoksa her şey kapsamda, ağırlık 1.
  const scopeOf = await getScopeResolver(userId, surveyId);

  const responses = await prisma.surveyResponse.findMany({
    where: {
      userId,
      question: {
        archivedAt: null,
        ...(surveyId ? buildSurveyQuestionWhere(surveyId) : {})
      }
    },
    include: {
      question: {
        include: {
          category: true,  // Doğrudan kategoriye bağlı sorular için
          subLevel: {
            include: {
              subCategory: {
                include: {
                  category: true
                }
              }
            }
          },
          subCategory: {
            include: {
              category: true
            }
          }
        }
      }
    }
  });

  // Kategorileri başlangıç değerleriyle hazırla (tümü %0)
  const categoryScores: Record<string, { score: number; maxScore: number; name: string }> = {};
  const subLevelScores: Record<string, { score: number; maxScore: number; name: string; categoryName: string }> = {};
  const subCategoryScores: Record<string, { score: number; maxScore: number; name: string; categoryName: string }> = {};

  // Tüm kategorileri ve alt yapıları varsayılan değerlerle ekle
  for (const category of allCategories) {
    let catMaxScore = 0;
    
    // Doğrudan kategoriye bağlı sorular
    const categoryQuestions = (category as any).questions || [];
    const categoryDirectMaxScore = categoryQuestions.reduce(
      (sum: number, q: any) => sum + maxScoreForQuestion(q) * q.weight,
      0
    );
    catMaxScore += categoryDirectMaxScore;

    for (const subCat of category.subCategories) {
      let subCatMaxScore = 0;

      // Kapsam dışı bölüm hiç sayılmaz — ne alınan puana ne tavana girer.
      const scope = scopeOf(subCat.id);
      if (!scope.applicable) continue;

      // Alt seviyeler varsa
      if (subCat.subLevels && subCat.subLevels.length > 0) {
        for (const subLevel of subCat.subLevels) {
          const levelMaxScore = subLevel.questions.reduce(
            (sum, q) => sum + maxScoreForQuestion(q) * q.weight * scope.weight,
            0
          );
          subCatMaxScore += levelMaxScore;
          
          subLevelScores[subLevel.id] = {
            score: 0,
            maxScore: levelMaxScore,
            name: subLevel.name,
            categoryName: category.name
          };
        }
      } else {
        // Doğrudan sorular
        const questions = (subCat as any).questions || [];
        subCatMaxScore = questions.reduce(
          (sum: number, q: any) => sum + maxScoreForQuestion(q) * q.weight * scope.weight,
          0
        );
      }
      
      catMaxScore += subCatMaxScore;
      
      subCategoryScores[subCat.id] = {
        score: 0,
        maxScore: subCatMaxScore,
        name: subCat.name,
        categoryName: category.name
      };
    }
    
    categoryScores[category.id] = {
      score: 0,
      maxScore: catMaxScore,
      name: category.name
    };
  }

  let totalWeightedScore = 0;

  for (const response of responses ?? []) {
    const question = response?.question;
    // Sorunun bağlı olduğu bölümün kapsamı; doğrudan kategoriye bağlı
    // sorularda bölüm yoktur ve kural uygulanmaz.
    const questionSubCategoryId =
      question?.subLevel?.subCategory?.id ?? question?.subCategory?.id ?? null;
    const scope = scopeOf(questionSubCategoryId);
    if (!scope.applicable) continue;

    const weight = (question?.weight ?? 1) * scope.weight;
    const score = (response?.score ?? 0) * weight;
    const maxScore = maxScoreForQuestion(question ?? {}) * weight;

    let category = null;
    let subLevel = question?.subLevel;
    let subCategory = question?.subCategory;
    const directCategory = (question as any)?.category;

    // Soru doğrudan kategoriye bağlıysa
    if (directCategory) {
      category = directCategory;
    }
    // Soru subLevel'e bağlıysa
    else if (subLevel) {
      category = subLevel?.subCategory?.category;
      subCategory = subLevel?.subCategory;
    } 
    // Soru doğrudan subCategory'ye bağlıysa (hasSubLevels = false)
    else if (subCategory) {
      category = subCategory?.category;
    }

    if (!category) continue;

    const categoryId = category.id;

    // Kategori bazlı puanlama
    if (!categoryScores[categoryId]) {
      categoryScores[categoryId] = {
        score: 0,
        maxScore,
        name: category?.name ?? 'Unknown'
      };
    }
    categoryScores[categoryId].score += score;

    // Alt kategori bazlı puanlama
    if (subCategory) {
      const subCategoryId = subCategory.id;
      if (!subCategoryScores[subCategoryId]) {
        subCategoryScores[subCategoryId] = {
          score: 0,
          maxScore,
          name: subCategory?.name ?? 'Unknown',
          categoryName: category?.name ?? 'Unknown'
        };
      }
      subCategoryScores[subCategoryId].score += score;
    }

    // Alt seviye bazlı puanlama (sadece subLevel varsa)
    if (subLevel) {
      const subLevelId = subLevel.id;
      if (!subLevelScores[subLevelId]) {
        subLevelScores[subLevelId] = {
          score: 0,
          maxScore,
          name: subLevel?.name ?? 'Unknown',
          categoryName: category?.name ?? 'Unknown'
        };
      }
      subLevelScores[subLevelId].score += score;
    }

    totalWeightedScore += score;
  }

  const normalizedCategoryScores: Record<string, { score: number; scoreOn5: number; percentage: number; name: string }> = {};
  const normalizedSubLevelScores: Record<string, { score: number; scoreOn5: number; percentage: number; name: string; categoryName: string }> = {};
  const normalizedSubCategoryScores: Record<string, { score: number; scoreOn5: number; percentage: number; name: string; categoryName: string }> = {};
  
  for (const [catId, data] of Object.entries(categoryScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    const scoreOn5 = percentageToScore(percentage);
    normalizedCategoryScores[catId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown'
    };
  }

  for (const [subLevelId, data] of Object.entries(subLevelScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    const scoreOn5 = percentageToScore(percentage);
    normalizedSubLevelScores[subLevelId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  for (const [subCatId, data] of Object.entries(subCategoryScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    const scoreOn5 = percentageToScore(percentage);
    normalizedSubCategoryScores[subCatId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  const totalMaxScore = Object.values(categoryScores).reduce((sum, data) => sum + data.maxScore, 0);
  const totalPercentage = totalMaxScore > 0 ? Math.round((totalWeightedScore / totalMaxScore) * 100) : 0;
  const totalScoreOn5 = percentageToScore(totalPercentage);

  return {
    totalScore: totalPercentage,
    totalScoreOn5: Math.round(totalScoreOn5 * 10) / 10,
    categoryScores: normalizedCategoryScores,
    subLevelScores: normalizedSubLevelScores,
    subCategoryScores: normalizedSubCategoryScores
  };
}

type CascadeInput = {
  id: string;
  questionId: string | null;
  triggerMaxAnswerScore: number | null;
};

/**
 * Kademeli önerileri kullanıcının baseline cevabına göre süzer.
 *
 * Baseline'ın altındaki basamaklar kullanıcıya hiç gösterilmez; sayıma
 * katılırlarsa "tamamlanmamış alt basamak" gibi görünüp ilerlemeyi kilitlerler.
 */
export function applicableCascadeRecommendations<T extends CascadeInput>(
  cascadeRecommendations: T[],
  baselineByQuestion: Map<string, number>
): T[] {
  return cascadeRecommendations.filter(rec => {
    if (!rec.questionId) return false;
    const baseline = baselineByQuestion.get(rec.questionId);
    if (baseline === undefined) return false;
    const threshold = rec.triggerMaxAnswerScore;
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) return false;
    return threshold >= baseline;
  });
}

export type CascadeLevelState = {
  /** Sorunun kademeli önerilerinin artan, tekilleştirilmiş eşikleri. */
  thresholds: number[];
  /**
   * Alttan itibaren tamamen bitirilmiş kademe sayısı. Bir kademe, o eşikteki
   * *tüm* önerileri tamamlanmışsa bitmiş sayılır — bir basamak için birden
   * fazla öneri tanımlanabildiği için sayım değil kapsama bakılır.
   */
  currentIndex: number;
};


/**
 * Soru bazında olgunluk basamaklarının nerede kalındığını çıkarır.
 *
 * Anket tek seferlik bir baseline olduğu için kullanıcı cevabını değiştirerek
 * ilerlemez; ilerlemenin tek kanıtı önerilerin tamamlanmasıdır. Bu yüzden
 * "şu an hangi basamaktayım" sorusu tamamlanan önerilerden türetilir.
 */
export function buildCascadeLevels(
  recommendations: CascadeInput[],
  completedIds: Set<string>
): Map<string, CascadeLevelState> {
  const byQuestion = new Map<string, Map<number, string[]>>();

  for (const rec of recommendations) {
    const threshold = rec.triggerMaxAnswerScore;
    if (!rec.questionId) continue;
    if (typeof threshold !== "number" || !Number.isFinite(threshold)) continue;

    let levels = byQuestion.get(rec.questionId);
    if (!levels) {
      levels = new Map<number, string[]>();
      byQuestion.set(rec.questionId, levels);
    }
    const bucket = levels.get(threshold);
    if (bucket) bucket.push(rec.id);
    else levels.set(threshold, [rec.id]);
  }

  const result = new Map<string, CascadeLevelState>();

  for (const [questionId, levels] of byQuestion) {
    const thresholds = [...levels.keys()].sort((a, b) => a - b);

    // En alttan başlayıp tamamen bitmiş kademeleri say; ilk eksik kademede dur.
    let currentIndex = 0;
    while (currentIndex < thresholds.length) {
      const ids = levels.get(thresholds[currentIndex]) ?? [];
      if (!ids.every(id => completedIds.has(id))) break;
      currentIndex++;
    }

    result.set(questionId, { thresholds, currentIndex });
  }

  return result;
}

/**
 * Kullanıcının bir sorudaki *etkin* puanı — baseline cevabı ile tamamlanan
 * kademelerin daha yükseği. Tüm kademeler bitmişse sorunun tavanı.
 */
export function effectiveQuestionScore(
  baselineScore: number,
  state: CascadeLevelState | undefined,
  maxScore: number
): number {
  if (!state || state.thresholds.length === 0) return baselineScore;

  const reached = state.currentIndex < state.thresholds.length
    ? state.thresholds[state.currentIndex]
    : maxScore;

  return Math.max(baselineScore, reached);
}

/** `triggerOptions` JSON'unu normalize edilmiş değer listesine çevirir. */
function parseTriggerOptions(raw: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map(value => String(value).toLowerCase().trim())
    .filter(value => value !== "");
}

export async function getRecommendationsForUser(
  userId: string,
  options: { surveyId?: string } = {}
) {
  // Kullanıcının tüm anket cevaplarını getir
  const userResponses = await prisma.surveyResponse.findMany({
    where: { userId },
    select: {
      questionId: true,
      value: true,
      // Kademeli tetikleme cevabın puanına bakar.
      score: true
    }
  });

  // Eğer kullanıcının hiç anket cevabı yoksa, boş dizi döndür
  if (!userResponses || userResponses.length === 0) {
    return [];
  }

  // Öneriler yalnızca kullanıcının erişebildiği anketlerden gelir.
  const surveyIds = await getAccessibleSurveyIds(userId, options.surveyId);
  const surveyWhere = await buildRecommendationSurveyWhere(surveyIds);

  const { categoryScores, subLevelScores, subCategoryScores } = await calculateUserScore(
    userId,
    options.surveyId
  );
  const categoryPercentages = Object.fromEntries(
    Object.entries(categoryScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );
  
  // Cevapları questionId -> { value, score } map'ine dönüştür
  const userAnswerMap = new Map<string, { value: string; score: number }>();
  userResponses.forEach(response => {
    userAnswerMap.set(response.questionId, {
      value: response.value.toLowerCase().trim(),
      score: response.score ?? 0
    });
  });

  // Puan yüzdelerini hazırla
  const subLevelPercentages = Object.fromEntries(
    Object.entries(subLevelScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );
  const subCategoryPercentages = Object.fromEntries(
    Object.entries(subCategoryScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );

  // Erişilebilir anketlerin önerilerini getir
  const recommendations = await prisma.recommendation.findMany({
    where: surveyWhere,
    include: {
      question: {
        select: {
          id: true,
          text: true,
          type: true,
          // Öneride kapsam boşsa sorunun kendi yerleşimine düşülür.
          subLevelId: true,
          subCategoryId: true,
          categoryId: true
        }
      },
      subLevel: {
        include: {
          subCategory: {
            include: { category: true }
          }
        }
      },
      subCategory: {
        include: { category: true }
      }
    },
    orderBy: [
      { strategicType: 'asc' },
      { estimatedImpact: 'desc' }
    ]
  });

  /**
   * Önerinin kapsamındaki puan, eşik aralığına düşüyor mu?
   * Kapsam önerinin kendi alanlarından, boşsa bağlı sorunun yerleşiminden
   * okunur. Hiçbir kapsam yoksa öneri geneldir.
   */
  const matchesScoreRange = (rec: (typeof recommendations)[number]) => {
    const subLevelId = rec.subLevelId ?? rec.question?.subLevelId ?? null;
    const subCategoryId = rec.subCategoryId ?? rec.question?.subCategoryId ?? null;
    const categoryId = rec.categoryId ?? rec.question?.categoryId ?? null;

    const inRange = (score: number | undefined) =>
      score !== undefined &&
      score >= rec.minScoreThreshold &&
      score <= rec.maxScoreThreshold;

    if (subLevelId) return inRange(subLevelPercentages[subLevelId]);
    if (subCategoryId) return inRange(subCategoryPercentages[subCategoryId]);
    if (categoryId) return inRange(categoryPercentages[categoryId]);

    // Kapsamsız genel öneri
    return true;
  };

  // Önerileri filtrele
  const filteredRecommendations = recommendations.filter(rec => {
    // 1. SORUYA BAĞLI ÖNERİ (öncelikli)
    if (rec.questionId) {
      const userAnswer = userAnswerMap.get(rec.questionId);

      // Kullanıcı bu soruya cevap vermemişse öneri hiçbir koşulda gösterilmez.
      if (!userAnswer) return false;

      // 1a. KADEMELİ TETİKLEME — cevabın puanı eşiğin altındaysa göster.
      // Üst basamakların önerileri alt basamaklara böyle devrolur ve bu,
      // cevabın JSON olarak saklandığı CONDITIONAL_CHOICE'ta da çalışır.
      const cascadeThreshold = rec.triggerMaxAnswerScore;
      if (typeof cascadeThreshold === "number" && Number.isFinite(cascadeThreshold)) {
        return userAnswer.score <= cascadeThreshold;
      }

      // 1b. TAM EŞLEŞME — yalnızca işaretlenen şıklarda göster.
      if (rec.triggerOptions) {
        // Bozuk ya da boş tetikleyici listesi → eşleşme yok, öneriyi gizle.
        const triggerOpts = parseTriggerOptions(rec.triggerOptions);
        if (!triggerOpts || triggerOpts.length === 0) return false;

        // Şık bazlı tetikleme puan eşiklerinin yerine geçer.
        return triggerOpts.includes(userAnswer.value);
      }

      // Tetikleyici tanımlanmamış: soru cevaplanmışsa puan aralığına düş.
      return matchesScoreRange(rec);
    }

    // 2. PUAN ARALIĞI BAZLI FİLTRELEME (soru seçilmediyse)
    return matchesScoreRange(rec);
  });

  // Roadmap'teki önerileri bul
  const existingRoadmapItems = await prisma.roadmapItem.findMany({
    where: { userId },
    select: { recommendationId: true, status: true }
  });

  const existingIds = new Set(existingRoadmapItems?.map(item => item?.recommendationId) ?? []);
  const completedIds = new Set(
    (existingRoadmapItems ?? [])
      .filter(item => item?.status === "COMPLETED")
      .map(item => item.recommendationId)
  );

  // Kademe durumu yalnızca kullanıcıya gösterilen öneriler üzerinden kurulur;
  // baseline'ın altında kalan basamaklar zaten elenmiştir.
  const cascadeLevels = buildCascadeLevels(filteredRecommendations, completedIds);

  const withStep = (filteredRecommendations ?? []).map(rec => {
    const state = rec.questionId ? cascadeLevels.get(rec.questionId) : undefined;
    const threshold = rec.triggerMaxAnswerScore;

    // Kademesiz öneriler her zaman "şu an yapılabilir" sayılır.
    let stepDistance = 0;
    if (state && typeof threshold === "number" && Number.isFinite(threshold)) {
      stepDistance = state.thresholds.indexOf(threshold) - state.currentIndex;
    }

    return {
      ...rec,
      isInRoadmap: existingIds.has(rec?.id),
      subLevelName: rec.subLevel?.name,
      subCategoryName: rec.subLevel?.subCategory?.name ?? rec.subCategory?.name,
      categoryName: rec.subLevel?.subCategory?.category?.name ?? rec.subCategory?.category?.name,
      // Tetikleme bilgisi
      triggeredByQuestion: !!rec.questionId,
      triggerQuestionText: rec.question?.text,
      /** 0 = sıradaki adım, >0 = henüz kilitli, <0 = geçilmiş basamak. */
      stepDistance,
      /**
       * Yumuşak kilit: üst basamaklar görünür ama sırası gelmeden yol
       * haritasına eklenemez / tamamlanamaz.
       */
      isActionable: stepDistance <= 0
    };
  });

  // Sıradaki adım başa, kilitliler arkasına, geçilmiş basamaklar en sona.
  const rank = (step: number) => (step < 0 ? 1000 - step : step);
  return withStep.sort((a, b) => rank(a.stepDistance) - rank(b.stepDistance));
}

/**
 * Öneri şu an yapılabilir mi? (yumuşak kilit)
 *
 * Kademeli önerilerde sıradaki basamak bitmeden üst basamaklar yol haritasına
 * eklenemez ya da tamamlanamaz. Kontrol, listeyi üreten fonksiyonun kendisi
 * üzerinden yapılır; böylece gösterim ile kilit asla ayrışmaz.
 *
 * Not: kilidi kaldırma yönündeki işlemler (yol haritasından çıkarma, durumu
 * başa alma) bu kontrole tabi değildir — çağıran taraf yalnızca ilerletme
 * işlemlerinde sorar.
 */
export async function isRecommendationActionable(
  userId: string,
  recommendationId: string
): Promise<boolean> {
  const recommendations = await getRecommendationsForUser(userId);
  const match = recommendations.find(rec => rec.id === recommendationId);
  // Kullanıcıya hiç gösterilmeyen öneri de yapılabilir değildir.
  return match?.isActionable === true;
}

export type ProgressScores = {
  overallScore: number;
  overallPercentage: number;
  velocityScore: number;
  enduranceScore: number;
  quadrant: Quadrant;
  completedQuestions: number;
  totalQuestions: number;
  completedRecommendations: number;
  /** Eksene düşen soru ağırlıklarının toplamı — ironman ekranı için. */
  velocityWeight: number;
  enduranceWeight: number;
  /** Bonus öncesi eksen puanı ve eklenen bonus — gelişim grafiği için. */
  velocityBase: number;
  enduranceBase: number;
  velocityBonus: number;
  enduranceBonus: number;
};

/**
 * Gelişim puanı — tek doğru kaynak.
 *
 * `ScoreHistory` tablosuna yazan her yol (ilk snapshot, manuel snapshot,
 * öneri tamamlama) bu fonksiyonu kullanır. Daha önce üç ayrı kopya vardı ve
 * yalnızca öneri tamamlama bonusu ekliyordu; bu yüzden trend grafiğinde
 * kayıtlar arasında gerçek olmayan sıçramalar görülebiliyordu.
 *
 * Hesap:
 *   - Sorunun etkin puanı = baseline cevabı ile tamamlanan kademelerin yükseği
 *   - Eksen puanı = etkin puanların soru tavanına göre ağırlıklı başarı oranı,
 *     kategori puanlarıyla aynı 1-5 ölçeğine taşınır
 *   - Kademesiz önerilerin `points` değeri "kaç soruluk ilerlemeye denk"
 *     birimindedir ve soruların katkısıyla aynı ölçekte toplanır; kademeli
 *     olanlar zaten etkin puana yansıdığı için mükerrer sayılmaz
 *   - Genel puan, iki eksenin soru ağırlıklarına göre bileşimidir
 *   - Puanlar 5 ile sınırlıdır, yüzde [0, 100] aralığına kırpılır
 */
export async function calculateProgressScores(
  userId: string,
  options: { surveyId?: string; db?: DbClient } = {}
): Promise<ProgressScores> {
  const { surveyId } = options;
  const db = options.db ?? prisma;

  const questionWhere = {
    archivedAt: null,
    ...(surveyId ? buildSurveyQuestionWhere(surveyId) : {})
  };

  const responses = await db.surveyResponse.findMany({
    where: { userId, question: questionWhere },
    include: {
      question: {
        select: {
          id: true,
          weight: true,
          axisType: true,
          // Tavan puan sorunun kendi şıklarından okunur.
          type: true,
          options: true,
          conditionalOptions: true,
          // Sektör kapsamı bölüm düzeyinde tanımlı.
          subCategoryId: true,
          subLevel: { select: { subCategoryId: true } }
        }
      }
    }
  });

  const scopeOf = await getScopeResolver(userId, surveyId, db);

  // Bonus yalnızca kullanıcının erişebildiği (ve istenmişse seçili) anketin
  // önerilerinden gelir.
  const surveyIds = await getAccessibleSurveyIds(userId, surveyId, db);
  const recommendationWhere = await buildRecommendationSurveyWhere(surveyIds, db);

  const completedRecs = await db.roadmapItem.findMany({
    where: {
      userId,
      status: "COMPLETED",
      recommendation: recommendationWhere
    },
    include: {
      recommendation: {
        select: {
          id: true,
          questionId: true,
          triggerMaxAnswerScore: true,
          points: true,
          subLevel: { select: { axisType: true } }
        }
      }
    }
  });

  // Kademeli önerilerde ilerleme, tamamlanan basamaklardan okunur. Basamağın
  // bitmiş sayılması için o eşikteki tüm önerilerin tamamlanmış olması gerekir;
  // bu yüzden yalnızca tamamlananlar değil sorunun tüm kademeleri gerekir.
  const cascadeRecs = await db.recommendation.findMany({
    where: {
      AND: [recommendationWhere, { questionId: { not: null }, triggerMaxAnswerScore: { not: null } }]
    },
    select: { id: true, questionId: true, triggerMaxAnswerScore: true }
  });

  const completedIds = new Set(completedRecs.map(item => item.recommendationId));
  const baselineByQuestion = new Map(
    responses.map(response => [response.question.id, response.score ?? 0])
  );
  const cascadeLevels = buildCascadeLevels(
    applicableCascadeRecommendations(cascadeRecs, baselineByQuestion),
    completedIds
  );

  // Eksen puanı, sorunun kendi tavanına göre normalize edilmiş başarı
  // oranından hesaplanır — kategori puanlarıyla aynı ölçek (bkz.
  // percentageToScore). Ham puanların doğrudan ortalaması alınırsa tavanı 5'in
  // altında olan sorular ekseni haksız yere aşağı çeker.
  let velocitySum = 0, velocityWeight = 0;
  let enduranceSum = 0, enduranceWeight = 0;
  // Kapsam dışı sorular "cevaplandı" sayılmaz; ilerleme yüzdesi şişmesin.
  let answeredInScope = 0;

  for (const response of responses) {
    const scope = scopeOf(
      response.question.subLevel?.subCategoryId ?? response.question.subCategoryId
    );
    if (!scope.applicable) continue;

    answeredInScope++;
    const weight = (response.question.weight || 1) * scope.weight;
    const max = maxScoreForQuestion(response.question);
    const effective = effectiveQuestionScore(
      response.score,
      cascadeLevels.get(response.question.id),
      max
    );
    const ratio = max > 0 ? Math.min(1, Math.max(0, effective / max)) : 0;

    if (response.question.axisType === "ENDURANCE") {
      enduranceSum += ratio * weight;
      enduranceWeight += weight;
    } else {
      velocitySum += ratio * weight;
      velocityWeight += weight;
    }
  }

  /**
   * Kademesiz önerilerin `points` değeri "kaç soruluk ilerlemeye denk"
   * anlamındadır: 1.0 = ağırlığı 1 olan bir soruyu en alttan tavana çıkarmak,
   * 0.5 = onun yarısı. Bu yüzden eksen ortalamasına doğrudan eklenmez,
   * soruların katkısıyla aynı birimde toplanır.
   *
   * Önceden ham `points` doğrudan 1-5 ortalamasına ekleniyordu; anket ne kadar
   * uzun olursa olsun her öneri +0.5 getiriyor, on öneri tamamlayan herkes
   * cevaplarından bağımsız olarak tavana dayanıyordu. Artık katkı anketin
   * boyutuna göre orantılı: Δ = 4 × points / eksenAğırlığı.
   */
  let velocityBonusUnits = 0, enduranceBonusUnits = 0;

  for (const item of completedRecs) {
    // Kademeli öneriler etkin puana zaten yansıdı; bonus olarak tekrar sayılmaz.
    const threshold = item.recommendation.triggerMaxAnswerScore;
    if (typeof threshold === "number" && Number.isFinite(threshold)) continue;

    const points = item.recommendation.points || 0;
    if ((item.recommendation.subLevel?.axisType ?? "VELOCITY") === "ENDURANCE") {
      enduranceBonusUnits += points;
    } else {
      velocityBonusUnits += points;
    }
  }

  // Cevap yoksa eksen 0 kalır ("veri yok"); aksi hâlde başarı oranı 1-5
  // ölçeğine taşınır (%0 → 1.0, %100 → 5.0). Oran 1'i aşamaz, dolayısıyla
  // puan 5'i aşamaz.
  const axisScore = (sum: number, weight: number) =>
    weight > 0 ? percentageToScore(Math.min(1, sum / weight) * 100) : 0;

  const baseVelocity = axisScore(velocitySum, velocityWeight);
  const baseEndurance = axisScore(enduranceSum, enduranceWeight);

  const velocityScore = axisScore(velocitySum + velocityBonusUnits, velocityWeight);
  const enduranceScore = axisScore(enduranceSum + enduranceBonusUnits, enduranceWeight);

  // Grafiğe bildirilen bonus, ham `points` değil puana yaptığı gerçek etkidir.
  const velocityBonus = velocityScore - baseVelocity;
  const enduranceBonus = enduranceScore - baseEndurance;

  // Genel puan eksenlerin soru ağırlıklarına göre bileşimi — böylece bonus
  // sonrası da eksen puanlarıyla tutarlı kalır ve 5'i aşamaz.
  const axisWeightTotal = velocityWeight + enduranceWeight;
  const overallScore = axisWeightTotal > 0
    ? (velocityScore * velocityWeight + enduranceScore * enduranceWeight) / axisWeightTotal
    : 0;

  const overallPercentage = Math.min(100, Math.max(0, ((overallScore - 1) / 4) * 100));

  // Toplam soru sayısı kapsam dışı bölümleri içermez — kullanıcıya
  // sorulmayan soru "tamamlanacak iş" gibi görünmemeli.
  const scopedQuestions = await db.question.findMany({
    where: questionWhere,
    select: { subCategoryId: true, subLevel: { select: { subCategoryId: true } } }
  });
  const totalQuestions = scopedQuestions.filter(
    (q) => scopeOf(q.subLevel?.subCategoryId ?? q.subCategoryId).applicable
  ).length;

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    overallPercentage: Math.round(overallPercentage),
    velocityScore: Math.round(velocityScore * 10) / 10,
    enduranceScore: Math.round(enduranceScore * 10) / 10,
    quadrant: classifyQuadrant(velocityScore, enduranceScore),
    completedQuestions: answeredInScope,
    totalQuestions,
    completedRecommendations: completedRecs.length,
    velocityWeight,
    enduranceWeight,
    velocityBase: Math.round(baseVelocity * 10) / 10,
    enduranceBase: Math.round(baseEndurance * 10) / 10,
    velocityBonus: Math.round(velocityBonus * 100) / 100,
    enduranceBonus: Math.round(enduranceBonus * 100) / 100
  };
}
