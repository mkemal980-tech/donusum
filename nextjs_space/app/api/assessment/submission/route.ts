export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateSurveyAccess, withAuth } from "@/lib/api-utils";
import { getAssessmentContext, getOrCreateAssessment } from "@/lib/assessment";
import { calculateProgressScores, calculateUserScore } from "@/lib/scoring";

/**
 * Değerlendirmenin gönderilmesi ve geri alınması.
 *
 * Gönderim, kuruluşun "bu bizim cevabımız" dediği andır: cevaplar ve görev
 * dağılımı kilitlenir, puanın o günkü hâli geçmişe yazılır ve taslak olmaktan
 * çıkar. Okuma tarafı kapanmaz — kilit "değerlendirme bitti" demektir,
 * "sistem kapandı" demek değil; öneriler ve yol haritası çalışmaya devam eder.
 *
 * Geri alma koordinatörde: bir yazım hatası için sistem yöneticisi beklemek
 * işi durdururdu. Geri alma geçmişi silmez — gönderim anındaki puan kaydı
 * (ScoreHistory, triggerType = SUBMISSION) yerinde kalır.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { surveyId, action } = body ?? {};

    if (!surveyId || (action !== "submit" && action !== "reopen")) {
      return NextResponse.json(
        { error: "surveyId ve action ('submit' | 'reopen') gerekli" },
        { status: 400 }
      );
    }

    const accessError = await validateSurveyAccess(auth.userId, auth.user.role, surveyId);
    if (accessError) return accessError;

    const context = await getAssessmentContext(auth.userId, surveyId);
    if (!context.isCoordinator) {
      return NextResponse.json(
        { error: "Değerlendirmeyi gönderme yetkiniz yok." },
        { status: 403 }
      );
    }

    if (action === "reopen") {
      if (!context.assessmentId || !context.locked) {
        return NextResponse.json(
          { error: "Bu değerlendirme zaten açık." },
          { status: 400 }
        );
      }

      const reopened = await prisma.assessment.update({
        where: { id: context.assessmentId },
        data: { status: "IN_PROGRESS", submittedAt: null, submittedById: null },
        select: { status: true, submittedAt: true },
      });

      return NextResponse.json({ success: true, ...reopened });
    }

    if (context.locked) {
      return NextResponse.json(
        { error: "Bu değerlendirme zaten gönderilmiş." },
        { status: 400 }
      );
    }

    const assessmentId = await getOrCreateAssessment(auth.userId, surveyId);

    /**
     * Puanın gönderim anındaki hâli geçmişe yazılır. Kilit sonradan geri
     * alınsa bile bu kayıt kalır: "o gün ne göndermiştik" sorusunun tek
     * güvenilir cevabı budur.
     */
    const [scores, baselineScores] = await Promise.all([
      calculateProgressScores(auth.userId, { surveyId }),
      calculateUserScore(auth.userId, surveyId),
    ]);

    const [submitted] = await prisma.$transaction([
      prisma.assessment.update({
        where: { id: assessmentId },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          submittedById: auth.userId,
        },
        select: { status: true, submittedAt: true },
      }),
      prisma.scoreHistory.create({
        data: {
          assessmentId,
          surveyId,
          overallScore: scores.overallScore,
          overallPercentage: scores.overallPercentage,
          velocityScore: scores.velocityScore,
          enduranceScore: scores.enduranceScore,
          quadrant: scores.quadrant,
          completedQuestions: scores.completedQuestions,
          totalQuestions: scores.totalQuestions,
          completedRecommendations: scores.completedRecommendations,
          categoryScores: baselineScores.categoryScores,
          triggerType: "SUBMISSION",
        },
      }),
    ]);

    return NextResponse.json({ success: true, ...submitted });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    return NextResponse.json({ error: "Gönderim tamamlanamadı" }, { status: 500 });
  }
}
