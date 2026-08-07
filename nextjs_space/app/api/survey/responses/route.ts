export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { buildSurveyQuestionWhere, getAccessibleSurveyIds, scoreConditionalChoice } from "@/lib/scoring";
import { getAssessmentIds, getOrCreateAssessment } from "@/lib/assessment";

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
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;
  const userRole = auth.user.role;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');
    const countOnly = searchParams.get('countOnly') === 'true';

    if (surveyId) {
      const accessError = await validateSurveyAccess(userId, userRole, surveyId);
      if (accessError) return accessError;
    }

    // Cevaplar kuruluşun değerlendirmesine bağlı: aynı kuruluştaki başka bir
    // kullanıcının girdiği cevaplar da bu listede görünür.
    const assessmentIds = await getAssessmentIds(
      userId,
      surveyId ? [surveyId] : await getAccessibleSurveyIds(userId)
    );
    const whereCondition: any = { assessmentId: { in: assessmentIds } };
    
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
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;
  const userRole = auth.user.role;

  try {
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
      // { threshold: 'yes'|'no', selected: string[] } → puan (5 ile sınırlı)
      score = scoreConditionalChoice(
        String(value),
        question?.conditionalOptions as any
      );
    }

    if (!surveyId) {
      return NextResponse.json(
        { error: "Soru bir ankete bağlı değil." },
        { status: 400 }
      );
    }

    const assessmentId = await getOrCreateAssessment(userId, surveyId);

    const response = await prisma.surveyResponse.upsert({
      where: {
        assessmentId_questionId: { assessmentId, questionId }
      },
      update: {
        value: String(value),
        score,
        // Cevabı en son kimin güncellediği denetim izi olarak tutulur.
        answeredById: userId
      },
      create: {
        assessmentId,
        questionId,
        value: String(value),
        score,
        answeredById: userId
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
