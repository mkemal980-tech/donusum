import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Test user ID for development
const TEST_USER_ID = "cmkhjzaa70000x50t7n7fsjxo";

export async function GET(request: NextRequest) {
  try {
    const userId = TEST_USER_ID;
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const surveyId = searchParams.get("surveyId");

    // Get user to find their sector
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sectorId: true }
    });

    // Get all categories with their structure (optionally filtered by surveyId)
    const categories = await prisma.category.findMany({
      where: surveyId ? { surveyId } : undefined,
      include: {
        subCategories: {
          include: {
            subLevels: {
              include: {
                questions: true
              }
            },
            questions: true // For subcategories without sublevels
          },
          orderBy: { order: "asc" }
        },
        survey: {
          select: { id: true, name: true }
        }
      },
      orderBy: { order: "asc" }
    });

    // Determine surveyId from categories if not provided
    const effectiveSurveyId = surveyId || (categories.length > 0 ? categories[0].surveyId : null);

    // Get sector category weights if user has a sector and surveyId is available
    let sectorWeights = new Map<string, number>();
    if (user?.sectorId && effectiveSurveyId) {
      const weights = await prisma.sectorCategoryWeight.findMany({
        where: { 
          sectorId: user.sectorId,
          surveyId: effectiveSurveyId
        }
      });
      weights.forEach(w => sectorWeights.set(w.categoryId, w.weight));
    }

    // Get user responses
    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            subLevel: {
              include: {
                subCategory: true
              }
            },
            subCategory: true // For questions directly under subcategory
          }
        }
      }
    });

    // Create response map
    const responseMap = new Map<string, { score: number; weight: number }>();
    for (const r of responses) {
      responseMap.set(r.questionId, { score: r.score, weight: r.question.weight });
    }

    // Calculate default equal weight if no sector weights defined
    const defaultWeight = categories.length > 0 ? 1 / categories.length : 0;

    // Calculate scores for each level
    const categoryScores = categories.map(category => {
      let catWeightedScore = 0;
      let catMaxScore = 0;

      const subCategoryScores = category.subCategories.map(subCat => {
        let subCatWeightedScore = 0;
        let subCatMaxScore = 0;

        // Check if this subcategory has sublevels
        const hasSubLevels = subCat.subLevels && subCat.subLevels.length > 0;

        let subLevelScores: any[] = [];

        if (hasSubLevels) {
          // Process sublevels
          subLevelScores = subCat.subLevels.map(subLevel => {
            let levelWeightedScore = 0;
            let levelMaxScore = 0;

            for (const question of subLevel.questions) {
              const response = responseMap.get(question.id);
              const weight = question.weight;
              if (response) {
                levelWeightedScore += response.score * weight;
              }
              levelMaxScore += 5 * weight;
            }

            subCatWeightedScore += levelWeightedScore;
            subCatMaxScore += levelMaxScore;

            const levelPercentage = levelMaxScore > 0 ? (levelWeightedScore / levelMaxScore) * 100 : 0;
            const levelScore = (levelPercentage / 100) * 5;

            return {
              id: subLevel.id,
              name: subLevel.name,
              score: Math.round(levelScore * 10) / 10,
              percentage: Math.round(levelPercentage),
              questionCount: subLevel.questions.length,
              answeredCount: subLevel.questions.filter(q => responseMap.has(q.id)).length
            };
          });
        } else {
          // Process questions directly under subcategory
          const directQuestions = (subCat as any).questions || [];
          for (const question of directQuestions) {
            const response = responseMap.get(question.id);
            const weight = question.weight;
            if (response) {
              subCatWeightedScore += response.score * weight;
            }
            subCatMaxScore += 5 * weight;
          }
        }

        catWeightedScore += subCatWeightedScore;
        catMaxScore += subCatMaxScore;

        const subCatPercentage = subCatMaxScore > 0 ? (subCatWeightedScore / subCatMaxScore) * 100 : 0;
        const subCatScore = (subCatPercentage / 100) * 5;

        const totalQuestions = hasSubLevels 
          ? subCat.subLevels.reduce((sum, sl) => sum + sl.questions.length, 0)
          : ((subCat as any).questions?.length || 0);
        const answeredQuestions = hasSubLevels
          ? subCat.subLevels.reduce((sum, sl) => sum + sl.questions.filter(q => responseMap.has(q.id)).length, 0)
          : ((subCat as any).questions?.filter((q: any) => responseMap.has(q.id))?.length || 0);

        return {
          id: subCat.id,
          name: subCat.name,
          score: Math.round(subCatScore * 10) / 10,
          percentage: Math.round(subCatPercentage),
          target: 5,
          hasSubLevels,
          subLevels: subLevelScores,
          questionCount: totalQuestions,
          answeredCount: answeredQuestions
        };
      });

      const catPercentage = catMaxScore > 0 ? (catWeightedScore / catMaxScore) * 100 : 0;
      const catScore = (catPercentage / 100) * 5;

      // Get category weight (sector-specific or default equal weight)
      const categoryWeight = sectorWeights.size > 0 
        ? (sectorWeights.get(category.id) ?? 0)
        : defaultWeight;

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        surveyId: category.surveyId,
        surveyName: category.survey?.name,
        score: Math.round(catScore * 10) / 10,
        percentage: Math.round(catPercentage),
        weight: categoryWeight,
        subCategories: subCategoryScores
      };
    });

    // Calculate overall score using weights
    let overallScore = 0;
    let totalWeight = 0;

    for (const cat of categoryScores) {
      overallScore += cat.score * cat.weight;
      totalWeight += cat.weight;
    }

    // Normalize if weights don't sum to 1 (fallback)
    if (totalWeight > 0 && Math.abs(totalWeight - 1) > 0.01) {
      overallScore = overallScore / totalWeight;
    }

    const overallPercentage = (overallScore / 5) * 100;

    // If specific category requested, return details
    if (categoryId) {
      const category = categoryScores.find(c => c.id === categoryId);
      if (!category) {
        return NextResponse.json({ error: "Kategori bulunamadı" }, { status: 404 });
      }
      return NextResponse.json({
        category,
        overallScore: Math.round(overallScore * 10) / 10
      });
    }

    return NextResponse.json({
      overallScore: Math.round(overallScore * 10) / 10,
      overallPercentage: Math.round(overallPercentage),
      surveyId: effectiveSurveyId,
      categories: categoryScores
    });
  } catch (error) {
    console.error("Error fetching category scores:", error);
    return NextResponse.json({ error: "Puanlar alınırken hata oluştu" }, { status: 500 });
  }
}
