export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import {
  calculateRecommendationContributions,
  getAccessibleSurveyIds,
  isRecommendationActionable
} from "@/lib/scoring";
import { getAssessmentIds } from "@/lib/assessment";
import { resolveAssessmentForRecommendation, updateRoadmapStatus } from "@/lib/roadmap-status";

const RECOMMENDATION_INCLUDE = {
  recommendation: {
    include: {
      subLevel: { select: { axisType: true, subCategoryId: true, subCategory: { select: { categoryId: true } } } },
      subCategory: { select: { categoryId: true } }
    }
  }
} as const;

/**
 * Yol haritası: kalemler, öneri başına katkı ve özet.
 *
 * Katkı sunucuda hesaplanır (docs/GELISIM-PUANI.md); ekran yalnızca gösterir.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const assessmentIds = await getAssessmentIds(userId, await getAccessibleSurveyIds(userId));

    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { assessmentId: { in: assessmentIds } },
      include: RECOMMENDATION_INCLUDE,
      orderBy: [
        { plannedYear: 'asc' },
        { plannedQuarter: 'asc' },
        { priority: 'asc' }
      ]
    });

    const { scores, contributions } = await calculateRecommendationContributions(
      userId,
      roadmapItems.map(item => item.recommendation)
    );

    const items = roadmapItems.map(item => ({
      ...item,
      contribution: contributions.get(item.recommendationId) ?? {
        recommendationId: item.recommendationId,
        kind: "points" as const,
        full: 0,
        current: 0,
        rung: null
      }
    }));

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        completed: items.filter(item => item.status === "COMPLETED").length,
        inProgress: items.filter(item => item.status === "IN_PROGRESS").length,
        baselineScore: scores.baselineOverallScore,
        baselinePercentage: scores.baselineOverallPercentage,
        currentScore: scores.overallScore,
        currentPercentage: scores.overallPercentage,
        delta: scores.delta,
        deltaPercentage: scores.deltaPercentage
      }
    });
  } catch (error) {
    console.error("Error fetching roadmap:", error);
    return NextResponse.json(
      { error: "Failed to fetch roadmap" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { recommendationId, plannedQuarter, plannedYear, priority } = body ?? {};

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required" },
        { status: 400 }
      );
    }

    // Yumuşak kilit: sırası gelmemiş kademe yol haritasına eklenemez.
    const actionable = await isRecommendationActionable(userId, recommendationId);
    if (!actionable) {
      return NextResponse.json(
        { error: "Bu öneriye sıra gelmedi. Önce bir önceki basamağı tamamlayın." },
        { status: 409 }
      );
    }

    const resolved = await resolveAssessmentForRecommendation(userId, recommendationId);
    if (!resolved) {
      return NextResponse.json(
        { error: "Öneri bir ankete bağlı değil." },
        { status: 400 }
      );
    }
    const { assessmentId } = resolved;

    const roadmapItem = await prisma.roadmapItem.upsert({
      where: {
        assessmentId_recommendationId: { assessmentId, recommendationId }
      },
      update: {
        plannedQuarter: plannedQuarter ?? null,
        plannedYear: plannedYear ?? null,
        priority: priority ?? 0
      },
      create: {
        assessmentId,
        recommendationId,
        plannedQuarter: plannedQuarter ?? null,
        plannedYear: plannedYear ?? null,
        priority: priority ?? 0
      },
      include: RECOMMENDATION_INCLUDE
    });

    return NextResponse.json(roadmapItem);
  } catch (error) {
    console.error("Error adding to roadmap:", error);
    return NextResponse.json(
      { error: "Failed to add to roadmap" },
      { status: 500 }
    );
  }
}

/**
 * Durum güncelleme. Öneriler sayfasındaki tamamlama ucuyla aynı servisi
 * kullanır: kilit, skor geçmişi ve dönen sayılar burada da aynıdır.
 */
export async function PUT(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const body = await request.json();
    const { recommendationId, status, plannedQuarter, plannedYear, priority } = body ?? {};

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required" },
        { status: 400 }
      );
    }

    if (status === undefined) {
      // Yalnızca zamanlama/öncelik değişiyor: durum olduğu gibi kalır.
      const resolved = await resolveAssessmentForRecommendation(userId, recommendationId);
      if (!resolved) {
        return NextResponse.json({ error: "Öneri bir ankete bağlı değil." }, { status: 400 });
      }
      const item = await prisma.roadmapItem.update({
        where: { assessmentId_recommendationId: { assessmentId: resolved.assessmentId, recommendationId } },
        data: {
          ...(plannedQuarter !== undefined && { plannedQuarter }),
          ...(plannedYear !== undefined && { plannedYear }),
          ...(priority !== undefined && { priority })
        },
        include: RECOMMENDATION_INCLUDE
      });
      return NextResponse.json({ item });
    }

    const outcome = await updateRoadmapStatus(userId, {
      recommendationId,
      status,
      plannedQuarter,
      plannedYear,
      priority
    });

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error.message }, { status: outcome.error.httpStatus });
    }

    const { item, after, earned, isCompleted, wasCompleted } = outcome.result;
    return NextResponse.json({
      item,
      progress: after,
      earned,
      pointsEarned: isCompleted && !wasCompleted ? earned : 0
    });
  } catch (error) {
    console.error("Error updating roadmap item:", error);
    return NextResponse.json(
      { error: "Failed to update roadmap item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('recommendationId');

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required" },
        { status: 400 }
      );
    }

    const resolved = await resolveAssessmentForRecommendation(userId, recommendationId);
    if (!resolved) {
      return NextResponse.json(
        { error: "Öneri bir ankete bağlı değil." },
        { status: 400 }
      );
    }

    await prisma.roadmapItem.delete({
      where: {
        assessmentId_recommendationId: { assessmentId: resolved.assessmentId, recommendationId }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from roadmap:", error);
    return NextResponse.json(
      { error: "Failed to remove from roadmap" },
      { status: 500 }
    );
  }
}
