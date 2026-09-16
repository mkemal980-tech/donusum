import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    // Rol ve birim taze okunur; token'daki değer eskimiş olabiliyordu.
    const user = auth.user;

    // Only UNIT_MANAGER needs this check
    if (user.role !== "UNIT_MANAGER") {
      return NextResponse.json({ hasResponses: user.role === "ADMIN" });
    }

    if (!user.unitId) {
      return NextResponse.json({ hasResponses: false });
    }

    // Cevaplar kuruluşun değerlendirmesine bağlı: birimin bir değerlendirmesi
    // üzerinde çalışılmış mı diye bakılır.
    const usersWithResponses = await prisma.assessment.findFirst({
      where: {
        unitId: user.unitId,
        responses: { some: {} },
      },
    });

    return NextResponse.json({ hasResponses: !!usersWithResponses });
  } catch (error) {
    console.error("Unit check error:", error);
    return NextResponse.json({ hasResponses: false }, { status: 500 });
  }
}
