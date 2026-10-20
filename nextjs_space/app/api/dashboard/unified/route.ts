export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import {
  breakdownPercentage,
  buildSurveyQuestionWhere,
  calculateProgressBreakdown,
  calculateUserScore,
  getRecommendationsForUser
} from "@/lib/scoring";
import { getAssessmentContext, getAssessmentIds } from "@/lib/assessment";
import { countStructureQuestions, loadVisibleSurveyStructure } from "@/lib/survey-structure";

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

    /**
     * Erişim kontrolü.
     *
     * Bu rota `surveyId`'yi doğrudan sorguya koyuyor ve hiç doğrulamıyordu:
     * herhangi bir oturum sahibi, başka bir kiracıya ait özel anketin
     * kategori/bölüm adlarını ve açıklamalarını okuyabiliyordu.
     */
    const surveyStructure = await loadVisibleSurveyStructure(userId, auth.user.role, surveyId);
    if (surveyStructure === null) {
      return NextResponse.json({ error: "Bu ankete erişiminiz yok" }, { status: 403 });
    }

    /**
     * Ekrandaki her puan ilerleme motorundan gelir (docs/GELISIM-PUANI.md):
     * birim panosu ve yol haritasıyla aynı "mevcut puan". Eski hesap yalnızca
     * hangi önerilerin gösterileceğini belirler; eşikleri o ölçekte tanımlı.
     */
    const [scoreData, progress] = await Promise.all([
      calculateUserScore(userId, surveyId),
      calculateProgressBreakdown(userId, { surveyId }),
    ]);

    const [
      userProfile,
      userResponses,
      recommendations
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
          assessmentId: { in: await getAssessmentIds(userId, [surveyId]) },
          question: buildSurveyQuestionWhere(surveyId)
        },
        select: {
          id: true,
          questionId: true,
          value: true,
          score: true
        }
      }),

      /**
       * 4. Öneriler — ankette tanımlı olanlar değil, kullanıcıya gösterilenler.
       *
       * Kategori kartlarındaki öneri sayısı buradan çıkıyor. Tanımlı sayıyı
       * göstermek, kullanıcıyı Öneriler ekranında bulamayacağı önerileri
       * aramaya iter (bkz. /api/dashboard/kpi'deki aynı düzeltme).
       */
      getRecommendationsForUser(userId, { surveyId, scores: scoreData }),

    ]);

    const categoryScores = toCategoryScores(progress);

    // Soru sayımı görünür yapıdan gelir: arşivlenmiş ve kapsam dışı sorular
    // toplamda görünmez, böylece tamamlanma yüzdesi %100'e ulaşabilir.
    const answeredQuestionIds = new Set(userResponses.map(r => r.questionId));
    const perCategory = countStructureQuestions(surveyStructure);
    const visibleQuestionIds = new Set(perCategory.flatMap((c) => c.questionIds));
    const totalQuestions = visibleQuestionIds.size;
    const answeredVisible = [...visibleQuestionIds].filter((id) => answeredQuestionIds.has(id)).length;

    const categoryStats = perCategory.map(cat => {
      const catTotalQuestions = cat.questionIds.length;
      const catAnsweredQuestions = cat.questionIds.filter(id => answeredQuestionIds.has(id)).length;

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

    // Payda ile pay aynı kümeden: görünür sorular. Eskiden pay bütün
    // cevaplardı, payda ise filtresiz soru sayısıydı.
    const completionPercentage = totalQuestions > 0
      ? Math.round((answeredVisible / totalQuestions) * 100)
      : 0;

    // Response hazırla
    /**
     * Puanın taslak mı kesin mi olduğu. Gönderilmemiş bir puana bakıp karar
     * vermek yanıltıcı: ertesi gün değişebilir.
     */
    const assessment = await getAssessmentContext(userId, surveyId);

    return NextResponse.json({
      userProfile,
      assessment: {
        status: assessment.status,
        submittedAt: assessment.submittedAt,
        locked: assessment.locked,
        isCoordinator: assessment.isCoordinator,
      },
      score: {
        totalScore: progress.scores.overallPercentage,
        baselinePercentage: progress.scores.baselineOverallPercentage,
        deltaPercentage: progress.scores.deltaPercentage,
        answeredQuestions: answeredVisible,
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

/**
 * Kırılımı ekranın beklediği şekle çevirir — yeni sorgu yapmaz. Sektör
 * kapsamında sorusu olmayan kategori listelenmez; cevapsız kategori %0'dır.
 */
function toCategoryScores({ scores, categories }: Awaited<ReturnType<typeof calculateProgressBreakdown>>) {
  const view = (node: { id: string; name: string; totalScore: number; responseCount: number }) => ({
    id: node.id,
    name: node.name,
    score: node.responseCount ? Math.round(node.totalScore * 10) / 10 : 1,
    percentage: node.responseCount ? Math.round(breakdownPercentage(node.totalScore)) : 0
  });
  const scoped = categories.filter(category => category.questionCount > 0);
  return {
    overallScore: scores.overallScore,
    overallPercentage: scores.overallPercentage,
    categories: scoped.map(view),
    subCategories: scoped.flatMap(category => category.subCategories
      .filter(section => section.questionCount > 0)
      .map(section => ({ ...view(section), categoryName: category.name })))
  };
}
