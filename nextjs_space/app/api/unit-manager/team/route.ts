import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Bir kullanıcının admin olduğu tüm birimleri getir (miras dahil)
async function getAdminUnits(userId: string): Promise<string[]> {
  // Doğrudan admin olduğu birimler
  const directAdminUnits = await prisma.unitAdmin.findMany({
    where: { userId },
    select: { unitId: true },
  });

  const unitIds = new Set<string>(directAdminUnits.map(a => a.unitId));

  // Alt birimleri recursive olarak bul
  async function addSubUnits(parentId: string) {
    const subUnits = await prisma.unit.findMany({
      where: { parentId },
      select: { id: true },
    });

    for (const sub of subUnits) {
      unitIds.add(sub.id);
      await addSubUnits(sub.id);
    }
  }

  for (const unitId of directAdminUnits.map(a => a.unitId)) {
    await addSubUnits(unitId);
  }

  return Array.from(unitIds);
}

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
    const managedUnitIds = await getAdminUnits(userId);

    if (managedUnitIds.length === 0 && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Yönettiğiniz birim bulunamadı" },
        { status: 403 }
      );
    }

    // Yönetilen birimleri getir
    const managedUnits = await prisma.unit.findMany({
      where: { id: { in: managedUnitIds } },
      include: {
        users: {
          include: {
            surveyResponses: {
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
            sector: true,
            subSector: true,
          },
        },
      },
    });

    // Her kullanıcı için skor hesapla
    const teamData = managedUnits.flatMap((unit) =>
      unit.users.map((user) => {
        const responses = user.surveyResponses || [];
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
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          unitId: unit.id,
          unitName: unit.name,
          sector: user.sector?.name || null,
          subSector: user.subSector?.name || null,
          responseCount: responses.length,
          score: Math.round(normalizedScore * 10) / 10,
          maturityScore: Math.round(averageScore * 100) / 100,
        };
      })
    );

    // Birim özeti
    const unitSummaries = managedUnits.map((unit) => {
      const unitUsers = teamData.filter((u) => u.unitId === unit.id);
      const avgScore =
        unitUsers.length > 0
          ? unitUsers.reduce((sum, u) => sum + u.score, 0) / unitUsers.length
          : 0;
      const completedUsers = unitUsers.filter((u) => u.responseCount > 0).length;

      return {
        id: unit.id,
        name: unit.name,
        description: unit.description,
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
