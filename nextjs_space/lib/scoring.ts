import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getAssessmentIds } from "./assessment";
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

/**
 * Yüzdeden 1-5 puana dönüştürme — uygulamanın **tek** ölçek dönüşümü.
 *
 * %0 → 1.0, %100 → 5.0. Dışa açık olmasının nedeni: /api/benchmarks/user
 * kendi başına `(yüzde/100)*5` kullanıyordu ve aynı veri için ana puan
 * kartında 3.0, kıyaslama kartında 2.5 görünüyordu. Tek kaynak burasıdır.
 */
export function percentageToScore(percentage: number): number {
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

/** Cevap değerinin saklanabileceği en uzun metin. */
export const MAX_RESPONSE_VALUE_LENGTH = 4000;

export type ResponseScoring =
  | { ok: true; score: number; value: string }
  | { ok: false; error: string };

/**
 * Bir cevabı doğrular ve puana çevirir — yazma yolunun tek kaynağı.
 *
 * Önceden puan, rotanın içinde hesaplanıyordu ve SCALE dalı gelen değeri hiç
 * sınırlamıyordu: `parseFloat(value) || 0` istemcinin gönderdiği 999'u olduğu
 * gibi kaydediyordu. Tek bir cevap kuruluşun yüzdesini %19980'e çıkarabiliyor,
 * puan oradan sektör ortalamalarına ve oda raporlarına sızıyordu. Tanımsız bir
 * şık değeri de sessizce kabul ediliyordu (YES_NO'da 1, MULTIPLE_CHOICE'ta 0).
 *
 * Kural artık tek yerde: değer sorunun tanımıyla uyuşmalı, puan da sorunun
 * kendi tavanını aşmamalı. Uymayan istek 400 alır; sessizce yanlış puan yazılmaz.
 */
export function scoreResponse(
  question: {
    type?: string | null;
    options?: unknown;
    conditionalOptions?: unknown;
  },
  rawValue: unknown
): ResponseScoring {
  if (rawValue === null || rawValue === undefined) {
    return { ok: false, error: "Cevap değeri gerekli." };
  }
  if (typeof rawValue === "object") {
    return { ok: false, error: "Cevap değeri metin ya da sayı olmalı." };
  }

  const value = String(rawValue);
  if (value.length > MAX_RESPONSE_VALUE_LENGTH) {
    return { ok: false, error: "Cevap değeri çok uzun." };
  }

  const options = Array.isArray(question.options)
    ? (question.options as Array<Record<string, unknown>>)
    : null;

  const fromOptions = (fallback?: () => number | null): ResponseScoring => {
    const selected = options?.find((option) => option?.value === value);
    if (selected) {
      const score = Number(selected.score);
      if (!Number.isFinite(score)) {
        return { ok: false, error: "Bu şıkkın puanı tanımsız." };
      }
      return { ok: true, score: clampScore(score), value };
    }
    const fallbackScore = fallback?.() ?? null;
    if (fallbackScore === null) {
      return { ok: false, error: "Geçersiz şık." };
    }
    return { ok: true, score: clampScore(fallbackScore), value };
  };

  switch (question.type) {
    case "SCALE": {
      const parsed = Number(value.trim());
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: "Ölçek cevabı sayı olmalı." };
      }
      if (parsed < 0 || parsed > MAX_QUESTION_SCORE) {
        return {
          ok: false,
          error: `Ölçek cevabı 0 ile ${MAX_QUESTION_SCORE} arasında olmalı.`,
        };
      }
      return { ok: true, score: clampScore(parsed), value };
    }

    case "YES_NO":
      // Şık tanımı olmayan eski sorular için evet/hayır yine 5/1 sayılır;
      // ama "evet"/"hayir" gibi eşleşmeyen bir değer artık sessizce geçmez.
      return fromOptions(() =>
        value === "yes" ? MAX_QUESTION_SCORE : value === "no" ? 1 : null
      );

    case "MULTIPLE_CHOICE":
      return fromOptions();

    case "CONDITIONAL_CHOICE": {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        return { ok: false, error: "Koşullu cevap geçerli JSON olmalı." };
      }
      const threshold = (parsed as { threshold?: unknown } | null)?.threshold;
      if (threshold !== "yes" && threshold !== "no") {
        return { ok: false, error: "Koşullu cevapta 'threshold' evet/hayır olmalı." };
      }
      return {
        ok: true,
        score: scoreConditionalChoice(value, question.conditionalOptions as any),
        value,
      };
    }

    default:
      return { ok: false, error: "Bu soru tipi puanlanamıyor." };
  }
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

  // Cevaplar kişiye değil kuruluşun değerlendirmesine bağlı; aynı kuruluştaki
  // herkesin girdiği cevaplar tek puanda toplanır.
  const assessmentIds = await getAssessmentIds(
    userId,
    surveyId ? [surveyId] : await getAccessibleSurveyIds(userId)
  );

  const responses = await prisma.surveyResponse.findMany({
    where: {
      assessmentId: { in: assessmentIds },
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
    /**
     * Saklanan puan burada da sınırlanır.
     *
     * Yazma yolu artık doğruluyor (bkz. scoreResponse), ama bu fonksiyon eski
     * kayıtları da okuyor ve kampanya panosundaki ikiz hesap (bkz.
     * organization-campaign > scoreAssessment) zaten sınırlıyordu. İki motorun
     * aynı veriden farklı yüzde üretmesi, üyenin kendi panosunda gördüğü puan
     * ile odanın gördüğü puanın ayrışması demekti.
     */
    const questionMax = maxScoreForQuestion(question ?? {});
    const bounded = Math.min(questionMax, Math.max(0, response?.score ?? 0));
    const score = bounded * weight;
    const maxScore = questionMax * weight;

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
    // 1-5 puanı ham yüzdeden çevrilir; yuvarlanmış yüzdeden çevirmek kampanya
    // panosundaki ikiz hesapla arada sistematik fark bırakıyordu.
    const rawPercentage = data?.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0;
    const percentage = Math.round(rawPercentage);
    const scoreOn5 = percentageToScore(rawPercentage);
    normalizedCategoryScores[catId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown'
    };
  }

  for (const [subLevelId, data] of Object.entries(subLevelScores)) {
    const rawPercentage = data?.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0;
    const percentage = Math.round(rawPercentage);
    const scoreOn5 = percentageToScore(rawPercentage);
    normalizedSubLevelScores[subLevelId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  for (const [subCatId, data] of Object.entries(subCategoryScores)) {
    const rawPercentage = data?.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0;
    const percentage = Math.round(rawPercentage);
    const scoreOn5 = percentageToScore(rawPercentage);
    normalizedSubCategoryScores[subCatId] = {
      score: Math.round(data?.score ?? 0),
      scoreOn5: Math.round(scoreOn5 * 10) / 10,
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  const totalMaxScore = Object.values(categoryScores).reduce((sum, data) => sum + data.maxScore, 0);
  const rawTotalPercentage = totalMaxScore > 0 ? (totalWeightedScore / totalMaxScore) * 100 : 0;
  const totalPercentage = Math.round(rawTotalPercentage);
  const totalScoreOn5 = percentageToScore(rawTotalPercentage);

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
  options: {
    surveyId?: string;
    /**
     * Hazır hesaplanmış puan.
     *
     * Pano bu fonksiyonu `calculateUserScore` ile aynı istekte çağırıyordu ve
     * fonksiyon içeride aynı ağır hesabı bir kez daha yapıyordu. Çağıran taraf
     * zaten hesapladıysa geçirebilir.
     */
    scores?: Awaited<ReturnType<typeof calculateUserScore>>;
  } = {}
) {
  // Kullanıcının tüm anket cevaplarını getir
  const recSurveyIds = await getAccessibleSurveyIds(userId, options.surveyId);
  const recAssessmentIds = await getAssessmentIds(userId, recSurveyIds);

  const userResponses = await prisma.surveyResponse.findMany({
    where: { assessmentId: { in: recAssessmentIds } },
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
  const surveyIds = recSurveyIds;
  const surveyWhere = await buildRecommendationSurveyWhere(surveyIds);

  const { categoryScores, subLevelScores, subCategoryScores } =
    options.scores ?? (await calculateUserScore(userId, options.surveyId));
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
    where: { assessmentId: { in: recAssessmentIds } },
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
  /**
   * Taban: yalnızca anket cevaplarıyla, hiç öneri tamamlanmamış gibi
   * hesaplanan eksen puanları. Bonus = mevcut − taban. Kademeli önerilerin
   * basamak yükseltmesi de bonusa dahildir (bkz. docs/GELISIM-PUANI.md).
   */
  velocityBase: number;
  enduranceBase: number;
  velocityBonus: number;
  enduranceBonus: number;
  /** Taban genel puan ve yüzde. */
  baselineOverallScore: number;
  baselineOverallPercentage: number;
  /** Gelişim katkısı: mevcut − taban; 1-5 ölçeğinde ve yüzde puanı olarak. */
  delta: number;
  deltaPercentage: number;
};

// ---------------------------------------------------------------------------
// Gelişim motoru — saf hesap
//
// Veri yükleme (`loadProgressInputs`) ile hesap (`computeProgress` ve
// arkadaşları) ayrıdır. Böylece aynı yükle taban, mevcut ve öneri başına
// katkı ek sorgu olmadan hesaplanır ve hepsi DB olmadan test edilebilir.
// Tanımlar için: docs/GELISIM-PUANI.md
// ---------------------------------------------------------------------------

export type ProgressAxis = "VELOCITY" | "ENDURANCE";

export type ProgressResponseInput = {
  questionId: string;
  score: number;
  /** Soru ağırlığı × sektör kapsam ağırlığı. */
  weight: number;
  /** Sektör kapsamı dışındaki soru hesaba girmez. */
  applicable: boolean;
  axisType: ProgressAxis;
  maxScore: number;
  categoryId: string | null;
  subCategoryId: string | null;
};

export type ProgressRecommendationInput = {
  id: string;
  questionId: string | null;
  triggerMaxAnswerScore: number | null;
  points: number;
  axisType: ProgressAxis;
  categoryId: string | null;
  subCategoryId: string | null;
};

export type ProgressInputs = {
  responses: ProgressResponseInput[];
  /**
   * Kapsamdaki tüm kademeli öneriler (merdiven kurmak için hepsi gerekir)
   * ile tamamlanmış ya da katkısı sorulan öneriler. Kimliğe göre tekildir.
   */
  recommendations: ProgressRecommendationInput[];
  completedIds: Set<string>;
  /** Tamamlanmış yol haritası kalemi sayısı (rapor için). */
  completedCount: number;
  totalQuestions: number;
};

/** Kademeli öneri: eşiği dolu olan. Katkısı basamaktan türetilir. */
export function isCascadeRecommendation(rec: { triggerMaxAnswerScore: number | null | undefined }): boolean {
  const threshold = rec.triggerMaxAnswerScore;
  return typeof threshold === "number" && Number.isFinite(threshold);
}

/**
 * Önerinin bonus birimi. Kademeli öneride her zaman 0 (kural 2); kademesizde
 * saklanan puan, geçersiz ya da negatifse 0.
 */
export function effectiveRecommendationPoints(rec: {
  triggerMaxAnswerScore: number | null | undefined;
  points: number | null | undefined;
}): number {
  if (isCascadeRecommendation(rec)) return 0;
  const points = rec.points;
  return typeof points === "number" && Number.isFinite(points) && points > 0 ? points : 0;
}

type AxisTotals = { sum: number; weight: number };

export type ProgressComputation = {
  velocity: AxisTotals;
  endurance: AxisTotals;
  answeredInScope: number;
  velocityScore: number;
  enduranceScore: number;
  overallScore: number;
  overallPercentage: number;
  cascadeLevels: Map<string, CascadeLevelState>;
};

const ratioOf = (score: number, max: number) =>
  max > 0 ? Math.min(1, Math.max(0, score / max)) : 0;

// Cevap yoksa eksen 0 kalır ("veri yok"); aksi hâlde başarı oranı 1-5
// ölçeğine taşınır (%0 → 1.0, %100 → 5.0). Oran 1'i aşamaz, dolayısıyla
// puan 5'i aşamaz.
const axisScoreOf = ({ sum, weight }: AxisTotals) =>
  weight > 0 ? percentageToScore(Math.min(1, sum / weight) * 100) : 0;

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Verilen tamamlanma kümesiyle eksen ve genel puanı hesaplar (yuvarlanmamış).
 *
 *   - Sorunun etkin puanı = baseline cevabı ile tamamlanan kademelerin yükseği
 *   - Eksen puanı = etkin puanların soru tavanına göre ağırlıklı başarı oranı,
 *     kategori puanlarıyla aynı 1-5 ölçeğine taşınır
 *   - Kademesiz önerilerin `points` değeri "kaç soruluk ilerlemeye denk"
 *     birimindedir ve soruların katkısıyla aynı ölçekte toplanır:
 *     Δ = 4 × points / eksenAğırlığı. Kademeli olanlar etkin puana zaten
 *     yansıdığı için mükerrer sayılmaz.
 *   - Genel puan, iki eksenin soru ağırlıklarına göre bileşimidir
 */
export function computeProgress(
  inputs: ProgressInputs,
  completedIds: Set<string> = inputs.completedIds
): ProgressComputation {
  const baselineByQuestion = new Map(
    inputs.responses.map(response => [response.questionId, response.score ?? 0])
  );
  const cascadeLevels = buildCascadeLevels(
    applicableCascadeRecommendations(
      inputs.recommendations.filter(isCascadeRecommendation),
      baselineByQuestion
    ),
    completedIds
  );

  const velocity: AxisTotals = { sum: 0, weight: 0 };
  const endurance: AxisTotals = { sum: 0, weight: 0 };
  let answeredInScope = 0;

  for (const response of inputs.responses) {
    if (!response.applicable) continue;
    answeredInScope++;
    const effective = effectiveQuestionScore(
      response.score,
      cascadeLevels.get(response.questionId),
      response.maxScore
    );
    const axis = response.axisType === "ENDURANCE" ? endurance : velocity;
    axis.sum += ratioOf(effective, response.maxScore) * response.weight;
    axis.weight += response.weight;
  }

  for (const rec of inputs.recommendations) {
    if (!completedIds.has(rec.id)) continue;
    const points = effectiveRecommendationPoints(rec);
    if (points === 0) continue;
    (rec.axisType === "ENDURANCE" ? endurance : velocity).sum += points;
  }

  const velocityScore = axisScoreOf(velocity);
  const enduranceScore = axisScoreOf(endurance);
  const axisWeightTotal = velocity.weight + endurance.weight;
  const overallScore = axisWeightTotal > 0
    ? (velocityScore * velocity.weight + enduranceScore * endurance.weight) / axisWeightTotal
    : 0;
  const overallPercentage = Math.min(100, Math.max(0, ((overallScore - 1) / 4) * 100));

  return {
    velocity,
    endurance,
    answeredInScope,
    velocityScore,
    enduranceScore,
    overallScore,
    overallPercentage,
    cascadeLevels
  };
}

/** Mevcut ve taban hesabını rapor biçimine çevirir. */
export function summarizeProgress(inputs: ProgressInputs): ProgressScores {
  const current = computeProgress(inputs);
  const baseline = computeProgress(inputs, new Set());

  return {
    overallScore: round1(current.overallScore),
    overallPercentage: Math.round(current.overallPercentage),
    velocityScore: round1(current.velocityScore),
    enduranceScore: round1(current.enduranceScore),
    quadrant: classifyQuadrant(current.velocityScore, current.enduranceScore),
    completedQuestions: current.answeredInScope,
    totalQuestions: inputs.totalQuestions,
    completedRecommendations: inputs.completedCount,
    velocityWeight: current.velocity.weight,
    enduranceWeight: current.endurance.weight,
    velocityBase: round1(baseline.velocityScore),
    enduranceBase: round1(baseline.enduranceScore),
    velocityBonus: round2(current.velocityScore - baseline.velocityScore),
    enduranceBonus: round2(current.enduranceScore - baseline.enduranceScore),
    baselineOverallScore: round1(baseline.overallScore),
    baselineOverallPercentage: Math.round(baseline.overallPercentage),
    delta: round2(current.overallScore - baseline.overallScore),
    deltaPercentage: round1(current.overallPercentage - baseline.overallPercentage)
  };
}

export type RecommendationContribution = {
  recommendationId: string;
  kind: "cascade" | "points";
  /** Öneri tamamlandığında genel puana eklediği fark (1-5 ölçeği). */
  full: number;
  /** Bugünkü durumuyla eklediği fark; tamamlanmamışsa 0. */
  current: number;
  /** Kademeli öneride basamak konumu (1'den başlar); kademesizde null. */
  rung: { index: number; total: number } | null;
};

/**
 * Öneri başına katkı (kural 4).
 *
 * Kademesiz öneri: tamamlanmış kümeye eklenince/çıkarılınca oluşan fark.
 * Kademeli öneri: k. basamağın katkısı, "k−1 basamak tamamken k. basamağı
 * da tamamlamak" ile oluşan farktır — hangi sayfadan bakılırsa bakılsın aynı
 * sayı çıkar ve bir merdivenin basamak katkıları toplamı merdivenin toplam
 * katkısına eşittir. Aynı basamakta birden çok öneri varsa fark eşit bölünür.
 */
export function computeRecommendationContributions(
  inputs: ProgressInputs,
  recommendationIds: Iterable<string>
): Map<string, RecommendationContribution> {
  const byId = new Map(inputs.recommendations.map(rec => [rec.id, rec]));
  const baselineByQuestion = new Map(
    inputs.responses.map(response => [response.questionId, response.score ?? 0])
  );
  const applicableCascade = applicableCascadeRecommendations(
    inputs.recommendations.filter(isCascadeRecommendation),
    baselineByQuestion
  );

  // Soru → sıralı eşikler ve her eşikteki öneri kimlikleri.
  const ladders = new Map<string, { thresholds: number[]; idsByThreshold: Map<number, string[]> }>();
  for (const rec of applicableCascade) {
    if (!rec.questionId || rec.triggerMaxAnswerScore === null) continue;
    let ladder = ladders.get(rec.questionId);
    if (!ladder) {
      ladder = { thresholds: [], idsByThreshold: new Map() };
      ladders.set(rec.questionId, ladder);
    }
    const bucket = ladder.idsByThreshold.get(rec.triggerMaxAnswerScore);
    if (bucket) bucket.push(rec.id);
    else ladder.idsByThreshold.set(rec.triggerMaxAnswerScore, [rec.id]);
  }
  for (const ladder of ladders.values()) {
    ladder.thresholds = [...ladder.idsByThreshold.keys()].sort((a, b) => a - b);
  }

  const actualLevels = computeProgress(inputs).cascadeLevels;
  const overallOf = (completed: Set<string>) => computeProgress(inputs, completed).overallScore;
  const completed = inputs.completedIds;

  const result = new Map<string, RecommendationContribution>();
  for (const id of recommendationIds) {
    const rec = byId.get(id);
    if (!rec) {
      result.set(id, { recommendationId: id, kind: "points", full: 0, current: 0, rung: null });
      continue;
    }

    if (!isCascadeRecommendation(rec)) {
      const without = new Set(completed);
      without.delete(id);
      const withRec = new Set(without);
      withRec.add(id);
      const full = round2(overallOf(withRec) - overallOf(without));
      result.set(id, {
        recommendationId: id,
        kind: "points",
        full,
        current: completed.has(id) ? full : 0,
        rung: null
      });
      continue;
    }

    const ladder = rec.questionId ? ladders.get(rec.questionId) : undefined;
    const rungIndex = ladder && rec.triggerMaxAnswerScore !== null
      ? ladder.thresholds.indexOf(rec.triggerMaxAnswerScore)
      : -1;
    if (!ladder || rungIndex < 0) {
      // Cevaplanmamış soru ya da baseline'ın altında kalan basamak: kullanıcıya
      // gösterilmez, katkısı da yoktur.
      result.set(id, { recommendationId: id, kind: "cascade", full: 0, current: 0, rung: null });
      continue;
    }

    const ladderIds = new Set([...ladder.idsByThreshold.values()].flat());
    const base = new Set([...completed].filter(recId => !ladderIds.has(recId)));
    for (let i = 0; i < rungIndex; i++) {
      for (const recId of ladder.idsByThreshold.get(ladder.thresholds[i]) ?? []) base.add(recId);
    }
    const rungIds = ladder.idsByThreshold.get(ladder.thresholds[rungIndex]) ?? [];
    const withRung = new Set(base);
    for (const recId of rungIds) withRung.add(recId);

    const share = round2((overallOf(withRung) - overallOf(base)) / Math.max(1, rungIds.length));
    const counted = (actualLevels.get(rec.questionId!)?.currentIndex ?? 0) > rungIndex;

    result.set(id, {
      recommendationId: id,
      kind: "cascade",
      full: share,
      current: completed.has(id) && counted ? share : 0,
      rung: { index: rungIndex + 1, total: ladder.thresholds.length }
    });
  }

  return result;
}

export type ProgressBreakdownNode = {
  id: string;
  name: string;
  /** Taban puan (1-5); cevap yoksa 0. */
  baseScore: number;
  /** Mevcut puan (1-5). */
  totalScore: number;
  /** Fark: totalScore − baseScore. Alan adı eski API sözleşmesinden kalır. */
  bonusPoints: number;
  completedCount: number;
  responseCount: number;
};

export type ProgressBreakdownCategory = ProgressBreakdownNode & {
  subCategories: ProgressBreakdownNode[];
};

type BreakdownTree = Array<{
  id: string;
  name: string;
  subCategories: Array<{ id: string; name: string }>;
}>;

/**
 * Kategori ve alt kategori kırılımı — eksenle aynı yöntem: ağırlıklı
 * normalize başarı oranı 1-5 ölçeğine taşınır. Kademeli önerinin basamak
 * yükseltmesi sorunun kategorisine, kademesiz önerinin puanı kendi
 * kategorisine düşer.
 */
export function computeProgressBreakdown(
  inputs: ProgressInputs,
  tree: BreakdownTree
): ProgressBreakdownCategory[] {
  const { cascadeLevels } = computeProgress(inputs);
  const categoryOfQuestion = new Map(
    inputs.responses.map(response => [response.questionId, response] as const)
  );

  const node = (
    id: string,
    name: string,
    inNode: (item: { categoryId: string | null; subCategoryId: string | null }) => boolean
  ): ProgressBreakdownNode => {
    let sumBase = 0, sumCurrent = 0, weight = 0, responseCount = 0;
    for (const response of inputs.responses) {
      if (!response.applicable || !inNode(response)) continue;
      responseCount++;
      const effective = effectiveQuestionScore(
        response.score,
        cascadeLevels.get(response.questionId),
        response.maxScore
      );
      sumBase += ratioOf(response.score, response.maxScore) * response.weight;
      sumCurrent += ratioOf(effective, response.maxScore) * response.weight;
      weight += response.weight;
    }

    let completedCount = 0;
    for (const rec of inputs.recommendations) {
      if (!inputs.completedIds.has(rec.id)) continue;
      // Kategorisi olmayan ama soruya bağlı öneri, sorunun kategorisine düşer.
      const placement = rec.categoryId || rec.subCategoryId
        ? rec
        : categoryOfQuestion.get(rec.questionId ?? "") ?? rec;
      if (!inNode(placement)) continue;
      completedCount++;
      sumCurrent += effectiveRecommendationPoints(rec);
    }

    const baseScore = axisScoreOf({ sum: sumBase, weight });
    const totalScore = axisScoreOf({ sum: sumCurrent, weight });
    return {
      id,
      name,
      baseScore: round2(baseScore),
      totalScore: round2(totalScore),
      bonusPoints: round2(totalScore - baseScore),
      completedCount,
      responseCount
    };
  };

  return tree.map(category => ({
    ...node(category.id, category.name, item => item.categoryId === category.id),
    subCategories: category.subCategories.map(sub =>
      node(sub.id, sub.name, item => item.subCategoryId === sub.id)
    )
  }));
}

// ---------------------------------------------------------------------------
// Gelişim motoru — veri yükleme
// ---------------------------------------------------------------------------

type RecommendationRow = {
  id?: string | null;
  questionId?: string | null;
  triggerMaxAnswerScore?: number | null;
  points?: number | null;
  categoryId?: string | null;
  subCategoryId?: string | null;
  subLevel?: {
    axisType?: string | null;
    subCategoryId?: string | null;
    subCategory?: { categoryId?: string | null } | null;
  } | null;
  subCategory?: { categoryId?: string | null } | null;
};

/** Prisma satırını motor girdisine çevirir. */
export function toProgressRecommendationInput(
  rec: RecommendationRow,
  fallbackId: string
): ProgressRecommendationInput {
  return {
    id: rec.id ?? fallbackId,
    questionId: rec.questionId ?? null,
    triggerMaxAnswerScore: rec.triggerMaxAnswerScore ?? null,
    points: rec.points ?? 0,
    axisType: rec.subLevel?.axisType === "ENDURANCE" ? "ENDURANCE" : "VELOCITY",
    categoryId:
      rec.categoryId ??
      rec.subCategory?.categoryId ??
      rec.subLevel?.subCategory?.categoryId ??
      null,
    subCategoryId: rec.subCategoryId ?? rec.subLevel?.subCategoryId ?? null
  };
}

const RECOMMENDATION_INPUT_SELECT = {
  id: true,
  questionId: true,
  triggerMaxAnswerScore: true,
  points: true,
  categoryId: true,
  subCategoryId: true,
  subLevel: { select: { axisType: true, subCategoryId: true, subCategory: { select: { categoryId: true } } } },
  subCategory: { select: { categoryId: true } }
} as const;

/**
 * Motor girdilerini yükler. Bonus yalnızca kullanıcının erişebildiği (ve
 * istenmişse seçili) anketin önerilerinden gelir. `extraRecommendations`,
 * katkısı sorulan ama henüz tamamlanmamış önerileri (yol haritası kalemleri)
 * hesaba dahil eder.
 */
export async function loadProgressInputs(
  userId: string,
  options: { surveyId?: string; db?: DbClient; extraRecommendations?: RecommendationRow[] } = {}
): Promise<ProgressInputs> {
  const { surveyId } = options;
  const db = options.db ?? prisma;

  const questionWhere = {
    archivedAt: null,
    ...(surveyId ? buildSurveyQuestionWhere(surveyId) : {})
  };

  const progressAssessmentIds = await getAssessmentIds(
    userId,
    surveyId ? [surveyId] : await getAccessibleSurveyIds(userId, undefined, db),
    db
  );

  const responses = await db.surveyResponse.findMany({
    where: { assessmentId: { in: progressAssessmentIds }, question: questionWhere },
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
          // Sektör kapsamı bölüm düzeyinde tanımlı; kırılım için kategori de.
          categoryId: true,
          subCategoryId: true,
          subCategory: { select: { categoryId: true } },
          subLevel: { select: { subCategoryId: true, subCategory: { select: { categoryId: true } } } }
        }
      }
    }
  });

  const scopeOf = await getScopeResolver(userId, surveyId, db);

  const surveyIds = await getAccessibleSurveyIds(userId, surveyId, db);
  const recommendationWhere = await buildRecommendationSurveyWhere(surveyIds, db);

  const completedItems = await db.roadmapItem.findMany({
    where: {
      assessmentId: { in: progressAssessmentIds },
      status: "COMPLETED",
      recommendation: recommendationWhere
    },
    include: { recommendation: { select: RECOMMENDATION_INPUT_SELECT } }
  });

  // Kademeli önerilerde ilerleme, tamamlanan basamaklardan okunur. Basamağın
  // bitmiş sayılması için o eşikteki tüm önerilerin tamamlanmış olması gerekir;
  // bu yüzden yalnızca tamamlananlar değil sorunun tüm kademeleri gerekir.
  const cascadeRecs = await db.recommendation.findMany({
    where: {
      AND: [recommendationWhere, { questionId: { not: null }, triggerMaxAnswerScore: { not: null } }]
    },
    select: RECOMMENDATION_INPUT_SELECT
  });

  // Toplam soru sayısı kapsam dışı bölümleri içermez — kullanıcıya
  // sorulmayan soru "tamamlanacak iş" gibi görünmemeli.
  const scopedQuestions = await db.question.findMany({
    where: questionWhere,
    select: { subCategoryId: true, subLevel: { select: { subCategoryId: true } } }
  });

  const responseInputs: ProgressResponseInput[] = responses.map(response => {
    const question = response.question as typeof response.question & {
      id?: string;
      categoryId?: string | null;
      subCategoryId?: string | null;
      subCategory?: { categoryId?: string | null } | null;
      subLevel?: { subCategoryId?: string | null; subCategory?: { categoryId?: string | null } | null } | null;
    };
    const subCategoryId = question.subLevel?.subCategoryId ?? question.subCategoryId ?? null;
    const scope = scopeOf(subCategoryId);
    return {
      questionId: question.id as string,
      score: response.score,
      weight: (question.weight || 1) * scope.weight,
      applicable: scope.applicable,
      axisType: question.axisType === "ENDURANCE" ? "ENDURANCE" : "VELOCITY",
      maxScore: maxScoreForQuestion(question),
      categoryId:
        question.categoryId ??
        question.subCategory?.categoryId ??
        question.subLevel?.subCategory?.categoryId ??
        null,
      subCategoryId
    };
  });

  const recommendations = new Map<string, ProgressRecommendationInput>();
  const completedIds = new Set<string>();
  completedItems.forEach((item, index) => {
    const rec = toProgressRecommendationInput(
      (item.recommendation ?? {}) as RecommendationRow,
      (item as { recommendationId?: string }).recommendationId ?? `roadmap-${index}`
    );
    recommendations.set(rec.id, rec);
    completedIds.add(rec.id);
  });
  cascadeRecs.forEach((row, index) => {
    const rec = toProgressRecommendationInput(row as RecommendationRow, `cascade-${index}`);
    if (!recommendations.has(rec.id)) recommendations.set(rec.id, rec);
  });
  (options.extraRecommendations ?? []).forEach((row, index) => {
    const rec = toProgressRecommendationInput(row, `extra-${index}`);
    if (!recommendations.has(rec.id)) recommendations.set(rec.id, rec);
  });

  const totalQuestions = scopedQuestions.filter(
    (q) => scopeOf(q.subLevel?.subCategoryId ?? q.subCategoryId).applicable
  ).length;

  return {
    responses: responseInputs,
    recommendations: [...recommendations.values()],
    completedIds,
    completedCount: completedItems.length,
    totalQuestions
  };
}

/**
 * Gelişim puanı — tek doğru kaynak.
 *
 * `ScoreHistory` tablosuna yazan her yol (ilk snapshot, gönderim, öneri
 * tamamlama) ve her ekran bu fonksiyonu kullanır. Tanım: docs/GELISIM-PUANI.md
 */
export async function calculateProgressScores(
  userId: string,
  options: { surveyId?: string; db?: DbClient } = {}
): Promise<ProgressScores> {
  return summarizeProgress(await loadProgressInputs(userId, options));
}

/**
 * Yol haritası kalemleri için öneri başına katkı. Kalemler tamamlanmamış da
 * olabilir; bu yüzden önerileri motora ek girdi olarak verilir.
 */
export async function calculateRecommendationContributions(
  userId: string,
  recommendations: RecommendationRow[],
  options: { surveyId?: string; db?: DbClient } = {}
): Promise<{ scores: ProgressScores; contributions: Map<string, RecommendationContribution> }> {
  const inputs = await loadProgressInputs(userId, { ...options, extraRecommendations: recommendations });
  const ids = recommendations.map((rec, index) => rec.id ?? `extra-${index}`);
  return {
    scores: summarizeProgress(inputs),
    contributions: computeRecommendationContributions(inputs, ids)
  };
}

/** Pano için kategori kırılımı ve genel puanlar — tek yükle. */
export async function calculateProgressBreakdown(
  userId: string,
  options: { surveyId?: string; db?: DbClient } = {}
): Promise<{ scores: ProgressScores; categories: ProgressBreakdownCategory[] }> {
  const db = options.db ?? prisma;
  const [inputs, tree] = await Promise.all([
    loadProgressInputs(userId, options),
    db.category.findMany({
      where: { archivedAt: null, ...(options.surveyId ? { surveyId: options.surveyId } : {}) },
      select: {
        id: true,
        name: true,
        subCategories: {
          where: { archivedAt: null },
          orderBy: { order: "asc" },
          select: { id: true, name: true }
        }
      },
      orderBy: { order: "asc" }
    })
  ]);

  return {
    scores: summarizeProgress(inputs),
    categories: computeProgressBreakdown(inputs, tree)
  };
}
