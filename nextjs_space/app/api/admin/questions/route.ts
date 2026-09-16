export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { archiveQuestion } from "@/lib/soft-delete";
import {
  canEditSurvey,
  surveyIdForCategory,
  surveyIdForQuestion,
  surveyIdForSubCategory,
  surveyIdForSubLevel,
} from "@/lib/survey-management";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { text, type, options, conditionalOptions, order, requiresEvidence, subLevelId, subCategoryId, categoryId, weight, axisType } = body;

    // En az biri gerekli: categoryId, subCategoryId veya subLevelId
    if (!categoryId && !subLevelId && !subCategoryId) {
      return NextResponse.json({ error: "categoryId, subCategoryId veya subLevelId gerekli" }, { status: 400 });
    }
    const surveyId = categoryId
      ? await surveyIdForCategory(categoryId)
      : subCategoryId
        ? await surveyIdForSubCategory(subCategoryId)
        : await surveyIdForSubLevel(subLevelId);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu ankete soru ekleme yetkiniz yok' }, { status: 403 });
    }

    const question = await prisma.question.create({
      data: { 
        text, 
        type: type || 'SCALE', 
        options, 
        conditionalOptions,  // Kademeli puanlama seçenekleri
        order: order || 1, 
        requiresEvidence: requiresEvidence || false,
        categoryId: categoryId || null,      // Doğrudan kategoriye bağlı sorular
        subLevelId: subLevelId || null,
        subCategoryId: subCategoryId || null,
        weight: weight || 1.0,
        axisType: axisType || 'VELOCITY'  // Ironman için eksen tipi
      }
    });
    return NextResponse.json(question);
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, text, type, options, conditionalOptions, order, requiresEvidence, weight, axisType } = body;
    const surveyId = await surveyIdForQuestion(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu soruyu düzenleme yetkiniz yok' }, { status: 403 });
    }

    const question = await prisma.question.update({
      where: { id },
      data: { 
        text, 
        type, 
        options, 
        conditionalOptions,  // Kademeli puanlama seçenekleri
        order, 
        requiresEvidence, 
        weight: weight || 1.0,
        axisType: axisType || 'VELOCITY'  // Ironman için eksen tipi
      }
    });
    return NextResponse.json(question);
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    const surveyId = await surveyIdForQuestion(id);
    if (auth.user.role !== 'ADMIN' && (!surveyId || !(await canEditSurvey(auth.userId, auth.user.role, surveyId)))) {
      return NextResponse.json({ error: 'Bu soruyu silme yetkiniz yok' }, { status: 403 });
    }

    await archiveQuestion(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
