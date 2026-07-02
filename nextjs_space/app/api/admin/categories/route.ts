export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { archiveCategory } from "@/lib/soft-delete";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    const whereClause = { archivedAt: null, ...(surveyId ? { surveyId } : {}) };

    const categories = await prisma.category.findMany({
      where: whereClause,
      include: {
        survey: {
          select: { id: true, name: true }
        },
        // Kategoriye doğrudan bağlı sorular
        questions: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' }
        },
        subCategories: {
          where: { archivedAt: null },
          include: {
            subLevels: {
              where: { archivedAt: null },
              select: {
                id: true,
                name: true,
                description: true,
                order: true,
                axisType: true,
                questions: {
                  where: { archivedAt: null },
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            },
            questions: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { order: 'asc' }
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { name, description, order, surveyId } = body;

    const category = await prisma.category.create({
      data: { 
        name, 
        description, 
        order: order || 1,
        surveyId: surveyId || null
      }
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, name, description, order, surveyId } = body;

    const category = await prisma.category.update({
      where: { id },
      data: { name, description, order, surveyId }
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await archiveCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
