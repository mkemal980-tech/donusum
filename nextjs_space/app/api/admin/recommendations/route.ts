export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const recommendations = await prisma.recommendation.findMany({
      include: {
        question: {
          select: {
            id: true,
            text: true,
            type: true,
            options: true,
            subLevel: {
              select: {
                id: true,
                name: true,
                subCategory: {
                  select: {
                    id: true,
                    name: true,
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
            },
            subCategory: {
              select: {
                id: true,
                name: true,
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
        },
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
        },
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
    const { 
      title, description, categoryId, subCategoryId, subLevelId, 
      questionId, triggerOptions,
      costType, timeframe, strategicType, estimatedImpact, 
      minScoreThreshold, maxScoreThreshold, order,
      xPosition, yPosition, capexLevel, opexLevel
    } = body;

    // QuestionId varsa geçerli mi kontrol et
    let validQuestionId = null;
    if (questionId) {
      const questionExists = await prisma.question.findUnique({
        where: { id: questionId }
      });
      if (questionExists) {
        validQuestionId = questionId;
      }
    }

    const recommendation = await prisma.recommendation.create({
      data: {
        title: title || "",
        description: description || "",
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        subLevelId: subLevelId || null,
        questionId: validQuestionId,
        triggerOptions: validQuestionId && triggerOptions && triggerOptions.length > 0 
          ? JSON.stringify(triggerOptions) 
          : null,
        costType: costType || "OPEX",
        timeframe: timeframe || "SHORT_TERM",
        strategicType: strategicType || "QUICK_WIN",
        estimatedImpact: estimatedImpact || 1,
        minScoreThreshold: minScoreThreshold ?? 0,
        maxScoreThreshold: maxScoreThreshold ?? 100,
        order: order || 1,
        xPosition: xPosition ?? 5,
        yPosition: yPosition ?? 5,
        capexLevel: capexLevel ?? 1,
        opexLevel: opexLevel ?? 1
      }
    });
    return NextResponse.json(recommendation);
  } catch (error: any) {
    console.error("Error creating recommendation:", error);
    return NextResponse.json({ 
      error: "Failed to create recommendation", 
      details: error?.message || "Unknown error" 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, title, description, categoryId, subCategoryId, subLevelId, 
      questionId, triggerOptions,
      costType, timeframe, strategicType, estimatedImpact, 
      minScoreThreshold, maxScoreThreshold, order,
      xPosition, yPosition, capexLevel, opexLevel
    } = body;

    // QuestionId varsa geçerli mi kontrol et
    let validQuestionId = null;
    if (questionId) {
      const questionExists = await prisma.question.findUnique({
        where: { id: questionId }
      });
      if (questionExists) {
        validQuestionId = questionId;
      }
    }

    const recommendation = await prisma.recommendation.update({
      where: { id },
      data: {
        title: title || "",
        description: description || "",
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        subLevelId: subLevelId || null,
        questionId: validQuestionId,
        triggerOptions: validQuestionId && triggerOptions && triggerOptions.length > 0 
          ? JSON.stringify(triggerOptions) 
          : null,
        costType: costType || "OPEX",
        timeframe: timeframe || "SHORT_TERM",
        strategicType: strategicType || "QUICK_WIN",
        estimatedImpact: estimatedImpact ?? 1,
        minScoreThreshold: minScoreThreshold ?? 0,
        maxScoreThreshold: maxScoreThreshold ?? 100,
        order: order ?? 1,
        xPosition: xPosition ?? 5,
        yPosition: yPosition ?? 5,
        capexLevel: capexLevel ?? 1,
        opexLevel: opexLevel ?? 1
      }
    });
    return NextResponse.json(recommendation);
  } catch (error: any) {
    console.error("Error updating recommendation:", error);
    return NextResponse.json({ 
      error: "Failed to update recommendation", 
      details: error?.message || "Unknown error" 
    }, { status: 500 });
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
