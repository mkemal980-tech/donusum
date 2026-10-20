export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { calculateRecommendationContributions, getAccessibleSurveyIds, getRecommendationsForUser } from "@/lib/scoring";
import { getAssessmentIds } from "@/lib/assessment";
import { loadRoadmapAccess } from "@/lib/roadmap-access";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    // Anket verilmezse kullanıcının erişebildiği tüm anketler kapsanır.
    const surveyId = new URL(request.url).searchParams.get("surveyId") ?? undefined;
    const recommendations = await getRecommendationsForUser(userId, { surveyId });

    // Kart, tamamlanınca ne kadar kazandıracağını söyler; hesap motordan gelir.
    // Kart, kullanıcının bu öneride ne yapabileceğini de taşır (bkz. lib/roadmap-access).
    const [{ contributions }, access] = await Promise.all([
      calculateRecommendationContributions(userId, recommendations, { surveyId }),
      getAssessmentIds(userId, surveyId ? [surveyId] : await getAccessibleSurveyIds(userId)).then(ids => loadRoadmapAccess(userId, ids)),
    ]);

    return NextResponse.json(
      (recommendations ?? []).map(rec => ({
        ...rec,
        contribution: contributions.get(rec.id) ?? null,
        canManageRoadmap: access.canManage,
        canUpdateStatus: access.canUpdate(rec.id)
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
