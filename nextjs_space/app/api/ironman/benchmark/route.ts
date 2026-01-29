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

    // Sektör benchmark'ı da yoksa tahmini değerler döndür
    if (!benchmark) {
      // Sektör adını al
      const sector = await prisma.sector.findUnique({
        where: { id: sectorId },
        select: { name: true },
      });

      // Tahmini değerler - sektöre göre küçük varyasyonlar
      const sectorHash = sectorId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const variance = (sectorHash % 10) / 10; // 0-0.9 arası varyans
      
      return NextResponse.json({
        sectorId,
        sectorName: sector?.name || 'Bilinmeyen Sektör',
        subSectorId: subSectorId || null,
        current: {
          velocity: 2.0 + variance * 0.8,
          endurance: 2.2 + variance * 0.7,
        },
        target: {
          velocity: 3.2 + variance * 0.6,
          endurance: 3.4 + variance * 0.5,
        },
        isEstimated: true,
      });
    }

    return NextResponse.json({
      sectorId: benchmark.sectorId,
      subSectorId: benchmark.subSectorId,
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
      isEstimated: false,
    });
  } catch (error) {
    console.error('Error fetching ironman benchmark:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benchmark' },
      { status: 500 }
    );
  }
}
