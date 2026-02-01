export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Kullanıcıya atanan anketleri getir
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = (session.user as any)?.role || "USER";

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
