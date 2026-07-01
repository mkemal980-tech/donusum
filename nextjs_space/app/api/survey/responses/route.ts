export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { buildSurveyQuestionWhere } from "@/lib/scoring";

async function validateSurveyAccess(userId: string, role: string, surveyId: string) {
  if (role === "ADMIN") return null;

  const assignment = await prisma.userSurveyAssignment.findUnique({
    where: { userId_surveyId: { userId, surveyId } },
    include: {
      survey: {
        select: { isActive: true }
      }
    }
  });

  if (!assignment || !assignment.isActive || !assignment.survey.isActive) {
    return NextResponse.json(
      { error: "Bu ankete erişim yetkiniz yok." },
      { status: 403 }
    );
  }

  if (assignment.hasDeadline && assignment.deadline && assignment.deadline < new Date()) {
    return NextResponse.json(
      { error: "Bu anketin süresi dolmuş." },
      { status: 403 }
    );
  }

  return null;
}

function getQuestionSurveyId(question: {
  category?: { surveyId: string | null } | null;
  subCategory?: { category?: { surveyId: string | null } | null } | null;
  subLevel?: { subCategory?: { category?: { surveyId: string | null } | null } | null } | null;
}) {
  return (
    question.category?.surveyId ??
    question.subCategory?.category?.surveyId ??
    question.subLevel?.subCategory?.category?.surveyId ??
    null
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    const countOnly = searchParams.get('countOnly') === 'true';

    if (surveyId) {
      const accessError = await validateSurveyAccess(userId, userRole, surveyId);
      if (accessError) return accessError;
    }

    // Survey filtresi için where koşulu oluştur
    const whereCondition: any = { userId };
    
    if (surveyId) {
      whereCondition.question = buildSurveyQuestionWhere(surveyId);
    }

    // Sadece sayı isteniyorsa count döndür
    if (countOnly) {
      const count = await prisma.surveyResponse.count({ where: whereCondition });
      return NextResponse.json({ count });
    }

    const responses = await prisma.surveyResponse.findMany({
      where: whereCondition,
      include: {
        documents: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    return NextResponse.json(responses ?? []);
  } catch (error) {
    console.error("Error fetching responses:", error);
    return NextResponse.json(
      { error: "Failed to fetch responses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;
    const body = await request.json();
    const { questionId, value } = body ?? {};

    if (!questionId || value === undefined) {
      return NextResponse.json(
        { error: "Question ID and value are required" },
        { status: 400 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        category: { select: { surveyId: true } },
        subCategory: {
          select: {
            category: { select: { surveyId: true } }
          }
        },
        subLevel: {
          select: {
            subCategory: {
              select: {
                category: { select: { surveyId: true } }
              }
            }
          }
        }
      }
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    const surveyId = getQuestionSurveyId(question);
    if (!surveyId && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Soru aktif bir ankete bağlı değil." },
        { status: 400 }
      );
    }

    if (surveyId) {
      const accessError = await validateSurveyAccess(userId, userRole, surveyId);
      if (accessError) return accessError;
    }

    let score = 0;
    if (question?.type === 'SCALE') {
      score = parseFloat(value) || 0;
    } else if (question?.type === 'YES_NO') {
      const options = question?.options as any[];
      const selected = options?.find((o: any) => o?.value === value);
      score = selected?.score ?? (value === 'yes' ? 5 : 1);
    } else if (question?.type === 'MULTIPLE_CHOICE') {
      const options = question?.options as any[];
      const selected = options?.find((o: any) => o?.value === value);
      score = selected?.score ?? 0;
    } else if (question?.type === 'CONDITIONAL_CHOICE') {
      // Parse value: { threshold: 'yes'|'no', selected: string[] }
      try {
        const parsedValue = JSON.parse(value);
        if (parsedValue.threshold === 'no') {
          // "Hayır" seçildi, puan 0
          score = 0;
        } else if (parsedValue.threshold === 'yes' && parsedValue.selected) {
          // "Evet" seçildi, seçilen alt seçeneklerin puanlarını topla
          const condOpts = question?.conditionalOptions as any;
          const subOptions = condOpts?.options || [];
          score = parsedValue.selected.reduce((total: number, selectedValue: string) => {
            const option = subOptions.find((o: any) => o.value === selectedValue);
            return total + (option?.score || 0);
          }, 0);
        }
      } catch (e) {
        console.error('Error parsing conditional choice value:', e);
        score = 0;
      }
    }

    const response = await prisma.surveyResponse.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      },
      update: {
        value: String(value),
        score
      },
      create: {
        userId,
        questionId,
        value: String(value),
        score
      }
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error saving response:", error);
    return NextResponse.json(
      { error: "Failed to save response" },
      { status: 500 }
    );
  }
}
