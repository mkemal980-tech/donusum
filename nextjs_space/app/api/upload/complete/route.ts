export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
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
      const response = await prisma.surveyResponse.findUnique({
        where: {
          userId_questionId: {
            userId,
            questionId
          }
        },
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
      const response = await prisma.surveyResponse.findUnique({
        where: { id: linkedResponseId },
        select: { userId: true }
      });

      if (!response || response.userId !== userId) {
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
