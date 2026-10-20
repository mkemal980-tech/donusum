import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { getAssessmentIds } from '@/lib/assessment';
import {
  buildSurveyQuestionWhere, calculateProgressBreakdown, getAccessibleSurveyIds,
  getRecommendationsForUser, getScoringProfile,
} from '@/lib/scoring';
import { QUADRANT_LABELS } from '@/lib/unit-management-display';

export const dynamic = 'force-dynamic';

const round1 = (value: number) => Math.round(value * 10) / 10;

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId') ?? undefined;
    const surveyIds = surveyId ? [surveyId] : await getAccessibleSurveyIds(userId);

    /**
     * Sayılar ilerleme motorundan gelir (docs/GELISIM-PUANI.md).
     *
     * Hız ve dayanıklılık eskiden ham cevap puanlarının ağırlıklı ortalamasıydı:
     * sorunun tavanı, sektör kapsamı ve cevapsız sorular hesaba girmiyor, aynı
     * sayfadaki Ironman analizi (motor) başka sayı gösteriyordu. Soru sayısı da
     * arşivlenmiş ve kapsam dışı soruları içeriyor, kategori ilerlemesi %100'e
     * ulaşamıyordu. Kıyas, soruları puanlayan profille aynı sektörden yapılır.
     */
    const [user, profile, progress, activity, recommendations] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true, organization: true } }),
      getScoringProfile(userId),
      calculateProgressBreakdown(userId, { surveyId }),
      prisma.surveyResponse.findMany({
        where: { assessmentId: { in: await getAssessmentIds(userId, surveyIds) }, question: buildSurveyQuestionWhere(surveyIds) },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      /**
       * Öneriler: ankette TANIMLI olanlar değil, kullanıcıya GÖSTERİLENLER.
       *
       * Kart "Toplam Öneri" diyor ve kullanıcının kendi panosunda duruyor;
       * tıklayınca gideceği Öneriler ekranıyla aynı sayıyı vermeli. Ankette
       * tanımlı 76 öneriden cevaplarına göre 40'ı tetikleniyorsa, panoda 76
       * yazması "40 nerede kayboldu" sorusunu doğuruyordu. PDF raporu da zaten
       * bu süzülmüş listeyi kullanıyor.
       */
      getRecommendationsForUser(userId, { surveyId }),
    ]);
    const { scores } = progress;

    const getMaturityLevel = (pct: number) => {
      if (pct >= 80) return { level: 5, label: 'Lider', color: '#22c55e' };
      if (pct >= 60) return { level: 4, label: 'Olgun', color: '#2dd4bf' };
      if (pct >= 40) return { level: 3, label: 'Gelişen', color: '#38bdf8' };
      if (pct >= 20) return { level: 2, label: 'Farkındalık', color: '#fbbf24' };
      return { level: 1, label: 'Başlangıç', color: '#ef4444' };
    };

    const categoryStats = progress.categories.filter(category => category.questionCount > 0).map(category => ({
      id: category.id,
      name: category.name,
      total: category.questionCount,
      answered: category.responseCount,
      percentage: Math.round((category.responseCount / category.questionCount) * 100),
    }));

    let benchmark = null;
    if (profile?.sectorId) {
      benchmark = await prisma.ironmanBenchmark.findFirst({ where: { sectorId: profile.sectorId, subSectorId: profile.subSectorId || null } });
      if (!benchmark && profile.subSectorId) {
        benchmark = await prisma.ironmanBenchmark.findFirst({ where: { sectorId: profile.sectorId, subSectorId: null } });
      }
    }
    const velocity = round1(scores.velocityScore);
    const endurance = round1(scores.enduranceScore);
    const today = new Date().toDateString();

    return NextResponse.json({
      overview: {
        totalQuestions: scores.totalQuestions,
        answeredQuestions: scores.completedQuestions,
        completionPercentage: scores.totalQuestions > 0 ? Math.round((scores.completedQuestions / scores.totalQuestions) * 100) : 0,
        overallScore: scores.overallScore,
        overallPercentage: scores.overallPercentage,
        maturityLevel: getMaturityLevel(scores.overallPercentage),
      },
      ironman: {
        velocity,
        endurance,
        quadrant: scores.quadrant,
        quadrantInfo: { title: QUADRANT_LABELS[scores.quadrant] ?? scores.quadrant },
        velocityVsSector: benchmark ? round1(velocity - benchmark.velocityAverage) : null,
        enduranceVsSector: benchmark ? round1(endurance - benchmark.enduranceAverage) : null,
      },
      categories: {
        total: categoryStats.length,
        completed: categoryStats.filter(category => category.percentage === 100).length,
        stats: categoryStats,
      },
      recommendations: {
        total: recommendations.length,
        quickWins: recommendations.filter(r => r.strategicType === 'QUICK_WIN').length,
        projects: recommendations.filter(r => r.strategicType === 'PROJECT').length,
        bigBets: recommendations.filter(r => r.strategicType === 'BIG_BET').length,
      },
      activity: {
        lastActivityDate: activity[0]?.updatedAt ?? null,
        responsesToday: activity.filter(row => new Date(row.updatedAt).toDateString() === today).length,
      },
      user: {
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Kullanıcı',
        organization: user?.organization || null,
        sector: profile?.sector?.name || null,
        subSector: profile?.subSector?.name || null,
      },
    });
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    return NextResponse.json({ error: 'KPI verileri yüklenemedi' }, { status: 500 });
  }
}
