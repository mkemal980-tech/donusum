export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subLevelId = searchParams.get('subLevelId');
    
    const where = subLevelId ? { subLevelId } : {};
    const questions = await prisma.question.findMany({
      where,
      include: {
        subLevel: {
          include: {
            subCategory: {
              include: { category: true }
            }
          }
        }
      },
      orderBy: { order: 'asc' }
    });
    return NextResponse.json(questions);
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, type, requiresEvidence, options, subLevelId, order } = body;

    const question = await prisma.question.create({
      data: {
        text,
        type,
        requiresEvidence: requiresEvidence || false,
        options: options || undefined,
        subLevelId,
        order: order || 1
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
    const { id, text, type, requiresEvidence, options, subLevelId, order } = body;

    const question = await prisma.question.update({
      where: { id },
      data: {
        text,
        type,
        requiresEvidence,
        options: options || undefined,
        subLevelId,
        order
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
