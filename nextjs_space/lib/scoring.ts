import { prisma } from "./db";

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
 * Bir sorunun alabileceği maksimum ham puan (1-5 ölçeği).
 * Puanlama motoru her sorunun maksimumunu `MAX_QUESTION_SCORE × weight` kabul eder.
 */
export const MAX_QUESTION_SCORE = 5;

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

export function buildSurveyQuestionWhere(surveyId: string) {
  return {
    OR: [
      { category: { surveyId } },
      { subCategory: { category: { surveyId } } },
      { subLevel: { subCategory: { category: { surveyId } } } }
    ]
  };
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
    const categoryDirectMaxScore = categoryQuestions.reduce((sum: number, q: any) => sum + (5 * q.weight), 0);
    catMaxScore += categoryDirectMaxScore;
    
    for (const subCat of category.subCategories) {
      let subCatMaxScore = 0;
      
      // Alt seviyeler varsa
      if (subCat.subLevels && subCat.subLevels.length > 0) {
        for (const subLevel of subCat.subLevels) {
          const levelMaxScore = subLevel.questions.reduce((sum, q) => sum + (5 * q.weight), 0);
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
        subCatMaxScore = questions.reduce((sum: number, q: any) => sum + (5 * q.weight), 0);
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
    const weight = question?.weight ?? 1;
    const score = (response?.score ?? 0) * weight;
    const maxScore = 5 * weight;

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

export async function getRecommendationsForUser(userId: string) {
  // Kullanıcının tüm anket cevaplarını getir
  const userResponses = await prisma.surveyResponse.findMany({
    where: { userId },
    select: {
      questionId: true,
      value: true
    }
  });
  
  // Eğer kullanıcının hiç anket cevabı yoksa, boş dizi döndür
  if (!userResponses || userResponses.length === 0) {
    return [];
  }
  
  const { categoryScores, subLevelScores, subCategoryScores } = await calculateUserScore(userId);
  const categoryPercentages = Object.fromEntries(
    Object.entries(categoryScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );
  
  // Cevapları questionId -> value map'ine dönüştür
  const userAnswerMap = new Map<string, string>();
  userResponses.forEach(response => {
    userAnswerMap.set(response.questionId, response.value.toLowerCase().trim());
  });

  // Puan yüzdelerini hazırla
  const subLevelPercentages = Object.fromEntries(
    Object.entries(subLevelScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );
  const subCategoryPercentages = Object.fromEntries(
    Object.entries(subCategoryScores).map(([id, data]) => [id, data?.percentage ?? 0])
  );

  // Tüm önerileri getir
  const recommendations = await prisma.recommendation.findMany({
    include: {
      question: {
        select: {
          id: true,
          text: true,
          type: true
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

  // Önerileri filtrele
  const filteredRecommendations = recommendations.filter(rec => {
    // 1. SORU-CEVAP BAZLI TETİKLEME (öncelikli)
    if (rec.questionId && rec.triggerOptions) {
      const userAnswer = userAnswerMap.get(rec.questionId);
      
      // Kullanıcı bu soruya cevap vermemişse öneriyi gösterme
      if (!userAnswer) return false;
      
      // triggerOptions JSON parse et
      let triggerOpts: string[] = [];
      try {
        triggerOpts = JSON.parse(rec.triggerOptions);
      } catch {
        return false;
      }
      
      // Kullanıcının cevabı tetikleyici şıklardan biriyse öneriyi göster
      const normalizedTriggerOpts = triggerOpts.map(opt => opt.toLowerCase().trim());
      return normalizedTriggerOpts.includes(userAnswer);
    }
    
    // 2. PUAN ARALIĞI BAZLI FİLTRELEME (soru seçilmediyse)
    // Alt seviye bazlı
    if (rec.subLevelId) {
      const userScore = subLevelPercentages[rec.subLevelId];
      if (userScore === undefined) return false;
      return userScore >= rec.minScoreThreshold && userScore <= rec.maxScoreThreshold;
    }
    
    // Alt kategori bazlı
    if (rec.subCategoryId) {
      const userScore = subCategoryPercentages[rec.subCategoryId];
      if (userScore === undefined) return false;
      return userScore >= rec.minScoreThreshold && userScore <= rec.maxScoreThreshold;
    }
    
    // Kategori bazlı
    if (rec.categoryId) {
      const userScore = categoryPercentages[rec.categoryId];
      if (userScore === undefined) return false;
      return userScore >= rec.minScoreThreshold && userScore <= rec.maxScoreThreshold;
    }

    // Genel öneri (her zaman göster)
    return true;
  });

  // Roadmap'teki önerileri bul
  const existingRoadmapItems = await prisma.roadmapItem.findMany({
    where: { userId },
    select: { recommendationId: true }
  });

  const existingIds = new Set(existingRoadmapItems?.map(item => item?.recommendationId) ?? []);

  return (filteredRecommendations ?? []).map(rec => ({
    ...rec,
    isInRoadmap: existingIds.has(rec?.id),
    subLevelName: rec.subLevel?.name,
    subCategoryName: rec.subLevel?.subCategory?.name ?? rec.subCategory?.name,
    categoryName: rec.subLevel?.subCategory?.category?.name ?? rec.subCategory?.category?.name,
    // Tetikleme bilgisi
    triggeredByQuestion: !!rec.questionId,
    triggerQuestionText: rec.question?.text
  }));
}
