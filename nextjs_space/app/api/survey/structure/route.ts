export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { getScopeResolver } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  // Daha önce tamamen kimlik doğrulamasız erişilebilen anket yapısı uç noktası korundu.
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // Anket ID varsa sadece o ankete ait (arşivlenmemiş) kategorileri getir
    const whereClause = { archivedAt: null, ...(surveyId ? { surveyId } : {}) };

    const categories = await prisma.category.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      include: {
        survey: {
          select: { id: true, name: true }
        },
        // Doğrudan kategoriye bağlı sorular (alt kategori olmadan)
        questions: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' }
        },
        subCategories: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' },
          include: {
            // Alt seviyeler ve onların soruları
            subLevels: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' },
              include: {
                questions: {
                  where: { archivedAt: null },
                  orderBy: { order: 'asc' }
                }
              }
            },
            // Doğrudan alt kategoriye bağlı sorular (hasSubLevels = false)
            questions: {
              where: { archivedAt: null },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    /**
     * Sektöre göre kapsam dışı bırakılan bölümler kullanıcıya hiç
     * gösterilmez — gri bir bölüm göstermek yalnızca gürültü olurdu.
     * Kural yoksa hiçbir şey elenmez.
     */
    const scopeOf = await getScopeResolver(auth.userId, surveyId ?? undefined);

    const scoped = (categories ?? []).map((category) => ({
      ...category,
      subCategories: category.subCategories.filter((subCategory) =>
        scopeOf(subCategory.id).applicable
      ),
    }));

    // Bütün bölümleri elenmiş kategori kullanıcıya boş görünür; onu da çıkar.
    // (Doğrudan kategoriye bağlı soruları varsa kalır.)
    const visible = scoped.filter(
      (category) => category.subCategories.length > 0 || (category.questions?.length ?? 0) > 0
    );

    return NextResponse.json(visible);
  } catch (error) {
    console.error("Error fetching survey structure:", error);
    return NextResponse.json(
      { error: "Failed to fetch survey structure" },
      { status: 500 }
    );
  }
}
