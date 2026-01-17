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
          }
        }
      }
    }
  });

  if (responses?.length === 0) {
    return { totalScore: 0, categoryScores: {} };
  }

  const categoryScores: Record<string, { score: number; maxScore: number; name: string }> = {};
  let totalWeightedScore = 0;
  let totalMaxScore = 0;

  for (const response of responses ?? []) {
    const category = response?.question?.subLevel?.subCategory?.category;
    if (!category) continue;

    const categoryId = category.id;
    const weight = response?.question?.weight ?? 1;
    const score = (response?.score ?? 0) * weight;
    const maxScore = 5 * weight;

    if (!categoryScores[categoryId]) {
      categoryScores[categoryId] = {
        score: 0,
        maxScore: 0,
        name: category?.name ?? 'Unknown'
      };
    }

    categoryScores[categoryId].score += score;
    categoryScores[categoryId].maxScore += maxScore;
    totalWeightedScore += score;
    totalMaxScore += maxScore;
  }

  const normalizedCategoryScores: Record<string, { score: number; percentage: number; name: string }> = {};
  
  for (const [catId, data] of Object.entries(categoryScores)) {
    const percentage = data?.maxScore > 0 ? Math.round((data.score / data.maxScore) * 100) : 0;
    normalizedCategoryScores[catId] = {
      score: Math.round(data?.score ?? 0),
      percentage,
      name: data?.name ?? 'Unknown'
    };
  }

  const totalPercentage = totalMaxScore > 0 ? Math.round((totalWeightedScore / totalMaxScore) * 100) : 0;

  return {
    totalScore: totalPercentage,
    categoryScores: normalizedCategoryScores
  };
}

export async function getRecommendationsForUser(userId: string) {
  const { categoryScores } = await calculateUserScore(userId);
  
  const lowScoringCategories = Object.entries(categoryScores)
    .filter(([_, data]) => (data?.percentage ?? 0) < 70)
    .map(([catId]) => catId);

  const recommendations = await prisma.recommendation.findMany({
    where: {
      OR: [
        { categoryId: { in: lowScoringCategories } },
        { categoryId: null }
      ]
    },
    orderBy: [
      { strategicType: 'asc' },
      { estimatedImpact: 'desc' }
    ]
  });

  const existingRoadmapItems = await prisma.roadmapItem.findMany({
    where: { userId },
    select: { recommendationId: true }
  });

  const existingIds = new Set(existingRoadmapItems?.map(item => item?.recommendationId) ?? []);

  return (recommendations ?? []).map(rec => ({
    ...rec,
    isInRoadmap: existingIds.has(rec?.id)
  }));
}