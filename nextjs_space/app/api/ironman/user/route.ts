import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api-utils';
import { classifyQuadrant } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

/**
 * Digitopia-Style Ironman Analysis API
 * 
 * Özellikler:
 * - Current ve Target skorları
 * - Industry Average Current ve Target
 * - Quadrant analizi (Walker, Sprinter, Marathon Runner, Iron Man)
 * - Benchmark karşılaştırması
 */

// Kadran belirleme lib/scoring.classifyQuadrant üzerinden (tek doğru kaynak)

// Kadran açıklamaları
const quadrantInfo: Record<string, { title: string; titleEn: string; description: string; color: string }> = {
  IRONMAN: {
    title: 'Demir Adam',
    titleEn: 'Iron Man',
    description: 'Demir Adam şirketleri hem güçlü hıza hem de dayanıklılığa sahiptir. Sürdürülebilir politikalar ve süreçler koruyarak hızlı aksiyon alabilirsiniz.',
    color: '#22c55e',
  },
  SPRINTER: {
    title: 'Sprinter',
    titleEn: 'Sprinter',
    description: 'Sprinter şirketleri güçlü hıza sahip ancak dayanıklılıktan yoksundur. Hızlı aksiyon alıyorsunuz ancak sürdürülebilir politikalar ve dokümantasyon geliştirmelisiniz.',
    color: '#f59e0b',
  },
  MARATHON_RUNNER: {
    title: 'Maraton Koşucusu',
    titleEn: 'Marathon Runner',
    description: 'Maraton Koşucusu şirketleri güçlü dayanıklılığa sahip ancak hızdan yoksundur. Politikalarınız sağlam ancak aksiyonlarınızı hızlandırmalısınız.',
    color: '#3b82f6',
  },
  WALKER: {
    title: 'Yaya',
    titleEn: 'Walker',
    description: 'Yaya şirketleri henüz güçlü hıza ve dayanıklılığa sahip değildir. Bu grafiğin bu bölgesindeyseniz, türbülanslı iç veya dış koşullar altında savunmasız olabilirsiniz.',
    color: '#ef4444',
  },
};

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      // Kullanıcı bulunamadığında varsayılan değerler döndür
      return NextResponse.json({
        current: {
          velocity: 1.0,
          endurance: 1.0,
          date: new Date().toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '/'),
          quadrant: 'WALKER',
          quadrantInfo: quadrantInfo['WALKER'],
        },
        target: {
          velocity: 3.0,
          endurance: 3.0,
          date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: '2-digit', year: 'numeric' }).replace('/', '/'),
        },
        benchmark: {
          current: { velocity: 2.5, endurance: 2.5 },
          target: { velocity: 3.0, endurance: 3.0 },
        },
        company: {
          name: 'Bilinmeyen',
          industry: 'Belirtilmemiş',
          region: 'Global',
        },
        stats: {
          totalQuestions: 0,
          answeredQuestions: 0,
          velocityQuestions: 0,
          enduranceQuestions: 0,
        },
      });
    }

    // Kullanıcının tüm cevaplarını al
    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        question: {
          select: {
            id: true,
            weight: true,
            axisType: true,
          },
        },
      },
    });

    // Velocity ve Endurance hesapla
    let velocityWeightedSum = 0;
    let velocityWeightTotal = 0;
    let enduranceWeightedSum = 0;
    let enduranceWeightTotal = 0;

    for (const response of responses) {
      const question = response.question;
      const weight = question.weight || 1.0;
      const score = response.score;
      const axisType = question.axisType || 'VELOCITY';

      if (axisType === 'VELOCITY') {
        velocityWeightedSum += score * weight;
        velocityWeightTotal += weight;
      } else {
        enduranceWeightedSum += score * weight;
        enduranceWeightTotal += weight;
      }
    }

    const currentVelocity = velocityWeightTotal > 0
      ? Math.round((velocityWeightedSum / velocityWeightTotal) * 10) / 10
      : 2.5;
    const currentEndurance = enduranceWeightTotal > 0
      ? Math.round((enduranceWeightedSum / enduranceWeightTotal) * 10) / 10
      : 2.5;

    const quadrant = classifyQuadrant(currentVelocity, currentEndurance);

    // Sektör benchmark verilerini al
    let benchmark = null;
    if (user.sectorId) {
      benchmark = await prisma.ironmanBenchmark.findFirst({
        where: {
          sectorId: user.sectorId,
          subSectorId: user.subSectorId || null,
        },
        include: {
          sector: { select: { id: true, name: true } },
          subSector: { select: { id: true, name: true } },
        },
      });

      if (!benchmark && user.subSectorId) {
        benchmark = await prisma.ironmanBenchmark.findFirst({
          where: {
            sectorId: user.sectorId,
            subSectorId: null,
          },
          include: {
            sector: { select: { id: true, name: true } },
            subSector: { select: { id: true, name: true } },
          },
        });
      }
    }

    // Tarihler için format
    const currentDate = user.currentScoreDate || new Date();
    const targetDate = user.targetDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 yıl sonra

    const formatDate = (date: Date) => {
      const d = new Date(date);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    return NextResponse.json({
      current: {
        velocity: currentVelocity,
        endurance: currentEndurance,
        date: formatDate(currentDate),
        quadrant,
        quadrantInfo: quadrantInfo[quadrant],
      },
      target: {
        velocity: user.targetVelocity || Math.min(currentVelocity + 0.5, 5),
        endurance: user.targetEndurance || Math.min(currentEndurance + 0.4, 5),
        date: formatDate(targetDate),
      },
      benchmark: benchmark ? {
        velocityAverage: benchmark.velocityAverage,
        velocityBest: benchmark.velocityBest,
        enduranceAverage: benchmark.enduranceAverage,
        enduranceBest: benchmark.enduranceBest,
        velocityAverageTarget: benchmark.velocityAverageTarget,
        enduranceAverageTarget: benchmark.enduranceAverageTarget,
        sectorName: benchmark.sector.name,
        subSectorName: benchmark.subSector?.name || null,
      } : null,
      company: {
        name: user.organization || 'Your Company',
        industry: user.sector?.name || 'Not specified',
        region: user.region || 'Global',
      },
      stats: {
        velocityQuestionCount: Math.round(velocityWeightTotal),
        enduranceQuestionCount: Math.round(enduranceWeightTotal),
        totalResponses: responses.length,
      },
    });
  } catch (error) {
    console.error('Error calculating ironman scores:', error);
    return NextResponse.json({ error: 'Ironman skorları hesaplanamadı' }, { status: 500 });
  }
}

// Target skorları kaydet
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { targetVelocity, targetEndurance, targetDate } = body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        targetVelocity: targetVelocity ? parseFloat(targetVelocity) : undefined,
        targetEndurance: targetEndurance ? parseFloat(targetEndurance) : undefined,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        currentScoreDate: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error saving target scores:', error);
    return NextResponse.json({ error: 'Hedef skorlar kaydedilemedi' }, { status: 500 });
  }
}
