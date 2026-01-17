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

    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { cloudStoragePath, isPublic, fileName, fileType, responseId } = body ?? {};

    if (!cloudStoragePath || !fileName) {
      return NextResponse.json(
        { error: "Cloud storage path and file name are required" },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        userId,
        cloudStoragePath,
        isPublic: isPublic ?? false,
        fileName,
        fileType: fileType ?? 'application/octet-stream',
        responseId: responseId ?? null
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