export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { isRecommendationActionable } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const roadmapItems = await prisma.roadmapItem.findMany({
      where: { userId },
      include: {
        recommendation: true
      },
      orderBy: [
        { plannedYear: 'asc' },
        { plannedQuarter: 'asc' },
        { priority: 'asc' }
      ]
    });

    return NextResponse.json(roadmapItems ?? []);
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

    const roadmapItem = await prisma.roadmapItem.upsert({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId
        }
      },
      update: {
        plannedQuarter: plannedQuarter ?? null,
        plannedYear: plannedYear ?? null,
        priority: priority ?? 0
      },
      create: {
        userId,
        recommendationId,
        plannedQuarter: plannedQuarter ?? null,
        plannedYear: plannedYear ?? null,
        priority: priority ?? 0
      },
      include: {
        recommendation: true
      }
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

// Status güncelleme için PUT
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

    // Geçerli status değerleri
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PLANNED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }

    const roadmapItem = await prisma.roadmapItem.update({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId
        }
      },
      data: {
        ...(status && { status }),
        ...(plannedQuarter !== undefined && { plannedQuarter }),
        ...(plannedYear !== undefined && { plannedYear }),
        ...(priority !== undefined && { priority })
      },
      include: {
        recommendation: true
      }
    });

    return NextResponse.json(roadmapItem);
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

    await prisma.roadmapItem.delete({
      where: {
        userId_recommendationId: {
          userId,
          recommendationId
        }
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
