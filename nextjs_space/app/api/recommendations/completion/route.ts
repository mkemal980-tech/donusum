import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api-utils';
import { calculateProgressScores, getAccessibleSurveyIds } from '@/lib/scoring';
import { getAssessmentIds } from '@/lib/assessment';
import { updateRoadmapStatus } from '@/lib/roadmap-status';

export const dynamic = 'force-dynamic';

// Get all completion statuses for the current user
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    // RoadmapItem tablosundan oku (yol haritası ile senkronize)
    const assessmentIds = await getAssessmentIds(userId, await getAccessibleSurveyIds(userId));

    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { assessmentId: { in: assessmentIds } },
      include: {
        recommendation: {
          select: {
            id: true,
            title: true,
            points: true,
            subLevelId: true,
            subLevel: {
              select: {
                name: true,
                axisType: true
              }
            }
          }
        }
      }
    });

    // RoadmapItem formatını completions formatına dönüştür
    const completions = roadmapItems.map(item => ({
      id: item.id,
      assessmentId: item.assessmentId,
      recommendationId: item.recommendationId,
      status: item.status,
      notes: null,
      completedAt: item.status === 'COMPLETED' ? item.updatedAt : null,
      recommendation: item.recommendation
    }));

    // Mevcut skorları da döndür
    const scores = await calculateProgressScores(userId);

    return NextResponse.json({
      completions,
      scores,
    });
  } catch (error) {
    console.error('Error fetching completion statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch completion statuses' }, { status: 500 });
  }
}

/**
 * Durum güncelleme — yol haritası ucuyla aynı servis (lib/roadmap-status).
 *
 * `pointsEarned` artık ham `points` değil, bu tamamlamanın genel puana
 * yaptığı gerçek farktır; kademeli öneride de sıfırdan büyük çıkar.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { recommendationId, status, notes, surveyId } = await request.json();

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    const outcome = await updateRoadmapStatus(userId, {
      recommendationId,
      status: status ?? 'NOT_STARTED',
      surveyId
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error.message }, { status: outcome.error.httpStatus });
    }

    const { item, after, earned, isCompleted, wasCompleted } = outcome.result;

    // Formatı completion formatına dönüştür
    const completion = {
      id: item.id,
      assessmentId: item.assessmentId,
      recommendationId: item.recommendationId,
      status: item.status,
      notes: notes || null, // notes'u istek'ten al
      completedAt: item.status === 'COMPLETED' ? item.updatedAt : null,
      recommendation: item.recommendation
    };

    return NextResponse.json({
      completion,
      updatedScores: after,
      progress: after,
      earned,
      pointsEarned: isCompleted && !wasCompleted ? earned : 0
    });
  } catch (error) {
    console.error('Error updating completion status:', error);
    return NextResponse.json({ error: 'Failed to update completion status' }, { status: 500 });
  }
}
