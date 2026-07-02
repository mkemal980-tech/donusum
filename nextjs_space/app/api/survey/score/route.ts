export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { calculateUserScore } from "@/lib/scoring";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const scoreData = await calculateUserScore(userId);

    await prisma.assessmentScore.create({
      data: {
        userId,
        totalScore: scoreData?.totalScore ?? 0,
        categoryScores: scoreData?.categoryScores ?? {}
      }
    });

    return NextResponse.json(scoreData);
  } catch (error) {
    console.error("Error calculating score:", error);
    return NextResponse.json(
      { error: "Failed to calculate score" },
      { status: 500 }
    );
  }
}
