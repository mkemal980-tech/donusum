export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getRecommendationsForUser } from "@/lib/scoring";

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
    const recommendations = await getRecommendationsForUser(userId);

    return NextResponse.json(recommendations ?? []);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
