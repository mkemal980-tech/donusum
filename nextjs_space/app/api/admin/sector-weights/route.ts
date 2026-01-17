import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch sector category weights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sectorId");

    if (sectorId) {
      // Get weights for specific sector
      const weights = await prisma.sectorCategoryWeight.findMany({
        where: { sectorId },
      });
      return NextResponse.json(weights);
    }

    // Get all weights grouped by sector
    const weights = await prisma.sectorCategoryWeight.findMany({
      orderBy: { sectorId: "asc" },
    });
    return NextResponse.json(weights);
  } catch (error) {
    console.error("Error fetching sector weights:", error);
    return NextResponse.json({ error: "Failed to fetch sector weights" }, { status: 500 });
  }
}

// POST - Create or update sector category weights
export async function POST(request: NextRequest) {
  try {
    const { sectorId, weights } = await request.json();

    if (!sectorId || !weights || !Array.isArray(weights)) {
      return NextResponse.json(
        { error: "Sektör ID ve ağırlıklar gerekli" },
        { status: 400 }
      );
    }

    // Validate total weight is approximately 1 (100%)
    const totalWeight = weights.reduce((sum: number, w: any) => sum + (w.weight || 0), 0);
    if (Math.abs(totalWeight - 1) > 0.01) {
      return NextResponse.json(
        { error: `Toplam ağırlık 100% olmalıdır (mevcut: ${(totalWeight * 100).toFixed(1)}%)` },
        { status: 400 }
      );
    }

    // Delete existing weights for this sector
    await prisma.sectorCategoryWeight.deleteMany({
      where: { sectorId },
    });

    // Create new weights
    const createdWeights = await prisma.sectorCategoryWeight.createMany({
      data: weights.map((w: any) => ({
        sectorId,
        categoryId: w.categoryId,
        weight: w.weight,
      })),
    });

    return NextResponse.json({ success: true, count: createdWeights.count });
  } catch (error) {
    console.error("Error saving sector weights:", error);
    return NextResponse.json({ error: "Failed to save sector weights" }, { status: 500 });
  }
}

// DELETE - Remove all weights for a sector
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sectorId");

    if (!sectorId) {
      return NextResponse.json({ error: "Sektör ID gerekli" }, { status: 400 });
    }

    await prisma.sectorCategoryWeight.deleteMany({
      where: { sectorId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sector weights:", error);
    return NextResponse.json({ error: "Failed to delete sector weights" }, { status: 500 });
  }
}
