export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { buildSurveyQuestionWhere, calculateUserScore } from "@/lib/scoring";

/**
 * Unified Dashboard API - Tüm dashboard verilerini tek seferde döndürür
 * Bu sayede multiple API calls yerine tek request ile tüm data gelir
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    // PARALEL FETCH - Tüm veriler aynı anda çekilir
    const [
      userProfile,
      userResponses,
      surveyStructure,
      recommendations,
      categoryScores,
      scoreData
    ] = await Promise.all([
      // 1. User Profile
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organization: true,
          sector: {
            select: {
              id: true,
              name: true,
              naicsCode: true
            }
          },
          subSector: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),

      // 2. User Responses
      prisma.surveyResponse.findMany({
        where: {
          userId,
          question: buildSurveyQuestionWhere(surveyId)
        },
        select: {
          id: true,
          questionId: true,
          value: true,
          score: true
        }
      }),

      // 3. Survey Structure
      prisma.category.findMany({
        where: { surveyId },
        orderBy: { order: 'asc' },
        include: {
          questions: {
            orderBy: { order: 'asc' },
            select: { id: true }
          },
          subCategories: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                select: { id: true }
              },
              subLevels: {
                orderBy: { order: 'asc' },
                include: {
                  questions: {
                    orderBy: { order: 'asc' },
                    select: { id: true }
                  }
                }
              }
            }
          }
        }
      }),

      // 4. Recommendations - 3 yol ile bağlı önerileri çek
      (async () => {
        // First get all categories for this survey
        const surveyCategories = await prisma.category.findMany({
          where: { surveyId },
          select: { id: true }
        });
        const categoryIds = surveyCategories.map(c => c.id);

        return prisma.recommendation.findMany({
          where: {
            OR: [
              { categoryId: { in: categoryIds } },
              { subCategory: { categoryId: { in: categoryIds } } },
              { subLevel: { subCategory: { categoryId: { in: categoryIds } } } }
            ]
          },
          select: {
            id: true,
            title: true,
            description: true,
            categoryId: true,
            subCategoryId: true,
            subLevelId: true,
            strategicType: true,
            videoUrl: true,
            minScoreThreshold: true,
            maxScoreThreshold: true,
            subCategory: {
              select: { categoryId: true }
            },
            subLevel: {
              select: { subCategory: { select: { categoryId: true } } }
            }
          }
        });
      })(),

      // 5. Category Scores - Bu hesaplama zaten var, kullanıyoruz
      fetchCategoryScores(userId, surveyId),

      // 6. Authoritative score calculation
      calculateUserScore(userId, surveyId)
    ]);

    // Question counts
    let totalQuestions = 0;
    const answeredQuestionIds = new Set(userResponses.map(r => r.questionId));
    
    const categoryStats = surveyStructure.map(cat => {
      let catTotalQuestions = cat.questions.length;
      let catAnsweredQuestions = cat.questions.filter(q => answeredQuestionIds.has(q.id)).length;

      cat.subCategories.forEach(sub => {
        if (!sub.hasSubLevels) {
          catTotalQuestions += sub.questions.length;
          sub.questions.forEach(q => {
            if (answeredQuestionIds.has(q.id)) catAnsweredQuestions++;
          });
        } else {
          sub.subLevels.forEach(level => {
            catTotalQuestions += level.questions.length;
            level.questions.forEach(q => {
              if (answeredQuestionIds.has(q.id)) catAnsweredQuestions++;
            });
          });
        }
      });

      totalQuestions += catTotalQuestions;

      // Öneri sayısını 3 yol ile hesapla (categoryId, subCategoryId, subLevelId)
      const catRecommendationCount = recommendations.filter((rec: any) => {
        // Direkt categoryId ile bağlı
        if (rec.categoryId === cat.id) return true;
        // subCategory üzerinden bağlı
        if (rec.subCategory?.categoryId === cat.id) return true;
        // subLevel üzerinden bağlı
        if (rec.subLevel?.subCategory?.categoryId === cat.id) return true;
        return false;
      }).length;

      return {
        id: cat.id,
        name: cat.name,
        answeredQuestions: catAnsweredQuestions,
        totalQuestions: catTotalQuestions,
        recommendationCount: catRecommendationCount
      };
    });

    const completionPercentage = totalQuestions > 0
      ? Math.round((userResponses.length / totalQuestions) * 100)
      : 0;

    // Response hazırla
    return NextResponse.json({
      userProfile,
      score: {
        totalScore: scoreData.totalScore,
        answeredQuestions: userResponses.length,
        totalQuestions,
        completionPercentage
      },
      responses: userResponses,
      structure: surveyStructure,
      recommendations,
      categoryStats,
      categoryScores
    });

  } catch (error) {
    console.error("Dashboard unified API error:", error);
    return NextResponse.json(
      { error: "Dashboard verileri yüklenemedi" },
      { status: 500 }
    );
  }
}

// Category scores hesaplama fonksiyonu
async function fetchCategoryScores(userId: string, surveyId: string) {
  try {
    const scoreData = await calculateUserScore(userId, surveyId);
    const categories = Object.entries(scoreData.categoryScores).map(([id, data]) => ({
      id,
      name: data.name,
      score: data.scoreOn5,
      percentage: data.percentage
    }));

    return {
      overallScore: scoreData.totalScoreOn5,
      overallPercentage: scoreData.totalScore,
      categories,
      subCategories: Object.entries(scoreData.subCategoryScores).map(([id, data]) => ({ id, ...data })),
      subLevels: Object.entries(scoreData.subLevelScores).map(([id, data]) => ({ id, ...data }))
    };
  } catch (error) {
    console.error("Category scores error:", error);
    return {
      overallScore: 1,
      overallPercentage: 0,
      categories: [],
      subCategories: [],
      subLevels: []
    };
  }
}
