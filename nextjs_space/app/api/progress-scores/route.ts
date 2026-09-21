import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { calculateProgressBreakdown } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

/**
 * Pano için gelişim kırılımı — tek doğru kaynak (lib/scoring).
 *
 * Eskiden kategori bonusu burada ham `points` toplamından türetiliyordu;
 * kademeli önerilerin basamak yükseltmesi kırılımda hiç görünmüyor, genel
 * eksen puanı ise onu içeriyordu. Artık her sayı aynı motordan gelir.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId') || undefined;

    const { scores, categories } = await calculateProgressBreakdown(userId, { surveyId });

    return NextResponse.json({
      categories,
      overall: {
        velocity: {
          baseScore: scores.velocityBase,
          bonusPoints: scores.velocityBonus,
          totalScore: scores.velocityScore
        },
        endurance: {
          baseScore: scores.enduranceBase,
          bonusPoints: scores.enduranceBonus,
          totalScore: scores.enduranceScore
        },
        quadrant: scores.quadrant,
        baselineScore: scores.baselineOverallScore,
        baselinePercentage: scores.baselineOverallPercentage,
        currentScore: scores.overallScore,
        currentPercentage: scores.overallPercentage,
        delta: scores.delta,
        deltaPercentage: scores.deltaPercentage,
        totalCompletedRecommendations: scores.completedRecommendations,
        totalResponses: scores.completedQuestions
      }
    });
  } catch (error) {
    console.error('Progress scores error:', error);
    return NextResponse.json({ error: 'Failed to fetch progress scores' }, { status: 500 });
  }
}
