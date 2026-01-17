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

    // Get all categories with their structure
    const categories = await prisma.category.findMany({
      include: {
        subCategories: {
          include: {
            subLevels: {
              include: {
                questions: true
              }
            }
          },
          orderBy: { order: "asc" }
        }
      },
      orderBy: { order: "asc" }
    });

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
            }
          }
        }
      }
    });

    // Create response map
    const responseMap = new Map<string, { score: number; weight: number }>();
    for (const r of responses) {
      responseMap.set(r.questionId, { score: r.score, weight: r.question.weight });
    }

    // Calculate scores for each level
    const categoryScores = categories.map(category => {
      let catWeightedScore = 0;
      let catMaxScore = 0;

      const subCategoryScores = category.subCategories.map(subCat => {
        let subCatWeightedScore = 0;
        let subCatMaxScore = 0;

        const subLevelScores = subCat.subLevels.map(subLevel => {
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
          const levelScore = (levelPercentage / 100) * 5; // Convert to 1-5 scale

          return {
            id: subLevel.id,
            name: subLevel.name,
            score: Math.round(levelScore * 10) / 10,
            percentage: Math.round(levelPercentage),
            questionCount: subLevel.questions.length,
            answeredCount: subLevel.questions.filter(q => responseMap.has(q.id)).length
          };
        });

        catWeightedScore += subCatWeightedScore;
        catMaxScore += subCatMaxScore;

        const subCatPercentage = subCatMaxScore > 0 ? (subCatWeightedScore / subCatMaxScore) * 100 : 0;
        const subCatScore = (subCatPercentage / 100) * 5; // Convert to 1-5 scale

        return {
          id: subCat.id,
          name: subCat.name,
          score: Math.round(subCatScore * 10) / 10,
          percentage: Math.round(subCatPercentage),
          target: 5, // Default target is maximum
          subLevels: subLevelScores
        };
      });

      const catPercentage = catMaxScore > 0 ? (catWeightedScore / catMaxScore) * 100 : 0;
      const catScore = (catPercentage / 100) * 5; // Convert to 1-5 scale

      return {
        id: category.id,
        name: category.name,
        description: category.description,
        score: Math.round(catScore * 10) / 10,
        percentage: Math.round(catPercentage),
        subCategories: subCategoryScores
      };
    });

    // Calculate overall score
    const totalWeighted = categoryScores.reduce((sum, c) => sum + c.percentage, 0);
    const overallPercentage = categoryScores.length > 0 ? totalWeighted / categoryScores.length : 0;
    const overallScore = (overallPercentage / 100) * 5;

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
      categories: categoryScores
    });
  } catch (error) {
    console.error("Error fetching category scores:", error);
    return NextResponse.json({ error: "Puanlar alınırken hata oluştu" }, { status: 500 });
  }
}
