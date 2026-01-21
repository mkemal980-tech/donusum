export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

const TEST_USER_ID = "cmkhjzaa70000x50t7n7fsjxo";

async function getUserId() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return (session.user as any)?.id || TEST_USER_ID;
    }
  } catch (e) {}
  return TEST_USER_ID;
}

// Durum bazlı çarpan
function getStatusMultiplier(status: string): number {
  switch (status) {
    case 'COMPLETED':
      return 1.0;  // %100
    case 'IN_PROGRESS':
      return 0.5;  // %50
    default:
      return 0;    // %0
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // 1. Anket skorlarını hesapla (Baz Skor - Sarı)
    const surveyResponses = await prisma.surveyResponse.findMany({
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

    // 2. Kullanıcının roadmap öğelerini al (öneri durumları)
    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { userId },
      include: {
        recommendation: {
          include: {
            subCategory: {
              include: { category: true }
            },
            subLevel: {
              include: {
                subCategory: {
                  include: { category: true }
                }
              }
            }
          }
        }
      }
    });

    // 3. Kategorileri al
    const categories = await prisma.category.findMany({
      where: surveyId ? { surveyId } : undefined,
      include: {
        subCategories: {
          include: {
            subLevels: true
          }
        }
      }
    });

    // Alt kategori bazlı skorları hesapla
    const subCategoryScores: Record<string, {
      surveyScore: number;      // Sarı - Baz skor
      progressScore: number;    // Mavi - Gelişim skoru
      delta: number;            // Fark
      name: string;
      categoryId: string;
      categoryName: string;
    }> = {};

    // Kategori bazlı skorları hesapla
    const categoryScores: Record<string, {
      surveyScore: number;
      progressScore: number;
      delta: number;
      name: string;
    }> = {};

    // Her kategori için hesapla
    for (const category of categories) {
      let categoryTotalSurveyScore = 0;
      let categoryTotalProgressScore = 0;
      let subCategoryCount = 0;

      for (const subCategory of category.subCategories) {
        // Alt kategori için anket skorunu hesapla
        const subCatResponses = surveyResponses.filter(r => {
          if (r.question.subCategoryId === subCategory.id) return true;
          if (r.question.subLevel?.subCategoryId === subCategory.id) return true;
          return false;
        });

        // Ağırlıklı ortalama
        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const response of subCatResponses) {
          const weight = response.question.weight || 1;
          const score = response.score || 0;
          totalWeightedScore += score * weight;
          totalWeight += weight;
        }

        // Baz skor (1-5 ölçeğine normalize et)
        const surveyScore = totalWeight > 0 
          ? Math.min(5, Math.max(0, totalWeightedScore / totalWeight))
          : 0;

        // Öneri katkılarını hesapla
        let recommendationBonus = 0;
        const relatedRoadmapItems = roadmapItems.filter(item => {
          const rec = item.recommendation;
          if (rec.subCategoryId === subCategory.id) return true;
          if (rec.subLevel?.subCategoryId === subCategory.id) return true;
          return false;
        });

        for (const item of relatedRoadmapItems) {
          const multiplier = getStatusMultiplier(item.status);
          const points = item.recommendation.points || 0;
          recommendationBonus += points * multiplier;
        }

        // Gelişim skoru (max 5)
        const progressScore = Math.min(5, surveyScore + recommendationBonus);
        const delta = progressScore - surveyScore;

        subCategoryScores[subCategory.id] = {
          surveyScore: Math.round(surveyScore * 100) / 100,
          progressScore: Math.round(progressScore * 100) / 100,
          delta: Math.round(delta * 100) / 100,
          name: subCategory.name,
          categoryId: category.id,
          categoryName: category.name
        };

        categoryTotalSurveyScore += surveyScore;
        categoryTotalProgressScore += progressScore;
        subCategoryCount++;
      }

      // Kategori ortalaması
      const avgSurveyScore = subCategoryCount > 0 ? categoryTotalSurveyScore / subCategoryCount : 0;
      const avgProgressScore = subCategoryCount > 0 ? categoryTotalProgressScore / subCategoryCount : 0;

      categoryScores[category.id] = {
        surveyScore: Math.round(avgSurveyScore * 100) / 100,
        progressScore: Math.round(avgProgressScore * 100) / 100,
        delta: Math.round((avgProgressScore - avgSurveyScore) * 100) / 100,
        name: category.name
      };
    }

    // Toplam skor
    const categoryIds = Object.keys(categoryScores);
    const totalSurveyScore = categoryIds.length > 0
      ? categoryIds.reduce((sum, id) => sum + categoryScores[id].surveyScore, 0) / categoryIds.length
      : 0;
    const totalProgressScore = categoryIds.length > 0
      ? categoryIds.reduce((sum, id) => sum + categoryScores[id].progressScore, 0) / categoryIds.length
      : 0;

    return NextResponse.json({
      overall: {
        surveyScore: Math.round(totalSurveyScore * 100) / 100,
        progressScore: Math.round(totalProgressScore * 100) / 100,
        delta: Math.round((totalProgressScore - totalSurveyScore) * 100) / 100
      },
      categories: categoryScores,
      subCategories: subCategoryScores
    });

  } catch (error) {
    console.error("Error calculating progress scores:", error);
    return NextResponse.json(
      { error: "Failed to calculate progress scores" },
      { status: 500 }
    );
  }
}
