export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { calculateUserScore } from "@/lib/scoring";
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
