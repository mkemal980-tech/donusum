import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // Kullanıcı bilgileri
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sector: { select: { name: true } },
        subSector: { select: { name: true } },
      },
    });

    // Kullanıcının cevapları
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
          select: {
            id: true,
            weight: true,
            axisType: true,
            subLevelId: true,
            subCategoryId: true,
            categoryId: true,
            subLevel: {
              select: {
                subCategory: {
                  select: {
                    category: {
                      select: { id: true, name: true, surveyId: true }
                    }
                  }
                }
              }
            },
            subCategory: {
              select: {
                category: {
                  select: { id: true, name: true, surveyId: true }
                }
              }
            },
            category: {
              select: { id: true, name: true, surveyId: true }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Toplam soru sayısı
    const questionFilter = surveyId ? {
      OR: [
        { subLevel: { subCategory: { category: { surveyId } } } },
        { subCategory: { category: { surveyId } } },
        { category: { surveyId } }
      ]
    } : {};
    
    const totalQuestions = await prisma.question.count({ where: questionFilter });

    // Cevaplanmış soru sayısı
    const answeredQuestions = responses.length;
    const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

    // Velocity ve Endurance hesapla
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

    const velocityScore = velocityWeight > 0 ? Math.round((velocitySum / velocityWeight) * 10) / 10 : 0;
    const enduranceScore = enduranceWeight > 0 ? Math.round((enduranceSum / enduranceWeight) * 10) / 10 : 0;
    const overallScore = totalWeight > 0 ? Math.round((totalScoreSum / totalWeight) * 10) / 10 : 0;
    const overallPercentage = totalWeight > 0 ? Math.round(((totalScoreSum / totalWeight - 1) / 4) * 100) : 0;

    // Ironman quadrant
    const THRESHOLD = 3.0;
    let quadrant = 'WALKER';
    if (velocityScore >= THRESHOLD && enduranceScore >= THRESHOLD) quadrant = 'IRONMAN';
    else if (velocityScore >= THRESHOLD && enduranceScore < THRESHOLD) quadrant = 'SPRINTER';
    else if (velocityScore < THRESHOLD && enduranceScore >= THRESHOLD) quadrant = 'MARATHON_RUNNER';

    const quadrantLabels: Record<string, { title: string; color: string }> = {
      IRONMAN: { title: 'Iron Man', color: '#22c55e' },
      SPRINTER: { title: 'Sprinter', color: '#f59e0b' },
      MARATHON_RUNNER: { title: 'Marathon Runner', color: '#3b82f6' },
      WALKER: { title: 'Walker', color: '#ef4444' },
    };

    // Maturity level
    const getMaturityLevel = (pct: number) => {
      if (pct >= 80) return { level: 5, label: 'Lider', color: '#22c55e' };
      if (pct >= 60) return { level: 4, label: 'Olgun', color: '#2dd4bf' };
      if (pct >= 40) return { level: 3, label: 'Gelişen', color: '#38bdf8' };
      if (pct >= 20) return { level: 2, label: 'Farkındalık', color: '#fbbf24' };
      return { level: 1, label: 'Başlangıç', color: '#ef4444' };
    };

    // Kategoriler
    const categoryFilter = surveyId ? { surveyId } : {};
    const categories = await prisma.category.findMany({
      where: categoryFilter,
      include: {
        subCategories: {
          include: {
            subLevels: {
              include: { questions: { select: { id: true } } }
            },
            questions: { select: { id: true } }
          }
        }
      }
    });

    const answeredIds = new Set(responses.map(r => r.questionId));
    
    const categoryStats = categories.map(cat => {
      let totalQ = 0;
      let answeredQ = 0;
      
      cat.subCategories.forEach(sub => {
        if (sub.subLevels.length > 0) {
          sub.subLevels.forEach(level => {
            level.questions.forEach(q => {
              totalQ++;
              if (answeredIds.has(q.id)) answeredQ++;
            });
          });
        } else {
          sub.questions.forEach(q => {
            totalQ++;
            if (answeredIds.has(q.id)) answeredQ++;
          });
        }
      });
      
      return {
        id: cat.id,
        name: cat.name,
        total: totalQ,
        answered: answeredQ,
        percentage: totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 0,
      };
    });

    // Öneriler - tüm bağlantı yollarını kontrol et (categoryId, subCategoryId, subLevelId)
    const categoryIds = categories.map(c => c.id);
    const recommendations = await prisma.recommendation.findMany({
      where: surveyId && categoryIds.length > 0 
        ? {
            OR: [
              { categoryId: { in: categoryIds } },
              { subCategory: { categoryId: { in: categoryIds } } },
              { subLevel: { subCategory: { categoryId: { in: categoryIds } } } }
            ]
          }
        : {},
    });

    const quickWins = recommendations.filter(r => r.strategicType === 'QUICK_WIN').length;
    const projects = recommendations.filter(r => r.strategicType === 'PROJECT').length;
    const bigBets = recommendations.filter(r => r.strategicType === 'BIG_BET').length;

    // Son aktivite
    const lastResponse = responses[0];
    const lastActivityDate = lastResponse?.updatedAt || null;

    // Benchmark karşılaştırması
    let benchmark = null;
    if (user?.sectorId) {
      benchmark = await prisma.ironmanBenchmark.findFirst({
        where: {
          sectorId: user.sectorId,
          subSectorId: user.subSectorId || null,
        },
      });
      
      if (!benchmark && user.subSectorId) {
        benchmark = await prisma.ironmanBenchmark.findFirst({
          where: {
            sectorId: user.sectorId,
            subSectorId: null,
          },
        });
      }
    }

    // Sektör karşılaştırması
    const velocityVsSector = benchmark 
      ? Math.round((velocityScore - benchmark.velocityAverage) * 10) / 10 
      : null;
    const enduranceVsSector = benchmark 
      ? Math.round((enduranceScore - benchmark.enduranceAverage) * 10) / 10 
      : null;

    return NextResponse.json({
      // Genel İstatistikler
      overview: {
        totalQuestions,
        answeredQuestions,
        completionPercentage,
        overallScore,
        overallPercentage,
        maturityLevel: getMaturityLevel(overallPercentage),
      },
      
      // Ironman Analizi
      ironman: {
        velocity: velocityScore,
        endurance: enduranceScore,
        quadrant,
        quadrantInfo: quadrantLabels[quadrant],
        velocityVsSector,
        enduranceVsSector,
      },
      
      // Kategori İstatistikleri
      categories: {
        total: categories.length,
        completed: categoryStats.filter(c => c.percentage === 100).length,
        stats: categoryStats,
      },
      
      // Öneriler
      recommendations: {
        total: recommendations.length,
        quickWins,
        projects,
        bigBets,
      },
      
      // Aktivite
      activity: {
        lastActivityDate,
        responsesToday: responses.filter(r => {
          const today = new Date();
          const responseDate = new Date(r.updatedAt);
          return responseDate.toDateString() === today.toDateString();
        }).length,
      },
      
      // Kullanıcı Bilgileri
      user: {
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Kullanıcı',
        organization: user?.organization || null,
        sector: user?.sector?.name || null,
        subSector: user?.subSector?.name || null,
      },
    });
  } catch (error) {
    console.error('Error fetching KPI data:', error);
    return NextResponse.json({ error: 'KPI verileri yüklenemedi' }, { status: 500 });
  }
}
