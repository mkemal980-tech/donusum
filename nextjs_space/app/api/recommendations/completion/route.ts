import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getUserIdOrNull() {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

// Kullanıcının mevcut skorlarını hesapla
async function calculateUserScores(userId: string, surveyId?: string) {
  // Kullanıcının cevaplarını al
  const responses = await prisma.surveyResponse.findMany({
    where: { 
      userId,
      ...(surveyId && {
        OR: [
          { question: { subLevel: { subCategory: { category: { surveyId } } } } },
          { question: { subCategory: { category: { surveyId } } } },
          { question: { category: { surveyId } } }
        ]
      }),
    },
    include: {
      question: {
        select: { weight: true, axisType: true }
      }
    }
  });

  // Tamamlanan önerilerin puanlarını al (RoadmapItem'dan)
  const completedRecs = await prisma.roadmapItem.findMany({
    where: { 
      userId, 
      status: 'COMPLETED' 
    },
    include: {
      recommendation: {
        select: { 
          points: true,
          subLevelId: true,
          subLevel: {
            select: { axisType: true }
          }
        }
      }
    }
  });

  // Anket cevaplarından gelen puanlar
  let velocitySum = 0, velocityWeight = 0;
  let enduranceSum = 0, enduranceWeight = 0;
  let totalScoreSum = 0, totalWeight = 0;

  responses.forEach(r => {
    const weight = r.question.weight || 1;
    const score = r.score;
    
    if (r.question.axisType === 'ENDURANCE') {
      enduranceSum += score * weight;
      enduranceWeight += weight;
    } else {
      velocitySum += score * weight;
      velocityWeight += weight;
    }
    
    totalScoreSum += score * weight;
    totalWeight += weight;
  });

  // Tamamlanan önerilerden gelen bonus puanlar
  let velocityBonus = 0, enduranceBonus = 0;
  
  completedRecs.forEach(c => {
    const points = c.recommendation.points || 0;
    const axisType = c.recommendation.subLevel?.axisType || 'VELOCITY';
    
    if (axisType === 'ENDURANCE') {
      enduranceBonus += points;
    } else {
      velocityBonus += points;
    }
  });

  // Final skorlar (bonus puanlarla)
  const baseVelocity = velocityWeight > 0 ? velocitySum / velocityWeight : 0;
  const baseEndurance = enduranceWeight > 0 ? enduranceSum / enduranceWeight : 0;
  const baseOverall = totalWeight > 0 ? totalScoreSum / totalWeight : 0;

  // Bonus puanları uygula (maksimum 5'i geçemez)
  const velocityScore = Math.min(5, baseVelocity + velocityBonus);
  const enduranceScore = Math.min(5, baseEndurance + enduranceBonus);
  const overallScore = Math.min(5, baseOverall + (velocityBonus + enduranceBonus) / 2);
  const overallPercentage = ((overallScore - 1) / 4) * 100;

  // Quadrant hesapla
  const THRESHOLD = 3.0;
  let quadrant = 'WALKER';
  if (velocityScore >= THRESHOLD && enduranceScore >= THRESHOLD) quadrant = 'IRONMAN';
  else if (velocityScore >= THRESHOLD && enduranceScore < THRESHOLD) quadrant = 'SPRINTER';
  else if (velocityScore < THRESHOLD && enduranceScore >= THRESHOLD) quadrant = 'MARATHON_RUNNER';

  // Toplam soru sayısı
  const totalQuestions = await prisma.question.count();

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    overallPercentage: Math.round(overallPercentage),
    velocityScore: Math.round(velocityScore * 10) / 10,
    enduranceScore: Math.round(enduranceScore * 10) / 10,
    quadrant,
    completedQuestions: responses.length,
    totalQuestions,
    completedRecommendations: completedRecs.length,
  };
}

// Skor geçmişine kayıt ekle
async function recordScoreHistory(
  userId: string, 
  triggerType: string, 
  triggerEntityId?: string,
  surveyId?: string
) {
  const scores = await calculateUserScores(userId, surveyId);
  
  await prisma.scoreHistory.create({
    data: {
      userId,
      surveyId,
      overallScore: scores.overallScore,
      overallPercentage: scores.overallPercentage,
      velocityScore: scores.velocityScore,
      enduranceScore: scores.enduranceScore,
      quadrant: scores.quadrant,
      completedQuestions: scores.completedQuestions,
      totalQuestions: scores.totalQuestions,
      completedRecommendations: scores.completedRecommendations,
      triggerType,
      triggerEntityId,
    }
  });

  return scores;
}

// Get all completion statuses for the current user
export async function GET() {
  try {
    const userId = await getUserIdOrNull();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RoadmapItem tablosundan oku (yol haritası ile senkronize)
    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { userId },
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
      userId: item.userId,
      recommendationId: item.recommendationId,
      status: item.status,
      notes: null,
      completedAt: item.status === 'COMPLETED' ? item.updatedAt : null,
      recommendation: item.recommendation
    }));

    // Mevcut skorları da döndür
    const scores = await calculateUserScores(userId);

    return NextResponse.json({
      completions,
      scores,
    });
  } catch (error) {
    console.error('Error fetching completion statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch completion statuses' }, { status: 500 });
  }
}

// Create or update a completion status
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdOrNull();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendationId, status, notes, surveyId } = await request.json();

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Önceki durumu kontrol et (RoadmapItem'dan)
    const previousItem = await prisma.roadmapItem.findUnique({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId
        }
      }
    });

    const wasCompleted = previousItem?.status === 'COMPLETED';
    const isNowCompleted = status === 'COMPLETED';

    // RoadmapItem tablosunu güncelle (yol haritası ile senkronize)
    const roadmapItem = await prisma.roadmapItem.upsert({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId: recommendationId
        }
      },
      create: {
        userId,
        recommendationId: recommendationId,
        status: status || 'NOT_STARTED'
      },
      update: {
        status: status || 'NOT_STARTED'
      },
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

    // Formatı completion formatına dönüştür
    const completion = {
      id: roadmapItem.id,
      userId: roadmapItem.userId,
      recommendationId: roadmapItem.recommendationId,
      status: roadmapItem.status,
      notes: notes || null, // notes'u istek'ten al
      completedAt: roadmapItem.status === 'COMPLETED' ? roadmapItem.updatedAt : null,
      recommendation: roadmapItem.recommendation
    };

    // Eğer yeni tamamlandıysa, skor geçmişine kayıt ekle
    let updatedScores = null;
    if (!wasCompleted && isNowCompleted) {
      updatedScores = await recordScoreHistory(
        userId, 
        'RECOMMENDATION_COMPLETED', 
        recommendationId,
        surveyId
      );
    }

    return NextResponse.json({
      completion,
      updatedScores,
      pointsEarned: isNowCompleted && !wasCompleted ? completion.recommendation.points : 0
    });
  } catch (error) {
    console.error('Error updating completion status:', error);
    return NextResponse.json({ error: 'Failed to update completion status' }, { status: 500 });
  }
}

// Delete a completion status (reset to not started)
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdOrNull();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('recommendationId');

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    await prisma.roadmapItem.delete({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId: recommendationId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting completion status:', error);
    return NextResponse.json({ error: 'Failed to delete completion status' }, { status: 500 });
  }
}
