export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const recommendations = await prisma.recommendation.findMany({
      include: {
        subLevel: {
          include: {
            subCategory: {
              include: { 
                category: {
                  select: {
                    id: true,
                    name: true,
                    surveyId: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { order: 'asc' }
    });
    
    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, categoryId, subLevelId, costType, timeframe, strategicType, estimatedImpact, minScoreThreshold, maxScoreThreshold, order } = body;

    const recommendation = await prisma.recommendation.create({
      data: {
        title,
        description,
        categoryId: categoryId || null,
        subLevelId: subLevelId || null,
        costType,
        timeframe,
        strategicType,
        estimatedImpact: estimatedImpact || 1,
        minScoreThreshold: minScoreThreshold || 0,
        maxScoreThreshold: maxScoreThreshold || 100,
        order: order || 1
      }
    });
    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error creating recommendation:", error);
    return NextResponse.json({ error: "Failed to create recommendation" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, description, categoryId, subLevelId, costType, timeframe, strategicType, estimatedImpact, minScoreThreshold, maxScoreThreshold, order } = body;

    const recommendation = await prisma.recommendation.update({
      where: { id },
      data: {
        title,
        description,
        categoryId: categoryId || null,
        subLevelId: subLevelId || null,
        costType,
        timeframe,
        strategicType,
        estimatedImpact,
        minScoreThreshold: minScoreThreshold || 0,
        maxScoreThreshold: maxScoreThreshold || 100,
        order
      }
    });
    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json({ error: "Failed to update recommendation" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.recommendation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recommendation:", error);
    return NextResponse.json({ error: "Failed to delete recommendation" }, { status: 500 });
  }
}
