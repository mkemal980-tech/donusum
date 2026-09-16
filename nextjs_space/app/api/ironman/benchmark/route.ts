import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sectorId = searchParams.get('sectorId');
    const subSectorId = searchParams.get('subSectorId');

    if (!sectorId) {
      return NextResponse.json(
        { error: 'sectorId is required' },
        { status: 400 }
      );
    }

    // Önce subSector ile dene
    let benchmark = null;
    
    if (subSectorId) {
      benchmark = await prisma.ironmanBenchmark.findFirst({
        where: {
          sectorId,
          subSectorId,
        },
      });
    }

    // SubSector bulunamazsa sektör geneli ile dene
    if (!benchmark) {
      benchmark = await prisma.ironmanBenchmark.findFirst({
        where: {
          sectorId,
          subSectorId: null,
        },
      });
    }

    /**
     * Kıyas kaydı yoksa sayı uydurulmaz.
     *
     * Burada eskiden sektör kimliğinin karakter kodları toplanıp ondan bir
     * "tahmin" türetiliyordu ve `isEstimated: true` ile dönüyordu; o alanı
     * arayüz hiç okumadığı için uydurma sayılar gerçek sektör ortalamasıyla
     * aynı yerde gösteriliyordu. Ürünün vaadi ölçüm; ölçülmemiş şey için
     * doğru cevap "veri yok"tur.
     */
    if (!benchmark) {
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
        select: { name: true },
      });

      return NextResponse.json({
        hasBenchmark: false,
        sectorId,
        sectorName: sector?.name ?? null,
        subSectorId: subSectorId || null,
        current: null,
        target: null,
        best: null,
      });
    }

    return NextResponse.json({
      hasBenchmark: true,
      sectorId: benchmark.sectorId,
      subSectorId: benchmark.subSectorId,
      /** Alt sektör kaydı yoksa sektör geneline düşüldüğü açıkça bildirilir. */
      source: benchmark.subSectorId ? 'subSector' : 'sector',
      current: {
        velocity: benchmark.velocityAverage,
        endurance: benchmark.enduranceAverage,
      },
      target: {
        velocity: benchmark.velocityAverageTarget,
        endurance: benchmark.enduranceAverageTarget,
      },
      best: {
        velocity: benchmark.velocityBest,
        endurance: benchmark.enduranceBest,
      },
    });
  } catch (error) {
    console.error('Error fetching ironman benchmark:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benchmark' },
      { status: 500 }
    );
  }
}
