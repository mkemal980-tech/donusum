import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch sector category weights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sectorId");
    const surveyId = searchParams.get("surveyId");

    if (sectorId && surveyId) {
      // Get weights for specific sector and survey
      const weights = await prisma.sectorCategoryWeight.findMany({
        where: { sectorId, surveyId },
      });
      return NextResponse.json(weights);
    }

    // Get all weights
    const weights = await prisma.sectorCategoryWeight.findMany({
      orderBy: [{ sectorId: "asc" }, { surveyId: "asc" }],
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
    const { sectorId, surveyId, weights } = await request.json();

    if (!sectorId || !surveyId || !weights || !Array.isArray(weights)) {
      return NextResponse.json(
        { error: "Sektör ID, Anket ID ve ağırlıklar gerekli" },
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

    // Delete existing weights for this sector and survey
    await prisma.sectorCategoryWeight.deleteMany({
      where: { sectorId, surveyId },
    });

    // Create new weights
    const createdWeights = await prisma.sectorCategoryWeight.createMany({
      data: weights.map((w: any) => ({
        sectorId,
        surveyId,
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

// DELETE - Remove all weights for a sector and survey
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get("sectorId");
    const surveyId = searchParams.get("surveyId");

    if (!sectorId || !surveyId) {
      return NextResponse.json({ error: "Sektör ID ve Anket ID gerekli" }, { status: 400 });
    }

    await prisma.sectorCategoryWeight.deleteMany({
      where: { sectorId, surveyId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sector weights:", error);
    return NextResponse.json({ error: "Failed to delete sector weights" }, { status: 500 });
  }
}
