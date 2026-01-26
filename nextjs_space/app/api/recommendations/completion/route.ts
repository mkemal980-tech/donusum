import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TEST_USER_ID = "cmkhjzaa70000x50t7n7fsjxo";

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return (session.user as SessionUser)?.id || TEST_USER_ID;
  }
  return TEST_USER_ID;
}

// Kullanıcının mevcut skorlarını hesapla
async function calculateUserScores(userId: string, surveyId?: string) {
  // Kullanıcının cevaplarını al
  const responses = await prisma.surveyResponse.findMany({
    where: { 
      userId,
      ...(surveyId && { question: { subLevel: { subCategory: { category: { surveyId } } } } }),
    },
    include: {
      question: {
        select: { weight: true, axisType: true }
      }
    }
  });

  // Tamamlanan önerilerin puanlarını al
  const completedRecs = await prisma.userRecommendationCompletion.findMany({
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
    const userId = await getUserId();

    const completions = await prisma.userRecommendationCompletion.findMany({
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
    const userId = await getUserId();

    const { recommendationId, status, notes, surveyId } = await request.json();

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Önceki durumu kontrol et
    const previousCompletion = await prisma.userRecommendationCompletion.findUnique({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId
        }
      }
    });

    const wasCompleted = previousCompletion?.status === 'COMPLETED';
    const isNowCompleted = status === 'COMPLETED';

    const completion = await prisma.userRecommendationCompletion.upsert({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId: recommendationId
        }
      },
      create: {
        userId,
        recommendationId: recommendationId,
        status: status || 'NOT_STARTED',
        notes: notes || null,
        completedAt: status === 'COMPLETED' ? new Date() : null
      },
      update: {
        status: status || 'NOT_STARTED',
        notes: notes !== undefined ? notes : undefined,
        completedAt: status === 'COMPLETED' ? new Date() : null
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
    const userId = await getUserId();

    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('recommendationId');

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    await prisma.userRecommendationCompletion.delete({
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
