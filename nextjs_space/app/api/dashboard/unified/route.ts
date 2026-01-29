export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

/**
 * Unified Dashboard API - Tüm dashboard verilerini tek seferde döndürür
 * Bu sayede multiple API calls yerine tek request ile tüm data gelir
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    // Get user ID from email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    // PARALEL FETCH - Tüm veriler aynı anda çekilir
    const [
      userProfile,
      userResponses,
      surveyStructure,
      recommendations,
      categoryScores
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
          question: {
            OR: [
              { subLevel: { subCategory: { category: { surveyId } } } },
              { subCategory: { category: { surveyId } } },
              { category: { surveyId } }
            ]
          }
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
      fetchCategoryScores(userId, surveyId)
    ]);

    // Survey score calculation
    const totalScore = userResponses.reduce((sum, r) => sum + (r.score || 0), 0);
    const maxPossibleScore = userResponses.length * 5;
    const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    // Question counts
    let totalQuestions = 0;
    const answeredQuestionIds = new Set(userResponses.map(r => r.questionId));
    
    const categoryStats = surveyStructure.map(cat => {
      let catTotalQuestions = 0;
      let catAnsweredQuestions = 0;

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
        totalScore: Math.round(scorePercentage),
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
    // Kullanıcının cevapları
    const responses = await prisma.surveyResponse.findMany({
      where: {
        userId,
        question: {
          OR: [
            { subLevel: { subCategory: { category: { surveyId } } } },
            { subCategory: { category: { surveyId } } },
            { category: { surveyId } }
          ]
        }
      },
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
            },
            category: true
          }
        }
      }
    });

    if (responses.length === 0) {
      return {
        overallScore: 1,
        overallPercentage: 0,
        categories: [],
        subCategories: [],
        subLevels: []
      };
    }

    // Basit aggregate score
    const totalScore = responses.reduce((sum, r) => sum + (r.score || 0), 0);
    const maxScore = responses.length * 5;
    const overallPercentage = (totalScore / maxScore) * 100;
    const overallScore = (overallPercentage / 100) * 4 + 1;

    // Kategori bazlı skorlar
    const categoryMap = new Map<string, { total: number; max: number; name: string }>();
    
    responses.forEach(resp => {
      const category = resp.question.subLevel?.subCategory.category || resp.question.subCategory?.category;
      if (category) {
        if (!categoryMap.has(category.id)) {
          categoryMap.set(category.id, { total: 0, max: 0, name: category.name });
        }
        const cat = categoryMap.get(category.id)!;
        cat.total += resp.score || 0;
        cat.max += 5;
      }
    });

    const categories = Array.from(categoryMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      score: (data.total / data.max) * 4 + 1,
      percentage: (data.total / data.max) * 100
    }));

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      overallPercentage: Math.round(overallPercentage),
      categories,
      subCategories: [],
      subLevels: []
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
