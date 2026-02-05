import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    // 1. Kategorileri al
    const categories = await prisma.category.findMany({
      where: surveyId ? { surveyId } : {},
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

    // 5. Genel velocity ve endurance skorları
    let velocityBase = 0, velocityBonus = 0, velocityCount = 0;
    let enduranceBase = 0, enduranceBonus = 0, enduranceCount = 0;

    responses.forEach(r => {
      if (r.question.axisType === 'ENDURANCE') {
        enduranceBase += r.score;
        enduranceCount++;
      } else {
        velocityBase += r.score;
        velocityCount++;
      }
    });

    completedRoadmapItems.forEach(item => {
      const axisType = item.recommendation.subLevel?.axisType || 'VELOCITY';
      if (axisType === 'ENDURANCE') {
        enduranceBonus += item.recommendation.points || 0;
      } else {
        velocityBonus += item.recommendation.points || 0;
      }
    });

    const velocityBaseScore = velocityCount > 0 ? velocityBase / velocityCount : 0;
    const enduranceBaseScore = enduranceCount > 0 ? enduranceBase / enduranceCount : 0;

    return NextResponse.json({
      categories: categoryProgress,
      overall: {
        velocity: {
          baseScore: Math.round(velocityBaseScore * 100) / 100,
          bonusPoints: Math.round(velocityBonus * 100) / 100,
          totalScore: Math.min(5, Math.round((velocityBaseScore + velocityBonus) * 100) / 100)
        },
        endurance: {
          baseScore: Math.round(enduranceBaseScore * 100) / 100,
          bonusPoints: Math.round(enduranceBonus * 100) / 100,
          totalScore: Math.min(5, Math.round((enduranceBaseScore + enduranceBonus) * 100) / 100)
        },
        totalCompletedRecommendations: completedRoadmapItems.length,
        totalResponses: responses.length
      }
    });
  } catch (error) {
    console.error('Progress scores error:', error);
    return NextResponse.json({ error: 'Failed to fetch progress scores' }, { status: 500 });
  }
}
