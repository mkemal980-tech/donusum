export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { archiveSubLevel } from "@/lib/soft-delete";
import { canEditSurvey, surveyIdForSubCategory, surveyIdForSubLevel } from "@/lib/survey-management";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const subCategoryId = searchParams.get('subCategoryId');
    if (auth.user.role !== 'ADMIN') {
      const surveyId = subCategoryId ? await surveyIdForSubCategory(subCategoryId) : null;
      if (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId))) {
        return NextResponse.json({ error: 'Bu anketin seviyelerini görme yetkiniz yok' }, { status: 403 });
      }
    }
    
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
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { name, subCategoryId, order, axisType } = body;
    const surveyId = await surveyIdForSubCategory(subCategoryId);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu ankete seviye ekleme yetkiniz yok' }, { status: 403 });
    }

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
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, name, subCategoryId, order, axisType } = body;
    const surveyId = await surveyIdForSubLevel(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu seviyeyi düzenleme yetkiniz yok' }, { status: 403 });
    }
    if (subCategoryId) {
      const targetSurveyId = await surveyIdForSubCategory(subCategoryId);
      if (!targetSurveyId || !(await canEditSurvey(auth.userId, auth.user.role, targetSurveyId))) {
        return NextResponse.json({ error: 'Hedef bölümü yönetme yetkiniz yok' }, { status: 403 });
      }
    }

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
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const surveyId = await surveyIdForSubLevel(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu seviyeyi silme yetkiniz yok' }, { status: 403 });
    }

    await archiveSubLevel(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting sublevel:", error);
    return NextResponse.json({ error: "Failed to delete sublevel" }, { status: 500 });
  }
}
