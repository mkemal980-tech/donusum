import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sectorId");
    const subSectorId = searchParams.get("subSectorId");

    const where: any = {};
    if (sectorId) where.sectorId = sectorId;
    if (subSectorId) where.subSectorId = subSectorId;

    const benchmarks = await prisma.benchmark.findMany({
      where,
      include: {
        sector: true,
        subSector: true
      },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }]
    });

    return NextResponse.json(benchmarks);
  } catch (error) {
    console.error("Error fetching benchmarks:", error);
    return NextResponse.json({ error: "Failed to fetch benchmarks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sectorId, subSectorId, level, targetId, bestScore, averageScore } = await request.json();
    
    if (!sectorId || !level) {
      return NextResponse.json({ error: "Sektör ve seviye gerekli" }, { status: 400 });
    }

    // Upsert benchmark
    const benchmark = await prisma.benchmark.upsert({
      where: {
        sectorId_subSectorId_level_targetId: {
          sectorId,
          subSectorId: subSectorId || null,
          level,
          targetId: targetId || null
        }
      },
      update: {
        bestScore: bestScore || 0,
        averageScore: averageScore || 0
      },
      create: {
        sectorId,
        subSectorId: subSectorId || null,
        level,
        targetId: targetId || null,
        bestScore: bestScore || 0,
        averageScore: averageScore || 0
      },
      include: {
        sector: true,
        subSector: true
      }
    });

    return NextResponse.json(benchmark);
  } catch (error) {
    console.error("Error creating/updating benchmark:", error);
    return NextResponse.json({ error: "Failed to save benchmark" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "ID gerekli" }, { status: 400 });
    }

    await prisma.benchmark.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting benchmark:", error);
    return NextResponse.json({ error: "Failed to delete benchmark" }, { status: 500 });
  }
}
