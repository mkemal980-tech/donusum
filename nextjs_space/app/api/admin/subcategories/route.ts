export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { archiveSubCategory } from "@/lib/soft-delete";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { name, description, order, categoryId, hasSubLevels } = body;

    const subCategory = await prisma.subCategory.create({
      data: { 
        name, 
        description, 
        order: order || 1, 
        categoryId,
        hasSubLevels: hasSubLevels ?? true
      }
    });
    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error creating subcategory:", error);
    return NextResponse.json({ error: "Failed to create subcategory" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, name, description, order, hasSubLevels } = body;

    const subCategory = await prisma.subCategory.update({
      where: { id },
      data: { name, description, order, hasSubLevels }
    });
    return NextResponse.json(subCategory);
  } catch (error) {
    console.error("Error updating subcategory:", error);
    return NextResponse.json({ error: "Failed to update subcategory" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await archiveSubCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subcategory:", error);
    return NextResponse.json({ error: "Failed to delete subcategory" }, { status: 500 });
  }
}
