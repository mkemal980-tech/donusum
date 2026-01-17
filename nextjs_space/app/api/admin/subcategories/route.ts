export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    
    const where = categoryId ? { categoryId } : {};
    const subCategories = await prisma.subCategory.findMany({
      where,
      include: {
        category: true,
        subLevels: { include: { questions: true }, orderBy: { order: 'asc' } }
      },
      orderBy: { order: 'asc' }
    });
    return NextResponse.json(subCategories);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    return NextResponse.json({ error: "Failed to fetch subcategories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, categoryId, order } = body;

    const subCategory = await prisma.subCategory.create({
      data: { name, categoryId, order: order || 1 }
    });
    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, categoryId, order } = body;

    const subCategory = await prisma.subCategory.update({
      where: { id },
      data: { name, categoryId, order }
    });
    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.subCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
  }
}
