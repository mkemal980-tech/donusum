import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface CategoryType {
  id: string;
  name: string;
  subCategories?: { subLevels?: unknown[] }[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const surveyId = searchParams.get("surveyId");

    // Genel istatistikler
    const [totalUsers, totalSurveys, totalQuestions, totalRecommendations] = await Promise.all([
      prisma.user.count(),
      prisma.survey.count({ where: { isActive: true } }),
      prisma.question.count(),
      prisma.recommendation.count(),
    ]);

    // Admin kullanıcıları hariç aktif kullanıcılar
    // Cevaplar artık kuruluşun değerlendirmesine bağlı; "aktif" ölçüsü de
    // kişi değil, üzerinde çalışılmış değerlendirme sayısıdır.
    /**
     * Tanıtım anketi sayılmaz. Kendi kaydolan ziyaretçilere otomatik
     * atanıyor ve rastgele cevaplarla dolduruluyor; bu satırlar gerçek
     * değerlendirmelerle aynı ortalamaya girerse rapor yalan söyler.
     */
    const realAssessment = { survey: { isDemo: false } };

    const activeUsers = await prisma.assessment.count({
      where: { ...realAssessment, responses: { some: {} } },
    });

    // Son 7 günde yanıt veren kullanıcılar
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentActiveUsers = await prisma.assessment.count({
      where: {
        ...realAssessment,
        responses: {
          some: {
            updatedAt: { gte: sevenDaysAgo },
          },
        },
      },
    });

    // Toplam yanıt sayısı
    const totalResponses = await prisma.surveyResponse.count({
      where: { assessment: realAssessment },
    });

    // Anket listesi
    const surveys = await prisma.survey.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });

    // Son aktiviteler (son 10 yanıt)
    const recentActivities = await prisma.surveyResponse.findMany({
      take: 10,
      orderBy: { updatedAt: "desc" },
      include: {
        // Cevabı fiilen kimin girdiği; sahibi artık kuruluşun değerlendirmesi.
        answeredBy: { select: { firstName: true, lastName: true, email: true, organization: true } },
        question: { select: { text: true } },
      },
    });

    let surveyStats = null;
    let categoryStats: { categoryId: string; categoryName: string; average: number; best: number; lowest: number; userCount: number }[] = [];
    let userScores: { userId: string; name: string; email: string; organization: string | null; sector: string; subSector: string; percentage: number; maturityScore: number; responseCount: number }[] = [];
    let sectorStats: { sector: string; average: number; best: number; lowest: number; userCount: number }[] = [];

    if (surveyId) {
      // Anket bazlı istatistikler
      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: {
          categories: {
            include: {
              subCategories: {
                include: { subLevels: true },
              },
            },
          },
        },
      });

      if (survey) {
        const categoryIds = survey.categories.map((c: CategoryType) => c.id);
        
        // Bu anket için toplam soru sayısı
        const surveyQuestions = await prisma.question.count({
          where: {
            OR: [
              { categoryId: { in: categoryIds } },
              { subCategory: { categoryId: { in: categoryIds } } },
              { subLevel: { subCategory: { categoryId: { in: categoryIds } } } },
            ],
          },
        });

        // Bu anketi tamamlayan kullanıcı sayısı
        const completedUsers = await prisma.assessment.count({
          where: {
            responses: {
              some: {
                question: {
                  OR: [
                    { categoryId: { in: categoryIds } },
                    { subCategory: { categoryId: { in: categoryIds } } },
                    { subLevel: { subCategory: { categoryId: { in: categoryIds } } } },
                  ],
                },
              },
            },
          },
        });

        surveyStats = {
          name: survey.name,
          questionCount: surveyQuestions,
          completedUsers,
          categoryCount: survey.categories.length,
        };

        // Kategori bazlı istatistikler
        for (const category of survey.categories) {
          const categoryQuestionIds = await prisma.question.findMany({
            where: {
              OR: [
                { categoryId: category.id },
                { subCategory: { categoryId: category.id } },
                { subLevel: { subCategory: { categoryId: category.id } } },
              ],
            },
            select: { id: true },
          });

          const questionIds = categoryQuestionIds.map((q: { id: string }) => q.id);

          const responses = await prisma.surveyResponse.findMany({
            where: {
              questionId: { in: questionIds },
            },
            select: { score: true, assessmentId: true },
          });

          // Puanlar değerlendirme bazında toplanır: aynı kuruluşun farklı
          // departmanlarının verdiği cevaplar tek bir puanda birleşir.
          const userScoresMap = new Map<string, number[]>();
          for (const resp of responses) {
            const userId = resp.assessmentId;
            if (!userScoresMap.has(userId)) {
              userScoresMap.set(userId, []);
            }
            userScoresMap.get(userId)!.push(resp.score);
          }

          const userAverages: number[] = [];
          userScoresMap.forEach((scores) => {
            if (scores.length > 0) {
              const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
              userAverages.push(avg);
            }
          });

          if (userAverages.length > 0) {
            categoryStats.push({
              categoryId: category.id,
              categoryName: category.name,
              average: Math.round((userAverages.reduce((a, b) => a + b, 0) / userAverages.length) * 10) / 10,
              best: Math.round(Math.max(...userAverages) * 10) / 10,
              lowest: Math.round(Math.min(...userAverages) * 10) / 10,
              userCount: userAverages.length,
            });
          } else {
            categoryStats.push({
              categoryId: category.id,
              categoryName: category.name,
              average: 0,
              best: 0,
              lowest: 0,
              userCount: 0,
            });
          }
        }

        // Kullanıcı puanları
        const usersWithResponses = await prisma.assessment.findMany({
          where: {
            ...realAssessment,
            responses: {
              some: {
                question: {
                  OR: [
                    { categoryId: { in: categoryIds } },
                    { subCategory: { categoryId: { in: categoryIds } } },
                    { subLevel: { subCategory: { categoryId: { in: categoryIds } } } },
                  ],
                },
              },
            },
          },
          include: {
            unit: { select: { name: true } },
            owner: {
              select: {
                firstName: true, lastName: true, email: true, organization: true,
                sector: { select: { name: true } },
                subSector: { select: { name: true } },
              },
            },
            responses: {
              where: {
                question: {
                  OR: [
                    { categoryId: { in: categoryIds } },
                    { subCategory: { categoryId: { in: categoryIds } } },
                    { subLevel: { subCategory: { categoryId: { in: categoryIds } } } },
                  ],
                },
              },
              include: {
                question: {
                  select: {
                    weight: true,
                    categoryId: true,
                    subCategory: { select: { categoryId: true } },
                    subLevel: { select: { subCategory: { select: { categoryId: true } } } },
                  },
                },
              },
            },
          },
        });

        for (const user of usersWithResponses) {
          const responses = user.responses;
          if (responses.length === 0) continue;

          let totalScore = 0;
          let totalMaxScore = 0;

          for (const resp of responses) {
            const weight = resp.question.weight || 1;
            totalScore += resp.score * weight;
            totalMaxScore += 5 * weight;
          }

          const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
          const maturityScore = (percentage / 100) * 4 + 1;

          userScores.push({
            userId: user.id,
            // Satır artık bir kuruluşun değerlendirmesi: kuruluş adı varsa o,
            // yoksa tek kişilik değerlendirmenin sahibi gösterilir.
            name:
              user.unit?.name ||
              [user.owner?.firstName, user.owner?.lastName].filter(Boolean).join(" ") ||
              user.owner?.email ||
              "-",
            email: user.owner?.email ?? "-",
            organization: user.owner?.organization ?? user.unit?.name ?? null,
            sector: user.owner?.sector?.name || "-",
            subSector: user.owner?.subSector?.name || "-",
            percentage: Math.round(percentage),
            maturityScore: Math.round(maturityScore * 10) / 10,
            responseCount: responses.length,
          });
        }

        // Sektör bazlı ortalamalar
        const sectorMap = new Map<string, { name: string; scores: number[] }>();
        for (const us of userScores) {
          const sectorName = us.sector || "Tanımsız";
          if (!sectorMap.has(sectorName)) {
            sectorMap.set(sectorName, { name: sectorName, scores: [] });
          }
          sectorMap.get(sectorName)!.scores.push(us.maturityScore);
        }

        sectorMap.forEach((data) => {
          const scores = data.scores;
          if (scores.length > 0) {
            sectorStats.push({
              sector: data.name,
              average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
              best: Math.round(Math.max(...scores) * 10) / 10,
              lowest: Math.round(Math.min(...scores) * 10) / 10,
              userCount: scores.length,
            });
          }
        });

        // Kullanıcıları puana göre sırala
        userScores.sort((a, b) => b.maturityScore - a.maturityScore);
      }
    }

    return NextResponse.json({
      overview: {
        totalUsers,
        totalSurveys,
        totalQuestions,
        totalRecommendations,
        activeUsers,
        recentActiveUsers,
        totalResponses,
      },
      surveys,
      surveyStats,
      categoryStats,
      userScores,
      sectorStats,
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        userName:
          [a.answeredBy?.firstName, a.answeredBy?.lastName].filter(Boolean).join(" ") ||
          a.answeredBy?.email ||
          "-",
        userEmail: a.answeredBy?.email ?? "-",
        organization: a.answeredBy?.organization ?? null,
        question: a.question.text.substring(0, 50) + (a.question.text.length > 50 ? "..." : ""),
        score: a.score,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
