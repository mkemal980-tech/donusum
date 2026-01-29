export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const TEST_USER_ID = "cmkzye325000tmo085fruemez";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      userId: (session.user as any)?.id || TEST_USER_ID,
      role: (session.user as any)?.role || "USER"
    };
  }
  return { userId: TEST_USER_ID, role: "USER" };
}

// Kullanıcıya atanan anketleri getir
export async function GET() {
  try {
    const { userId, role: userRole } = await getUserId();

    // Admin ise tüm aktif anketleri gör
    if (userRole === "ADMIN") {
      const surveys = await prisma.survey.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      });
      return NextResponse.json(surveys);
    }

    // Normal kullanıcı ise sadece atanan anketleri gör
    const assignments = await prisma.userSurveyAssignment.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        survey: true
      },
      orderBy: { assignedAt: 'desc' }
    });

    // Sadece aktif anketleri dön
    const surveys = assignments
      .filter(a => a.survey.isActive)
      .map(a => a.survey);

    return NextResponse.json(surveys);
  } catch (error) {
    console.error("Error fetching assigned surveys:", error);
    return NextResponse.json({ error: "Failed to fetch assigned surveys" }, { status: 500 });
  }
}
