import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { calculateProgressScores } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

// Skor geçmişini getir
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);

    const surveyId = searchParams.get('surveyId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const period = searchParams.get('period'); // day, week, month, year, all

    // Tarih filtresi
    let dateFilter: Date | undefined;
    if (period) {
      const now = new Date();
      switch (period) {
        case 'day':
          dateFilter = new Date(now.setDate(now.getDate() - 1));
          break;
        case 'week':
          dateFilter = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          dateFilter = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '3months':
          dateFilter = new Date(now.setMonth(now.getMonth() - 3));
          break;
        case '6months':
          dateFilter = new Date(now.setMonth(now.getMonth() - 6));
          break;
        case 'year':
          dateFilter = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }
    }

    // Önce mevcut geçmişi kontrol et
    let history = await prisma.scoreHistory.findMany({
      where: {
        userId,
        ...(surveyId && { surveyId }),
        ...(dateFilter && { recordedAt: { gte: dateFilter } }),
      },
      orderBy: { recordedAt: 'asc' },
      take: limit,
    });
    
    // Eğer hiç kayıt yoksa ve kullanıcının anket cevabı varsa, başlangıç snapshot'ı oluştur
    if (history.length === 0) {
      const responseCount = await prisma.surveyResponse.count({
        where: { userId }
      });
      
      if (responseCount > 0) {
        // Başlangıç snapshot'ı — öneri tamamlama ile aynı motoru kullanır,
        // böylece iki kayıt türü arasında sahte sıçrama oluşmaz.
        const scores = await calculateProgressScores(userId, {
          surveyId: surveyId || undefined
        });

        const initialSnapshot = await prisma.scoreHistory.create({
          data: {
            userId,
            surveyId: surveyId || null,
            overallScore: scores.overallScore,
            overallPercentage: scores.overallPercentage,
            velocityScore: scores.velocityScore,
            enduranceScore: scores.enduranceScore,
            quadrant: scores.quadrant,
            completedQuestions: scores.completedQuestions,
            totalQuestions: scores.totalQuestions,
            completedRecommendations: scores.completedRecommendations,
            triggerType: 'INITIAL_SNAPSHOT',
          }
        });

        history = [initialSnapshot];
      }
    }

    // İstatistikler
    const stats = {
      totalRecords: history.length,
      firstRecord: history[0]?.recordedAt || null,
      lastRecord: history[history.length - 1]?.recordedAt || null,
    };

    // Gelişim hesaplaması
    let progress = null;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      
      progress = {
        overallScore: {
          start: first.overallScore,
          end: last.overallScore,
          change: Math.round((last.overallScore - first.overallScore) * 10) / 10,
          changePercent: Math.round(((last.overallScore - first.overallScore) / first.overallScore) * 100),
        },
        velocity: {
          start: first.velocityScore,
          end: last.velocityScore,
          change: first.velocityScore && last.velocityScore 
            ? Math.round((last.velocityScore - first.velocityScore) * 10) / 10 
            : null,
        },
        endurance: {
          start: first.enduranceScore,
          end: last.enduranceScore,
          change: first.enduranceScore && last.enduranceScore 
            ? Math.round((last.enduranceScore - first.enduranceScore) * 10) / 10 
            : null,
        },
        recommendations: {
          start: first.completedRecommendations,
          end: last.completedRecommendations,
          completed: last.completedRecommendations - first.completedRecommendations,
        },
        quadrantProgress: {
          start: first.quadrant,
          end: last.quadrant,
          improved: getQuadrantLevel(last.quadrant) > getQuadrantLevel(first.quadrant),
        },
      };
    }

    // Aylık/Haftalık gruplandırma (grafik için)
    const groupedData = groupByPeriod(history);

    return NextResponse.json({
      history,
      stats,
      progress,
      groupedData,
    });
  } catch (error) {
    console.error('Error fetching score history:', error);
    return NextResponse.json({ error: 'Skor geçmişi yüklenemedi' }, { status: 500 });
  }
}

// Manuel snapshot oluştur
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { surveyId } = await request.json();

    // Mevcut skorları hesapla (tek doğru kaynak: lib/scoring)
    const scores = await calculateProgressScores(userId, {
      surveyId: surveyId || undefined
    });

    const snapshot = await prisma.scoreHistory.create({
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
        triggerType: 'MANUAL_SNAPSHOT',
      }
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Error creating snapshot:', error);
    return NextResponse.json({ error: 'Snapshot oluşturulamadı' }, { status: 500 });
  }
}

// Quadrant seviyesi (karşılaştırma için)
function getQuadrantLevel(quadrant: string | null): number {
  switch (quadrant) {
    case 'IRONMAN': return 4;
    case 'MARATHON_RUNNER': return 3;
    case 'SPRINTER': return 2;
    case 'WALKER': return 1;
    default: return 0;
  }
}

// Periyoda göre grupla
function groupByPeriod(history: any[]) {
  const monthly: Record<string, any> = {};
  const weekly: Record<string, any> = {};

  history.forEach(h => {
    const date = new Date(h.recordedAt);
    
    // Aylık
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[monthKey]) {
      monthly[monthKey] = { 
        date: monthKey, 
        records: [],
        avgOverall: 0,
        avgVelocity: 0,
        avgEndurance: 0,
      };
    }
    monthly[monthKey].records.push(h);

    // Haftalık
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekly[weekKey]) {
      weekly[weekKey] = { 
        date: weekKey, 
        records: [],
        avgOverall: 0,
        avgVelocity: 0,
        avgEndurance: 0,
      };
    }
    weekly[weekKey].records.push(h);
  });

  // Ortalamaları hesapla
  Object.values(monthly).forEach((m: any) => {
    m.avgOverall = Math.round((m.records.reduce((sum: number, r: any) => sum + r.overallScore, 0) / m.records.length) * 10) / 10;
    m.avgVelocity = Math.round((m.records.reduce((sum: number, r: any) => sum + (r.velocityScore || 0), 0) / m.records.length) * 10) / 10;
    m.avgEndurance = Math.round((m.records.reduce((sum: number, r: any) => sum + (r.enduranceScore || 0), 0) / m.records.length) * 10) / 10;
    m.count = m.records.length;
    delete m.records;
  });

  Object.values(weekly).forEach((w: any) => {
    w.avgOverall = Math.round((w.records.reduce((sum: number, r: any) => sum + r.overallScore, 0) / w.records.length) * 10) / 10;
    w.avgVelocity = Math.round((w.records.reduce((sum: number, r: any) => sum + (r.velocityScore || 0), 0) / w.records.length) * 10) / 10;
    w.avgEndurance = Math.round((w.records.reduce((sum: number, r: any) => sum + (r.enduranceScore || 0), 0) / w.records.length) * 10) / 10;
    w.count = w.records.length;
    delete w.records;
  });

  return {
    monthly: Object.values(monthly).sort((a: any, b: any) => a.date.localeCompare(b.date)),
    weekly: Object.values(weekly).sort((a: any, b: any) => a.date.localeCompare(b.date)),
  };
}
