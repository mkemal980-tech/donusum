import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

interface CategoryType {
  id: string;
  name: string;
  subCategories?: { subLevels?: unknown[] }[];
}

export async function GET(req: NextRequest) {
  // Rol token'dan değil veritabanından okunur: yetkisi alınan yönetici
  // eski oturumuyla bu panoyu görmeye devam ediyordu.
  const auth = await withAuth(req, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
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
    /** Liste sınıra takıldıysa ekran bunu söylemeli. */
    let userScoresTruncated = false;

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
            // Aynı işleyicinin geri kalanı `realAssessment` uyguluyor, bu iki
            // sorgu uygulamıyordu: ziyaretçilerin rastgele tanıtım cevapları
            // tamamlama sayısına ve kategori ortalamalarına giriyordu.
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
        });

        surveyStats = {
          name: survey.name,
          questionCount: surveyQuestions,
          completedUsers,
          categoryCount: survey.categories.length,
        };

        /**
         * Kategori istatistikleri iki sorguyla çıkar.
         *
         * Burada kategori başına iki sorgu atılıyordu (soru kimlikleri + o
         * kimliklere ait bütün cevaplar); 12 kategorili bir ankette 24 sorgu
         * ediyordu ve cevap tablosu büyüdükçe her biri ağırlaşıyordu. Soruların
         * kategori eşlemesi ve cevaplar tek seferde çekilip bellekte gruplanıyor.
         */
        const questionsWithCategory = await prisma.question.findMany({
          where: {
            OR: [
              { categoryId: { in: categoryIds } },
              { subCategory: { categoryId: { in: categoryIds } } },
              { subLevel: { subCategory: { categoryId: { in: categoryIds } } } },
            ],
          },
          select: {
            id: true,
            categoryId: true,
            subCategory: { select: { categoryId: true } },
            subLevel: { select: { subCategory: { select: { categoryId: true } } } },
          },
        });

        const categoryOfQuestion = new Map<string, string>();
        for (const question of questionsWithCategory) {
          const owner =
            question.categoryId ??
            question.subCategory?.categoryId ??
            question.subLevel?.subCategory.categoryId ??
            null;
          if (owner) categoryOfQuestion.set(question.id, owner);
        }

        const allResponses = await prisma.surveyResponse.findMany({
          where: {
            questionId: { in: [...categoryOfQuestion.keys()] },
            assessment: realAssessment,
          },
          select: { score: true, assessmentId: true, questionId: true },
        });

        // Puanlar değerlendirme bazında toplanır: aynı kuruluşun farklı
        // departmanlarının verdiği cevaplar tek bir puanda birleşir.
        const scoresByCategory = new Map<string, Map<string, number[]>>();
        for (const response of allResponses) {
          const categoryId = categoryOfQuestion.get(response.questionId);
          if (!categoryId) continue;
          let perAssessment = scoresByCategory.get(categoryId);
          if (!perAssessment) {
            perAssessment = new Map<string, number[]>();
            scoresByCategory.set(categoryId, perAssessment);
          }
          const scores = perAssessment.get(response.assessmentId) ?? [];
          scores.push(response.score);
          perAssessment.set(response.assessmentId, scores);
        }

        for (const category of survey.categories) {
          const userScoresMap = scoresByCategory.get(category.id) ?? new Map<string, number[]>();

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
        /**
         * Puan tablosu sayfalanır.
         *
         * Bütün değerlendirmeler bütün cevaplarıyla belleğe alınıyordu:
         * sayfalama yoktu ve veri büyüdükçe yönetici panosu önce yavaşlıyor,
         * sonra hiç açılmıyordu. Tablo zaten puana göre sıralı ilk N satırı
         * gösteriyor; sınır açıkça konur ve toplam sayı ayrıca bildirilir.
         */
        const USER_SCORE_LIMIT = 200;

        const usersWithResponses = await prisma.assessment.findMany({
          take: USER_SCORE_LIMIT,
          orderBy: { updatedAt: "desc" },
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
        userScoresTruncated = usersWithResponses.length === USER_SCORE_LIMIT;
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
      userScoresTruncated,
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
