export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, type, options, conditionalOptions, order, requiresEvidence, subLevelId, subCategoryId, weight, axisType } = body;

    // En az biri gerekli: subLevelId veya subCategoryId
    if (!subLevelId && !subCategoryId) {
      return NextResponse.json({ error: "subLevelId veya subCategoryId gerekli" }, { status: 400 });
    }

    const question = await prisma.question.create({
      data: { 
        text, 
        type: type || 'SCALE', 
        options, 
        conditionalOptions,  // Kademeli puanlama seçenekleri
        order: order || 1, 
        requiresEvidence: requiresEvidence || false,
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
  try {
    const body = await request.json();
    const { id, text, type, options, conditionalOptions, order, requiresEvidence, weight, axisType } = body;

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
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
