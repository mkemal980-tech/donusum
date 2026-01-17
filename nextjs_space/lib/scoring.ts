import { prisma } from "./db";

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
    return { totalScore: 0, categoryScores: {}, subLevelScores: {}, subCategoryScores: {} };
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

  const normalizedCategoryScores: Record<string, { score: number; percentage: number; name: string }> = {};
  const normalizedSubLevelScores: Record<string, { score: number; percentage: number; name: string; categoryName: string }> = {};
  const normalizedSubCategoryScores: Record<string, { score: number; percentage: number; name: string; categoryName: string }> = {};
  
  for (const [catId, data] of Object.entries(categoryScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    normalizedCategoryScores[catId] = {
      score: Math.round(data?.score ?? 0),
      percentage,
      name: data?.name ?? 'Unknown'
    };
  }

  for (const [subLevelId, data] of Object.entries(subLevelScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    normalizedSubLevelScores[subLevelId] = {
      score: Math.round(data?.score ?? 0),
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  for (const [subCatId, data] of Object.entries(subCategoryScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    normalizedSubCategoryScores[subCatId] = {
      score: Math.round(data?.score ?? 0),
      percentage,
      name: data?.name ?? 'Unknown',
      categoryName: data?.categoryName ?? 'Unknown'
    };
  }

  const totalPercentage = totalMaxScore > 0 ? Math.round((totalWeightedScore / totalMaxScore) * 100) : 0;

  return {
    totalScore: totalPercentage,
    categoryScores: normalizedCategoryScores,
    subLevelScores: normalizedSubLevelScores,
    subCategoryScores: normalizedSubCategoryScores
  };
}

export async function getRecommendationsForUser(userId: string) {
  const { categoryScores, subLevelScores, subCategoryScores } = await calculateUserScore(userId);
  
  // Düşük puanlı alt seviyeleri bul (%70 altı)
  const lowScoringSubLevels = Object.entries(subLevelScores)
    .filter(([_, data]) => (data?.percentage ?? 0) < 70)
    .map(([subLevelId, data]) => ({ subLevelId, percentage: data.percentage }));

  // Düşük puanlı alt kategorileri de bul (%70 altı)
  const lowScoringSubCategories = Object.entries(subCategoryScores)
    .filter(([_, data]) => (data?.percentage ?? 0) < 70)
    .map(([subCatId, data]) => ({ subCatId, percentage: data.percentage }));

  // Düşük puanlı kategorileri bul
  const lowScoringCategories = Object.entries(categoryScores)
    .filter(([_, data]) => (data?.percentage ?? 0) < 70)
    .map(([catId]) => catId);

  const subLevelIds = lowScoringSubLevels.map(s => s.subLevelId);
  const subLevelPercentages = Object.fromEntries(
    lowScoringSubLevels.map(s => [s.subLevelId, s.percentage])
  );

  // Önerileri getir - öncelik: SubLevel > Category > Genel
  const recommendations = await prisma.recommendation.findMany({
    where: {
      OR: [
        { subLevelId: { in: subLevelIds } },
        { subLevelId: null, categoryId: { in: lowScoringCategories } },
        { subLevelId: null, categoryId: null }
      ]
    },
    include: {
      subLevel: {
        include: {
          subCategory: {
            include: { category: true }
          }
        }
      }
    },
    orderBy: [
      { strategicType: 'asc' },
      { estimatedImpact: 'desc' }
    ]
  });

  // Puan eşiği filtreleme
  const filteredRecommendations = recommendations.filter(rec => {
    if (rec.subLevelId && subLevelPercentages[rec.subLevelId] !== undefined) {
      const userScore = subLevelPercentages[rec.subLevelId];
      return userScore >= rec.minScoreThreshold && userScore <= rec.maxScoreThreshold;
    }
    return true;
  });

  const existingRoadmapItems = await prisma.roadmapItem.findMany({
    where: { userId },
    select: { recommendationId: true }
  });

  const existingIds = new Set(existingRoadmapItems?.map(item => item?.recommendationId) ?? []);

  return (filteredRecommendations ?? []).map(rec => ({
    ...rec,
    isInRoadmap: existingIds.has(rec?.id),
    subLevelName: rec.subLevel?.name,
    subCategoryName: rec.subLevel?.subCategory?.name,
    categoryName: rec.subLevel?.subCategory?.category?.name
  }));
}
