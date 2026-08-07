import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { prisma } from '@/lib/db';
import { calculateProgressScores } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // 1. Kategorileri al (arşivlenmemiş)
    const categories = await prisma.category.findMany({
      where: { archivedAt: null, ...(surveyId ? { surveyId } : {}) },
      include: {
        subCategories: {
          include: {
            subLevels: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    // 2. Kullanıcının anket cevaplarını al
    const responses = await prisma.surveyResponse.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            category: true,
            subCategory: { include: { category: true } },
            subLevel: { include: { subCategory: { include: { category: true } } } }
          }
        }
      }
    });

    // 3. Tamamlanan önerileri al
    const completedRoadmapItems = await prisma.roadmapItem.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        recommendation: {
          include: {
            subCategory: { include: { category: true } },
            subLevel: { include: { subCategory: { include: { category: true } } } }
          }
        }
      }
    });

    // 4. Her kategori için skorları hesapla
    const categoryProgress = categories.map(category => {
      // Anket cevaplarından base score
      const categoryResponses = responses.filter(r => {
        const q = r.question;
        if (q.category?.id === category.id) return true;
        if (q.subCategory?.category?.id === category.id) return true;
        if (q.subLevel?.subCategory?.category?.id === category.id) return true;
        return false;
      });

      const baseScore = categoryResponses.length > 0
        ? categoryResponses.reduce((sum, r) => sum + r.score, 0) / categoryResponses.length
        : 0;

      // Tamamlanan önerilerden bonus puanlar
      const categoryCompletions = completedRoadmapItems.filter(item => {
        const rec = item.recommendation;
        if (rec.categoryId === category.id) return true;
        if (rec.subCategory?.category?.id === category.id) return true;
        if (rec.subLevel?.subCategory?.category?.id === category.id) return true;
        return false;
      });

      const bonusPoints = categoryCompletions.reduce((sum, item) => {
        return sum + (item.recommendation.points || 0);
      }, 0);

      // Alt kategoriler için de hesapla
      const subCategoryProgress = category.subCategories.map(subCat => {
        const subCatResponses = responses.filter(r => {
          const q = r.question;
          if (q.subCategory?.id === subCat.id) return true;
          if (q.subLevel?.subCategory?.id === subCat.id) return true;
          return false;
        });

        const subBaseScore = subCatResponses.length > 0
          ? subCatResponses.reduce((sum, r) => sum + r.score, 0) / subCatResponses.length
          : 0;

        const subCompletions = completedRoadmapItems.filter(item => {
          const rec = item.recommendation;
          if (rec.subCategoryId === subCat.id) return true;
          if (rec.subLevel?.subCategory?.id === subCat.id) return true;
          return false;
        });

        const subBonusPoints = subCompletions.reduce((sum, item) => {
          return sum + (item.recommendation.points || 0);
        }, 0);

        return {
          id: subCat.id,
          name: subCat.name,
          baseScore: Math.round(subBaseScore * 100) / 100,
          bonusPoints: Math.round(subBonusPoints * 100) / 100,
          totalScore: Math.min(5, Math.round((subBaseScore + subBonusPoints) * 100) / 100),
          completedCount: subCompletions.length,
          responseCount: subCatResponses.length
        };
      });

      return {
        id: category.id,
        name: category.name,
        baseScore: Math.round(baseScore * 100) / 100,
        bonusPoints: Math.round(bonusPoints * 100) / 100,
        totalScore: Math.min(5, Math.round((baseScore + bonusPoints) * 100) / 100),
        completedCount: categoryCompletions.length,
        responseCount: categoryResponses.length,
        subCategories: subCategoryProgress
      };
    });

    // 5. Genel velocity ve endurance skorları — tek doğru kaynak (lib/scoring).
    // Burada eskiden ağırlıksız ham ortalama alınıyordu; gösterge paneli ve
    // trend grafiği ile aynı veri için farklı sayılar üretiyordu.
    const axisScores = await calculateProgressScores(userId, {
      surveyId: surveyId || undefined
    });

    return NextResponse.json({
      categories: categoryProgress,
      overall: {
        velocity: {
          baseScore: axisScores.velocityBase,
          bonusPoints: axisScores.velocityBonus,
          totalScore: axisScores.velocityScore
        },
        endurance: {
          baseScore: axisScores.enduranceBase,
          bonusPoints: axisScores.enduranceBonus,
          totalScore: axisScores.enduranceScore
        },
        quadrant: axisScores.quadrant,
        totalCompletedRecommendations: completedRoadmapItems.length,
        totalResponses: responses.length
      }
    });
  } catch (error) {
    console.error('Progress scores error:', error);
    return NextResponse.json({ error: 'Failed to fetch progress scores' }, { status: 500 });
  }
}
