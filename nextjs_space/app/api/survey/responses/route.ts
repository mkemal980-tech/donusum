export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateSurveyAccess, withAuth } from "@/lib/api-utils";
import { buildSurveyQuestionWhere, getAccessibleSurveyIds, scoreResponse } from "@/lib/scoring";
import {
  getAssessmentIds,
  getOrCreateAssessment,
  getSectionVisibility,
} from "@/lib/assessment";
import { sectionOfQuestion } from "@/lib/section-assignment";

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
            // Sorunun hangi bölüme ait olduğu görev dağılımı için gerekli.
            subCategoryId: true,
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

    // Doğrulama ve puanlama tek kaynakta (bkz. lib/scoring > scoreResponse):
    // aralık dışı ölçek değeri ya da tanımsız şık artık sessizce kaydedilmez.
    const scored = scoreResponse(question, value);
    if (!scored.ok) {
      return NextResponse.json({ error: scored.error }, { status: 400 });
    }
    const score = scored.score;

    if (!surveyId) {
      return NextResponse.json(
        { error: "Soru bir ankete bağlı değil." },
        { status: 400 }
      );
    }

    /**
     * Görev dağılımı yaptırımı burada; ekranda bölümü gizlemek yalnızca
     * kolaylık. Kendisine atanmayan bir bölüme cevap yazan istek, dağıtımın
     * tek sorumlu kuralını sessizce delerdi.
     */
    const visibility = await getSectionVisibility(userId, surveyId);

    // Gönderilmiş değerlendirme kilitlidir; yönetici de dahil kimse yazamaz.
    // Düzeltme gerekiyorsa koordinatör gönderimi geri alır.
    if (visibility.locked) {
      return NextResponse.json(
        { error: "Bu değerlendirme gönderildi ve kilitlendi." },
        { status: 403 }
      );
    }

    const sectionId = sectionOfQuestion(question);
    const allowed = sectionId ? visibility.canSee(sectionId) : visibility.canSeeDirect;

    if (!allowed) {
      return NextResponse.json(
        { error: "Bu bölüm size atanmadı. Koordinatörünüzle görüşün." },
        { status: 403 }
      );
    }

    const assessmentId = await getOrCreateAssessment(userId, surveyId);

    const response = await prisma.surveyResponse.upsert({
      where: {
        assessmentId_questionId: { assessmentId, questionId }
      },
      update: {
        value: scored.value,
        score,
        // Cevabı en son kimin güncellediği denetim izi olarak tutulur.
        answeredById: userId
      },
      create: {
        assessmentId,
        questionId,
        value: scored.value,
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
