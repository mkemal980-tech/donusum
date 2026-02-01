export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { calculateUserScore } from "@/lib/scoring";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
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
