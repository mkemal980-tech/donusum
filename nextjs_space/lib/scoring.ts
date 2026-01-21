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

export async function calculateUserScore(userId: string) {
  const responses = await prisma.surveyResponse.findMany({
    where: { userId },
    include: {
      question: {
        include: {
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

  if (responses?.length === 0) {
    return { totalScore: 0, totalScoreOn5: 1, categoryScores: {}, subLevelScores: {}, subCategoryScores: {} };
  }

  const categoryScores: Record<string, { score: number; maxScore: number; name: string }> = {};
  const subLevelScores: Record<string, { score: number; maxScore: number; name: string; categoryName: string }> = {};
  const subCategoryScores: Record<string, { score: number; maxScore: number; name: string; categoryName: string }> = {};
  let totalWeightedScore = 0;
  let totalMaxScore = 0;

  for (const response of responses ?? []) {
    const question = response?.question;
    const weight = question?.weight ?? 1;
    const score = (response?.score ?? 0) * weight;
    const maxScore = 5 * weight;

    let category = null;
    let subLevel = question?.subLevel;
    let subCategory = question?.subCategory;

    // Soru subLevel'e bağlıysa
    if (subLevel) {
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
        maxScore: 0,
        name: category?.name ?? 'Unknown'
      };
    }
    categoryScores[categoryId].score += score;
    categoryScores[categoryId].maxScore += maxScore;

    // Alt kategori bazlı puanlama
    if (subCategory) {
      const subCategoryId = subCategory.id;
      if (!subCategoryScores[subCategoryId]) {
        subCategoryScores[subCategoryId] = {
          score: 0,
          maxScore: 0,
          name: subCategory?.name ?? 'Unknown',
          categoryName: category?.name ?? 'Unknown'
        };
      }
      subCategoryScores[subCategoryId].score += score;
      subCategoryScores[subCategoryId].maxScore += maxScore;
    }

    // Alt seviye bazlı puanlama (sadece subLevel varsa)
    if (subLevel) {
      const subLevelId = subLevel.id;
      if (!subLevelScores[subLevelId]) {
        subLevelScores[subLevelId] = {
          score: 0,
          maxScore: 0,
          name: subLevel?.name ?? 'Unknown',
          categoryName: category?.name ?? 'Unknown'
        };
      }
      subLevelScores[subLevelId].score += score;
      subLevelScores[subLevelId].maxScore += maxScore;
    }

    totalWeightedScore += score;
    totalMaxScore += maxScore;
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
  const { categoryScores, subLevelScores, subCategoryScores } = await calculateUserScore(userId);
  
  // Kullanıcının tüm anket cevaplarını getir
  const userResponses = await prisma.surveyResponse.findMany({
    where: { userId },
    select: {
      questionId: true,
      value: true
    }
  });
  
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
