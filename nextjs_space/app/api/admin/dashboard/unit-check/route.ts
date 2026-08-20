import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ hasResponses: false }, { status: 401 });
    }

    const user = session.user as { id?: string; role?: string; unitId?: string };
    
    // Only UNIT_MANAGER needs this check
    if (user.role !== "UNIT_MANAGER") {
      return NextResponse.json({ hasResponses: user.role === "ADMIN" });
    }

    // Get the unit manager's unit
    const unitManager = await prisma.user.findUnique({
      where: { id: user.id },
      select: { unitId: true },
    });

    if (!unitManager?.unitId) {
      return NextResponse.json({ hasResponses: false });
    }

    // Cevaplar kuruluşun değerlendirmesine bağlı: birimin bir değerlendirmesi
    // üzerinde çalışılmış mı diye bakılır.
    const usersWithResponses = await prisma.assessment.findFirst({
      where: {
        unitId: unitManager.unitId,
        responses: { some: {} },
      },
    });

    return NextResponse.json({ hasResponses: !!usersWithResponses });
  } catch (error) {
    console.error("Unit check error:", error);
    return NextResponse.json({ hasResponses: false }, { status: 500 });
  }
}
