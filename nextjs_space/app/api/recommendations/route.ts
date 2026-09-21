export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { calculateRecommendationContributions, getRecommendationsForUser } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    // Anket verilmezse kullanıcının erişebildiği tüm anketler kapsanır.
    const surveyId = new URL(request.url).searchParams.get("surveyId") ?? undefined;
    const recommendations = await getRecommendationsForUser(userId, { surveyId });

    // Kart, tamamlanınca ne kadar kazandıracağını söyler; hesap motordan gelir.
    const { contributions } = await calculateRecommendationContributions(
      userId,
      recommendations,
      { surveyId }
    );

    return NextResponse.json(
      (recommendations ?? []).map(rec => ({
        ...rec,
        contribution: contributions.get(rec.id) ?? null
      }))
    );
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
