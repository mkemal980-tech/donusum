export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subCategoryId = searchParams.get('subCategoryId');
    
    const where = subCategoryId ? { subCategoryId } : {};
    const subLevels = await prisma.subLevel.findMany({
      where,
      include: {
        subCategory: { include: { category: true } },
        questions: { orderBy: { order: 'asc' } }
      },
      orderBy: { order: 'asc' }
    });
    return NextResponse.json(subLevels);
  } catch (error) {
    console.error("Error fetching sublevels:", error);
    return NextResponse.json({ error: "Failed to fetch sublevels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, subCategoryId, order, axisType } = body;

    const subLevel = await prisma.subLevel.create({
      data: { 
        name, 
        subCategoryId, 
        order: order || 1,
        axisType: axisType || 'VELOCITY'
      }
    });
    return NextResponse.json(subLevel);
  } catch (error) {
    console.error("Error creating sublevel:", error);
    return NextResponse.json({ error: "Failed to create sublevel" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, subCategoryId, order, axisType } = body;

    const subLevel = await prisma.subLevel.update({
      where: { id },
      data: { name, subCategoryId, order, axisType }
    });
    return NextResponse.json(subLevel);
  } catch (error) {
    console.error("Error updating sublevel:", error);
    return NextResponse.json({ error: "Failed to update sublevel" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.subLevel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sublevel:", error);
    return NextResponse.json({ error: "Failed to delete sublevel" }, { status: 500 });
  }
}
