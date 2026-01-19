import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Test kullanıcı ID (geliştirme için)
const TEST_USER_ID = 'cmkhjzaa70000x50t7n7fsjxo';

// Kullanıcının Ironman skorlarını hesapla
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

    // Kullanıcının tüm cevaplarını al (subLevel.axisType ile birlikte)
    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            subLevel: {
              select: {
                id: true,
                name: true,
                axisType: true,
                subCategory: {
                  select: {
                    id: true,
                    name: true,
                    category: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
            subCategory: {
              select: {
                id: true,
                name: true,
                category: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    // Velocity (X) ve Endurance (Y) skorlarını hesapla
    let velocityTotalScore = 0;
    let velocityTotalWeight = 0;
    let enduranceTotalScore = 0;
    let enduranceTotalWeight = 0;

    for (const response of responses) {
      const question = response.question;
      const weight = question.weight || 1;
      const score = response.score;

      // SubLevel'dan axisType al
      let axisType = 'VELOCITY'; // default
      if (question.subLevel) {
        axisType = question.subLevel.axisType;
      }

      if (axisType === 'VELOCITY') {
        velocityTotalScore += score * weight;
        velocityTotalWeight += 5 * weight; // Maksimum skor 5
      } else {
        enduranceTotalScore += score * weight;
        enduranceTotalWeight += 5 * weight;
      }
    }

    // 1-5 ölçeğinde normalize et
    const velocityScore = velocityTotalWeight > 0
      ? Math.round(((velocityTotalScore / velocityTotalWeight) * 4 + 1) * 10) / 10
      : 1;
    const enduranceScore = enduranceTotalWeight > 0
      ? Math.round(((enduranceTotalScore / enduranceTotalWeight) * 4 + 1) * 10) / 10
      : 1;

    // Kadran belirleme
    const getQuadrant = (velocity: number, endurance: number) => {
      const midPoint = 3;
      if (velocity >= midPoint && endurance >= midPoint) return 'IRONMAN';
      if (velocity >= midPoint && endurance < midPoint) return 'SPRINTER';
      if (velocity < midPoint && endurance >= midPoint) return 'MARATHON_RUNNER';
      return 'WALKER';
    };

    const quadrant = getQuadrant(velocityScore, enduranceScore);

    // Kadran açıklamaları
    const quadrantInfo: Record<string, { title: string; description: string }> = {
      IRONMAN: {
        title: 'Iron Man',
        description: 'Yüksek hız ve yüksek olgunluk. Hem hızlı aksiyon alıyorsunuz hem de sürdürülebilir politikalarınız var.',
      },
      SPRINTER: {
        title: 'Sprinter',
        description: 'Yüksek hız ama düşük olgunluk. Hızlı aksiyon alıyorsunuz fakat politikalar ve sürdürülebilirlik alanında gelişmeye ihtiyacınız var.',
      },
      MARATHON_RUNNER: {
        title: 'Marathon Runner',
        description: 'Düşük hız ama yüksek olgunluk. Politikalarınız sağlam ama aksiyonlarınızı hızlandırmanız gerekiyor.',
      },
      WALKER: {
        title: 'Walker',
        description: 'Düşük hız ve düşük olgunluk. Hem politikalar hem de aksiyonlar alanında gelişmeye ihtiyacınız var.',
      },
    };

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

      // Alt sektör benchmark'u yoksa sektör benchmark'una bak
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

    return NextResponse.json({
      user: {
        velocity: velocityScore,
        endurance: enduranceScore,
        quadrant,
        quadrantInfo: quadrantInfo[quadrant],
      },
      benchmark: benchmark ? {
        velocityAverage: benchmark.velocityAverage,
        velocityBest: benchmark.velocityBest,
        enduranceAverage: benchmark.enduranceAverage,
        enduranceBest: benchmark.enduranceBest,
        sectorName: benchmark.sector.name,
        subSectorName: benchmark.subSector?.name || null,
      } : null,
      sector: user.sector,
      subSector: user.subSector,
    });
  } catch (error) {
    console.error('Error calculating ironman scores:', error);
    return NextResponse.json({ error: 'Ironman skorları hesaplanamadı' }, { status: 500 });
  }
}
