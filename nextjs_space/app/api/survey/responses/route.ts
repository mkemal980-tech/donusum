export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

const TEST_USER_ID = "cmkzye325000tmo085fruemez";

async function getUserId() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user) {
      return (session.user as any)?.id || TEST_USER_ID;
    }
  } catch (e) {}
  return TEST_USER_ID;
}

export async function GET() {
  try {
    const userId = await getUserId();

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
    const userId = await getUserId();
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
