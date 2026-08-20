import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
// Yönetilen birim hiyerarşisi görev dağılımıyla ortak; tek yerde durur.
import { getManagedUnitIds } from "@/lib/assessment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    // Kullanıcının yönettiği birimlerin ID'lerini bul
    const managedUnitIds = await getManagedUnitIds(userId);

    if (managedUnitIds.length === 0 && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Yönettiğiniz birim bulunamadı" },
        { status: 403 }
      );
    }

    /**
     * Cevaplar kuruluşun değerlendirmesine bağlı, kişiye değil. Bu yüzden
     * tablonun satırı da kişi değil değerlendirme: bir satır = bir kuruluşun
     * bir anketi. Kişi başına ayrı puan yok — amaç zaten tek kurumsal puandı.
     *
     * Kişi düzeyindeki soru ("kim ne kadar doldurdu") görev dağılımı
     * ekranında cevaplanıyor; burada tekrarlanmıyor.
     */
    const assessments = await prisma.assessment.findMany({
      where: { unitId: { in: managedUnitIds } },
      include: {
        unit: { select: { id: true, name: true, description: true } },
        survey: { select: { id: true, name: true } },
        responses: {
          select: {
            score: true,
            updatedAt: true,
            answeredById: true,
            question: { select: { weight: true } },
          },
        },
      },
    });

    const rows = assessments.map((assessment) => {
      const responses = assessment.responses;

      let totalScore = 0;
      let totalWeight = 0;
      const contributors = new Set<string>();
      let lastActivityAt: Date | null = null;

      for (const response of responses) {
        const weight = response.question?.weight || 1;
        totalScore += response.score * weight;
        totalWeight += weight;
        if (response.answeredById) contributors.add(response.answeredById);
        if (!lastActivityAt || response.updatedAt > lastActivityAt) {
          lastActivityAt = response.updatedAt;
        }
      }

      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      return {
        id: assessment.id,
        unitId: assessment.unit?.id ?? "",
        unitName: assessment.unit?.name ?? "-",
        surveyId: assessment.survey.id,
        surveyName: assessment.survey.name,
        responseCount: responses.length,
        /** Cevaba dokunmuş kişi sayısı (denetim izi answeredById üzerinden). */
        contributorCount: contributors.size,
        lastActivityAt,
        score: Math.round((averageScore / 5) * 100 * 10) / 10,
        maturityScore: Math.round(averageScore * 100) / 100,
      };
    });

    // Birim özeti: her birim bir kez: bir birimin birden çok anketi olabilir.
    const unitSummaries = managedUnitIds
      .map((unitId) => {
        const unitRows = rows.filter((row) => row.unitId === unitId);
        if (unitRows.length === 0) return null;

        const started = unitRows.filter((row) => row.responseCount > 0);
        const averageScore =
          started.length > 0
            ? started.reduce((sum, row) => sum + row.score, 0) / started.length
            : 0;

        return {
          id: unitId,
          name: unitRows[0].unitName,
          description: null as string | null,
          assessmentCount: unitRows.length,
          startedCount: started.length,
          averageScore: Math.round(averageScore * 10) / 10,
        };
      })
      .filter((summary): summary is NonNullable<typeof summary> => summary !== null);

    return NextResponse.json({
      units: unitSummaries,
      assessments: rows,
    });
  } catch (error) {
    console.error("Takım verisi getirme hatası:", error);
    return NextResponse.json(
      { error: "Veriler getirilemedi" },
      { status: 500 }
    );
  }
}
