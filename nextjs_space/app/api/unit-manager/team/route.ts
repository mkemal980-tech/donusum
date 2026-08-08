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
     * Cevaplar artık kuruluşun değerlendirmesine bağlı, kişiye değil.
     * Bu yüzden takım tablosu birimin değerlendirmeleri üzerinden kurulur:
     * bir satır = bir değerlendirme (kuruluşun bir anketi), kişi başına
     * ayrı puan yok — zaten amaç tek kurumsal puan üretmekti.
     */
    const managedUnits = await prisma.assessment.findMany({
      where: { unitId: { in: managedUnitIds } },
      include: {
        unit: { select: { id: true, name: true } },
        survey: { select: { id: true, name: true } },
        responses: {
          include: {
            question: {
              include: {
                subLevel: {
                  include: {
                    subCategory: {
                      include: {
                        category: true,
                      },
                    },
                  },
                },
                subCategory: {
                  include: {
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Her değerlendirme için skor hesapla
    const teamData = managedUnits.map((assessment) => {
      {
        const responses = assessment.responses || [];
        let totalScore = 0;
        let totalWeight = 0;

        responses.forEach((response: any) => {
          const weight = response.question?.weight || 1;
          totalScore += response.score * weight;
          totalWeight += weight;
        });

        const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        const normalizedScore = (averageScore / 5) * 100;

        return {
          id: assessment.id,
          email: "-",
          firstName: assessment.survey.name,
          lastName: null as string | null,
          unitId: assessment.unit?.id ?? "",
          unitName: assessment.unit?.name ?? "-",
          sector: null as string | null,
          subSector: null as string | null,
          responseCount: responses.length,
          score: Math.round(normalizedScore * 10) / 10,
          maturityScore: Math.round(averageScore * 100) / 100,
        };
      }
    });

    // Birim özeti
    const unitSummaries = managedUnits.map((assessment) => {
      const unit = assessment.unit;
      const unitUsers = teamData.filter((u) => u.unitId === (unit?.id ?? ""));
      const avgScore =
        unitUsers.length > 0
          ? unitUsers.reduce((sum, u) => sum + u.score, 0) / unitUsers.length
          : 0;
      const completedUsers = unitUsers.filter((u) => u.responseCount > 0).length;

      return {
        id: unit?.id ?? assessment.id,
        name: unit?.name ?? "-",
        description: null as string | null,
        userCount: unitUsers.length,
        completedUsers,
        averageScore: Math.round(avgScore * 10) / 10,
      };
    });

    return NextResponse.json({
      units: unitSummaries,
      team: teamData,
    });
  } catch (error) {
    console.error("Takım verisi getirme hatası:", error);
    return NextResponse.json(
      { error: "Veriler getirilemedi" },
      { status: 500 }
    );
  }
}
