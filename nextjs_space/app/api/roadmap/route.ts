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
  try {
    const userId = await getUserId();
    const body = await request.json();
    const { recommendationId, plannedQuarter, plannedYear, priority } = body ?? {};

    if (!recommendationId) {
      return NextResponse.json(
        { error: "Recommendation ID is required" },
        { status: 400 }
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
  try {
    const userId = await getUserId();
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
  try {
    const userId = await getUserId();
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
