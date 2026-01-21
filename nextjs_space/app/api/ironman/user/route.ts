import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Test kullanıcı ID (geliştirme için)
const TEST_USER_ID = 'cmkhjzaa70000x50t7n7fsjxo';

/**
 * İyileştirilmiş Ironman Analizi Hesaplama
 * 
 * Formül: Eksen Skoru = Σ(Cevap Puanı × Soru Ağırlığı) / Seçilen Soru Sayısı
 * 
 * - Velocity (Hız): "Hız" olarak işaretlenmiş soruların ağırlıklı ortalaması
 * - Endurance (Olgunluk): "Olgunluk" olarak işaretlenmiş soruların ağırlıklı ortalaması
 * 
 * Eşik Değer: 3.0
 * - V ≥ 3.0 ve E ≥ 3.0: IRONMAN
 * - V ≥ 3.0 ve E < 3.0: SPRINTER
 * - V < 3.0 ve E ≥ 3.0: MARATHON_RUNNER
 * - V < 3.0 ve E < 3.0: WALKER
 * 
 * Dengesizlik Uyarısı: |V - E| > 2.0 ise "Sürdürülebilirlik Riski" uyarısı
 */
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

    // Kullanıcının tüm cevaplarını al - artık question.axisType kullanıyoruz
    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        question: {
          select: {
            id: true,
            text: true,
            weight: true,
            axisType: true,  // Soru seviyesinde eksen tipi
            subLevel: {
              select: {
                id: true,
                name: true,
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

    // Velocity ve Endurance için ayrı havuzlar
    let velocityWeightedSum = 0;
    let velocityQuestionCount = 0;
    let enduranceWeightedSum = 0;
    let enduranceQuestionCount = 0;

    for (const response of responses) {
      const question = response.question;
      const weight = question.weight || 1.0;
      const score = response.score;  // 1-5 arası
      const axisType = question.axisType || 'VELOCITY';

      if (axisType === 'VELOCITY') {
        velocityWeightedSum += score * weight;
        velocityQuestionCount += weight;  // Ağırlıklı soru sayısı
      } else {
        enduranceWeightedSum += score * weight;
        enduranceQuestionCount += weight;  // Ağırlıklı soru sayısı
      }
    }

    // Ağırlıklı ortalama hesapla (1-5 ölçeğinde)
    const velocityScore = velocityQuestionCount > 0
      ? Math.round((velocityWeightedSum / velocityQuestionCount) * 10) / 10
      : 1;
    const enduranceScore = enduranceQuestionCount > 0
      ? Math.round((enduranceWeightedSum / enduranceQuestionCount) * 10) / 10
      : 1;

    // Kadran belirleme (Eşik değer: 3.0)
    const THRESHOLD = 3.0;
    const getQuadrant = (velocity: number, endurance: number) => {
      if (velocity >= THRESHOLD && endurance >= THRESHOLD) return 'IRONMAN';
      if (velocity >= THRESHOLD && endurance < THRESHOLD) return 'SPRINTER';
      if (velocity < THRESHOLD && endurance >= THRESHOLD) return 'MARATHON_RUNNER';
      return 'WALKER';
    };

    const quadrant = getQuadrant(velocityScore, enduranceScore);

    // Dengesizlik analizi (fark > 2.0 ise uyarı)
    const scoreDifference = Math.abs(velocityScore - enduranceScore);
    const isImbalanced = scoreDifference > 2.0;
    
    let imbalanceWarning = null;
    if (isImbalanced) {
      if (velocityScore > enduranceScore) {
        imbalanceWarning = {
          type: 'HIGH_VELOCITY_LOW_ENDURANCE',
          title: 'Sürdürülebilirlik Riski',
          message: `Hızınız çok yüksek (${velocityScore.toFixed(1)}) ama olgunluğunuz düşük (${enduranceScore.toFixed(1)}). Acilen süreçlerinizi dokümante etmeli ve standartlar (ISO vb.) belirlemelisiniz.`,
          recommendation: 'Hızlı aksiyonlarınızı destekleyecek politika ve prosedürler oluşturun.'
        };
      } else {
        imbalanceWarning = {
          type: 'HIGH_ENDURANCE_LOW_VELOCITY',
          title: 'Aksiyon Riski',
          message: `Olgunluğunuz yüksek (${enduranceScore.toFixed(1)}) ama hızınız düşük (${velocityScore.toFixed(1)}). Politikalarınız sağlam ancak uygulama hızınızı artırmanız gerekiyor.`,
          recommendation: 'Mevcut politikalarınızı hayata geçirecek somut aksiyonlar planlayın.'
        };
      }
    }

    // Kadran açıklamaları
    const quadrantInfo: Record<string, { title: string; description: string; color: string }> = {
      IRONMAN: {
        title: 'Iron Man',
        description: 'Yüksek çeviklik + Güçlü sistem. Hem hızlı aksiyon alıyorsunuz hem de sürdürülebilir politikalarınız var.',
        color: '#22c55e',
      },
      SPRINTER: {
        title: 'Sprinter',
        description: 'Hızlı aksiyon + Zayıf altyapı. Hızlı aksiyon alıyorsunuz fakat politikalar ve sürdürülebilirlik alanında gelişmeye ihtiyacınız var.',
        color: '#f59e0b',
      },
      MARATHON_RUNNER: {
        title: 'Marathon Runner',
        description: 'Güçlü altyapı + Düşük hız. Politikalarınız sağlam ama aksiyonlarınızı hızlandırmanız gerekiyor.',
        color: '#3b82f6',
      },
      WALKER: {
        title: 'Walker',
        description: 'Gelişim gerekiyor. Hem politikalar hem de aksiyonlar alanında gelişmeye ihtiyacınız var.',
        color: '#ef4444',
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
        // Ek istatistikler
        velocityQuestionCount: Math.round(velocityQuestionCount),
        enduranceQuestionCount: Math.round(enduranceQuestionCount),
        totalResponses: responses.length,
      },
      // Dengesizlik analizi
      imbalance: {
        isImbalanced,
        difference: Math.round(scoreDifference * 10) / 10,
        warning: imbalanceWarning,
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
