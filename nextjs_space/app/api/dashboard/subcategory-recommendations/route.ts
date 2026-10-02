export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getRecommendationsForUser } from "@/lib/scoring";
import {
  rankStartingRecommendations,
  recommendationReasons,
  type RecommendationPriorityInput,
} from "@/lib/recommendation-priority";

type RecommendationRow = RecommendationPriorityInput & {
  subCategoryId: string | null;
  resolvedSubCategoryId?: string | null;
  subLevel?: { subCategoryId?: string | null } | null;
  question?: { subCategoryId?: string | null } | null;
  isInRoadmap?: boolean;
};

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  const surveyId = new URL(request.url).searchParams.get("surveyId");
  if (!surveyId) {
    return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
  }

  try {
    const recommendations = (await getRecommendationsForUser(auth.userId, { surveyId })) as RecommendationRow[];
    const grouped = new Map<string, RecommendationRow[]>();

    for (const recommendation of recommendations) {
      const subCategoryId =
        recommendation.resolvedSubCategoryId ??
        recommendation.subCategoryId ??
        recommendation.subLevel?.subCategoryId ??
        recommendation.question?.subCategoryId ??
        null;
      if (!subCategoryId) continue;
      const rows = grouped.get(subCategoryId) ?? [];
      rows.push(recommendation);
      grouped.set(subCategoryId, rows);
    }

    return NextResponse.json({
      groups: Object.fromEntries(
        [...grouped.entries()].map(([subCategoryId, rows]) => {
          const ranked = rankStartingRecommendations(rows);
          return [
            subCategoryId,
            {
              total: rows.length,
              recommendations: ranked.slice(0, 3).map((recommendation) => ({
                id: recommendation.id,
                title: recommendation.title,
                description: recommendation.description,
                strategicType: recommendation.strategicType,
                timeframe: recommendation.timeframe,
                costType: recommendation.costType,
                estimatedImpact: recommendation.estimatedImpact,
                isInRoadmap: Boolean(recommendation.isInRoadmap),
                isActionable: recommendation.isActionable !== false,
                stepDistance: recommendation.stepDistance ?? 0,
                reasons: recommendationReasons(recommendation),
              })),
            },
          ];
        })
      ),
    });
  } catch (error) {
    console.error("Error fetching subcategory recommendations:", error);
    return NextResponse.json({ error: "Alt kategori önerileri alınamadı" }, { status: 500 });
  }
}
