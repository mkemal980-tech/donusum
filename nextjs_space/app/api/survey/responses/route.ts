export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;

    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        documents: true
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { questionId, value } = body ?? {};

    if (!questionId || value === undefined) {
      return NextResponse.json(
        { error: "Question ID and value are required" },
        { status: 400 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId }
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    let score = 0;
    if (question?.type === 'SCALE') {
      score = parseFloat(value) || 0;
    } else if (question?.type === 'YES_NO') {
      score = value === 'yes' ? 5 : 1;
    } else if (question?.type === 'MULTIPLE_CHOICE') {
      const options = question?.options as any[];
      const selected = options?.find((o: any) => o?.value === value);
      score = selected?.score ?? 0;
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