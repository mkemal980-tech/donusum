export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { loadVisibleSurveyStructure } from "@/lib/survey-structure";

export async function GET(request: NextRequest) {
  // Daha önce tamamen kimlik doğrulamasız erişilebilen anket yapısı uç noktası korundu.
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (surveyId) {
      // Erişim, arşiv filtresi, sektör kapsamı ve bölüm görünürlüğü tek
      // kaynakta (bkz. lib/survey-structure). Pano da aynı kaynağı kullanır;
      // ikisi ayrı yazıldığında kuralları ayrışıyordu.
      const visible = await loadVisibleSurveyStructure(auth.userId, auth.user.role, surveyId);
      if (visible === null) {
        return NextResponse.json({ error: "Bu ankete erişiminiz yok" }, { status: 403 });
      }
      return NextResponse.json(visible);
    }

    if (auth.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Anket seçimi gerekli" }, { status: 400 });
    }

    // Yönetim ekranları anket seçmeden bütün ağacı isteyebilir.
    const categories = await prisma.category.findMany({
      where: { archivedAt: null },
      orderBy: { order: 'asc' },
      include: {
        survey: { select: { id: true, name: true } },
        questions: { where: { archivedAt: null }, orderBy: { order: 'asc' } },
        subCategories: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' },
          include: {
            subLevels: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' },
              include: { questions: { where: { archivedAt: null }, orderBy: { order: 'asc' } } },
            },
            questions: { where: { archivedAt: null }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching survey structure:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey structure" },
      { status: 500 }
    );
  }
}
