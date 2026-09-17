import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
// Yönetilen birim hiyerarşisi görev dağılımıyla ortak; tek yerde durur.
import { getManagedUnitIds } from "@/lib/assessment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;

  try {
    const userId = auth.userId;
    const userRole = auth.user.role;

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
    /**
     * Yönetici hiçbir birimin `UnitAdmin` kaydına sahip olmayabilir; o durumda
     * `in: []` sessizce boş bir ekran veriyordu. Yönetici için kapsam
     * daraltılmaz.
     */
    const unitScope =
      userRole === "ADMIN" && managedUnitIds.length === 0
        ? { not: null }
        : { in: managedUnitIds };

    const assessments = await prisma.assessment.findMany({
      where: { unitId: unitScope },
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

    /**
     * Birim özeti: yönetilen **her** birim listelenir.
     *
     * Burada `unitRows.length === 0` olan birimler eleniyordu; yani henüz
     * değerlendirmesi başlamamış bir birim listeden tamamen düşüyordu. Yeni
     * kurulmuş bir kuruluşun yöneticisi ekranda "Yönettiğiniz birim yok"
     * görüyordu — oysa birimi vardı, sadece içi boştu. Yönetici panosunda ise
     * aynı kişi o birimin yöneticisi olarak görünüyordu; iki ekran birbirini
     * yalanlıyordu.
     *
     * Ad ve açıklama artık Unit kaydından okunuyor; önceden ilk değerlendirme
     * satırından türetiliyordu ve satır yoksa ad da yoktu.
     */
    const managedUnits = await prisma.unit.findMany({
      where: { id: { in: managedUnitIds } },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });

    const unitSummaries = managedUnits.map((unit) => {
      const unitRows = rows.filter((row) => row.unitId === unit.id);
      const started = unitRows.filter((row) => row.responseCount > 0);
      const averageScore =
        started.length > 0
          ? started.reduce((sum, row) => sum + row.score, 0) / started.length
          : 0;

      return {
        id: unit.id,
        name: unit.name,
        description: unit.description,
        assessmentCount: unitRows.length,
        startedCount: started.length,
        averageScore: Math.round(averageScore * 10) / 10,
      };
    });

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
