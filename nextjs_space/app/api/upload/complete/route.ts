export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { getAccessibleSurveyIds } from "@/lib/scoring";
import { getAssessmentIds } from "@/lib/assessment";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { rateLimit: 'upload' });
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { cloudStoragePath, isPublic, fileName, fileType, responseId, questionId } = body ?? {};

    if (!cloudStoragePath || !fileName) {
      return NextResponse.json(
        { error: "Cloud storage path and file name are required" },
        { status: 400 }
      );
    }

    let linkedResponseId: string | null = responseId ?? null;

    if (questionId) {
      // Cevap kuruluşun değerlendirmesine bağlı; aynı kuruluştaki başka bir
      // kullanıcının girdiği cevaba da belge eklenebilir.
      const assessmentIds = await getAssessmentIds(
        userId,
        await getAccessibleSurveyIds(userId)
      );

      const response = await prisma.surveyResponse.findFirst({
        where: { assessmentId: { in: assessmentIds }, questionId },
        select: { id: true }
      });

      if (!response) {
        return NextResponse.json(
          { error: "Dosya yüklemeden önce bu soruya cevap vermelisiniz." },
          { status: 400 }
        );
      }

      linkedResponseId = response.id;
    } else if (linkedResponseId) {
      const assessmentIds = await getAssessmentIds(
        userId,
        await getAccessibleSurveyIds(userId)
      );

      const response = await prisma.surveyResponse.findUnique({
        where: { id: linkedResponseId },
        select: { assessmentId: true }
      });

      // Yetki artık kişiye değil değerlendirmeye bakar: aynı kuruluşun
      // cevabına belge eklenebilir, başka kuruluşunkine eklenemez.
      if (!response || !assessmentIds.includes(response.assessmentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const document = await prisma.document.create({
      data: {
        userId,
        cloudStoragePath,
        isPublic: isPublic ?? true,
        fileName,
        fileType: fileType ?? 'application/octet-stream',
        responseId: linkedResponseId
      }
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error completing upload:", error);
    return NextResponse.json(
      { error: "Failed to complete upload" },
      { status: 500 }
    );
  }
}
