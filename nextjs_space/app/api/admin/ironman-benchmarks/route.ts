import { withAuth } from "@/lib/api-utils";
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Tüm Ironman benchmark'ları getir (sektöre göre filtrelenebilir)
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId');

    const where = sectorId ? { sectorId } : {};

    const benchmarks = await prisma.ironmanBenchmark.findMany({
      where,
      include: {
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
      orderBy: [
        { sector: { order: 'asc' } },
        { subSector: { order: 'asc' } },
      ],
    });

    return NextResponse.json(benchmarks);
  } catch (error) {
    console.error('Error fetching ironman benchmarks:', error);
    return NextResponse.json({ error: 'Benchmark verileri yüklenemedi' }, { status: 500 });
  }
}

// POST - Yeni Ironman benchmark oluştur veya güncelle (upsert)
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const data = await request.json();
    const { 
      sectorId, subSectorId, 
      velocityAverage, velocityBest, enduranceAverage, enduranceBest,
      velocityAverageTarget, enduranceAverageTarget,
      applyToAllSubSectors 
    } = data;

    if (!sectorId) {
      return NextResponse.json({ error: 'Sektör seçimi zorunludur' }, { status: 400 });
    }

    // Değerlerin 1-5 arasında olduğunu doğrula
    const values = [velocityAverage, velocityBest, enduranceAverage, enduranceBest, velocityAverageTarget, enduranceAverageTarget];
    for (const val of values) {
      if (val < 1 || val > 5) {
        return NextResponse.json({ error: 'Değerler 1-5 arasında olmalıdır' }, { status: 400 });
      }
    }

    const benchmarkData = {
      velocityAverage,
      velocityBest,
      enduranceAverage,
      enduranceBest,
      velocityAverageTarget: velocityAverageTarget || 3.0,
      enduranceAverageTarget: enduranceAverageTarget || 3.0,
    };

    // Tüm alt sektörlere uygula
    if (applyToAllSubSectors) {
      const subSectors = await prisma.subSector.findMany({
        where: { sectorId },
        select: { id: true },
      });

      if (subSectors.length === 0) {
        return NextResponse.json({ error: 'Bu sektörde alt sektör bulunamadı' }, { status: 400 });
      }

      let createdCount = 0;
      for (const sub of subSectors) {
        await prisma.ironmanBenchmark.upsert({
          where: {
            sectorId_subSectorId: {
              sectorId,
              subSectorId: sub.id,
            },
          },
          update: benchmarkData,
          create: {
            sectorId,
            subSectorId: sub.id,
            ...benchmarkData,
          },
        });
        createdCount++;
      }

      return NextResponse.json({ success: true, createdCount });
    }

    // Tek benchmark oluştur
    const benchmark = await prisma.ironmanBenchmark.upsert({
      where: {
        sectorId_subSectorId: {
          sectorId,
          subSectorId: subSectorId || null,
        },
      },
      update: benchmarkData,
      create: {
        sectorId,
        subSectorId: subSectorId || null,
        ...benchmarkData,
      },
      include: {
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(benchmark);
  } catch (error) {
    console.error('Error saving ironman benchmark:', error);
    return NextResponse.json({ error: 'Benchmark kaydedilemedi' }, { status: 500 });
  }
}

// PUT - Mevcut benchmark'ı güncelle
export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const data = await request.json();
    const { 
      id, velocityAverage, velocityBest, enduranceAverage, enduranceBest,
      velocityAverageTarget, enduranceAverageTarget 
    } = data;

    if (!id) {
      return NextResponse.json({ error: 'Benchmark ID gerekli' }, { status: 400 });
    }

    // Değerlerin 1-5 arasında olduğunu doğrula
    const values = [velocityAverage, velocityBest, enduranceAverage, enduranceBest, velocityAverageTarget, enduranceAverageTarget];
    for (const val of values) {
      if (val < 1 || val > 5) {
        return NextResponse.json({ error: 'Değerler 1-5 arasında olmalıdır' }, { status: 400 });
      }
    }

    const benchmark = await prisma.ironmanBenchmark.update({
      where: { id },
      data: {
        velocityAverage,
        velocityBest,
        enduranceAverage,
        enduranceBest,
        velocityAverageTarget: velocityAverageTarget || 3.0,
        enduranceAverageTarget: enduranceAverageTarget || 3.0,
      },
      include: {
        sector: { select: { id: true, name: true } },
        subSector: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(benchmark);
  } catch (error) {
    console.error('Error updating ironman benchmark:', error);
    return NextResponse.json({ error: 'Benchmark güncellenemedi' }, { status: 500 });
  }
}

// DELETE - Benchmark sil
export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Benchmark ID gerekli' }, { status: 400 });
    }

    await prisma.ironmanBenchmark.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ironman benchmark:', error);
    return NextResponse.json({ error: 'Benchmark silinemedi' }, { status: 500 });
  }
}
