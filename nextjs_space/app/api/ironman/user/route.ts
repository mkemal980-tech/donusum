import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Test kullanıcı ID (geliştirme için)
const TEST_USER_ID = 'cmkhjzaa70000x50t7n7fsjxo';

/**
 * Digitopia-Style Ironman Analysis API
 * 
 * Özellikler:
 * - Current ve Target skorları
 * - Industry Average Current ve Target
 * - Quadrant analizi (Walker, Sprinter, Marathon Runner, Iron Man)
 * - Benchmark karşılaştırması
 */

// Kadran belirleme (Eşik değer: 3.0)
const THRESHOLD = 3.0;
const getQuadrant = (velocity: number, endurance: number) => {
  if (velocity >= THRESHOLD && endurance >= THRESHOLD) return 'IRONMAN';
  if (velocity >= THRESHOLD && endurance < THRESHOLD) return 'SPRINTER';
  if (velocity < THRESHOLD && endurance >= THRESHOLD) return 'MARATHON_RUNNER';
  return 'WALKER';
};

// Kadran açıklamaları
const quadrantInfo: Record<string, { title: string; titleEn: string; description: string; color: string }> = {
  IRONMAN: {
    title: 'Iron Man',
    titleEn: 'Iron Man',
    description: 'Iron Man companies have both strong velocity and endurance. You are able to take quick action while maintaining sustainable policies and processes.',
    color: '#22c55e',
  },
  SPRINTER: {
    title: 'Sprinter',
    titleEn: 'Sprinter',
    description: 'Sprinter companies have strong velocity but lack endurance. You take quick action but need to develop sustainable policies and documentation.',
    color: '#f59e0b',
  },
  MARATHON_RUNNER: {
    title: 'Marathon Runner',
    titleEn: 'Marathon Runner',
    description: 'Marathon Runner companies have strong endurance but lack velocity. Your policies are solid but you need to speed up your actions.',
    color: '#3b82f6',
  },
  WALKER: {
    title: 'Walker',
    titleEn: 'Walker',
    description: 'Walker companies doesn\'t have strong velocity and endurance yet. If you are in this area of the graph, it means you may be vulnerable under turbulent inner or outer conditions.',
    color: '#ef4444',
  },
};

export async function GET(request: NextRequest) {
  try {
    const userId = TEST_USER_ID;

    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
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

    const quadrant = getQuadrant(currentVelocity, currentEndurance);

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
  try {
    const userId = TEST_USER_ID;
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
