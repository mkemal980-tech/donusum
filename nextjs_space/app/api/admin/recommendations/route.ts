export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const recommendations = await prisma.recommendation.findMany({
      orderBy: { order: 'asc' }
    });
    
    // Get categories to map names
    const categories = await prisma.category.findMany();
    const categoryMap = Object.fromEntries(categories.map(c => [c.id, c]));
    
    const enrichedRecs = recommendations.map(rec => ({
      ...rec,
      category: rec.categoryId ? categoryMap[rec.categoryId] : null
    }));
    
    return NextResponse.json(enrichedRecs);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, categoryId, costType, timeframe, strategicType, estimatedImpact, order } = body;

    const recommendation = await prisma.recommendation.create({
      data: {
        title,
        description,
        categoryId,
        costType,
        timeframe,
        strategicType,
        estimatedImpact: estimatedImpact || 1,
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
    const { id, title, description, categoryId, costType, timeframe, strategicType, estimatedImpact, order } = body;

    const recommendation = await prisma.recommendation.update({
      where: { id },
      data: {
        title,
        description,
        categoryId,
        costType,
        timeframe,
        strategicType,
        estimatedImpact,
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
