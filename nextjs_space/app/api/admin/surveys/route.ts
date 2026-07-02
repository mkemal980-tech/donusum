import { withAuth } from "@/lib/api-utils";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { archiveSurvey } from "@/lib/soft-delete";

export const dynamic = 'force-dynamic';

// GET - Tüm anketleri getir veya silme öncesi etki analizi
export async function GET(request: Request) {
  const auth = await withAuth(request as any, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    
    // Silme öncesi etki analizi - bağlı kayıtları say
    if (action === 'delete-impact' && id) {
      const survey = await prisma.survey.findUnique({
        where: { id },
        select: { name: true }
      });
      
      if (!survey) {
        return NextResponse.json({ error: 'Anket bulunamadı' }, { status: 404 });
      }
      
      // Bağlı kategorileri say
      const categories = await prisma.category.findMany({
        where: { surveyId: id },
        select: { id: true }
      });
      const categoryIds = categories.map(c => c.id);
      
      // Bağlı alt kategorileri say
      const subCategories = await prisma.subCategory.findMany({
        where: { categoryId: { in: categoryIds } },
        select: { id: true }
      });
      const subCategoryIds = subCategories.map(sc => sc.id);
      
      // Bağlı alt seviyeleri say
      const subLevels = await prisma.subLevel.findMany({
        where: { subCategoryId: { in: subCategoryIds } },
        select: { id: true }
      });
      const subLevelIds = subLevels.map(sl => sl.id);
      
      // Bağlı soruları say (hem subCategory hem subLevel'dan)
      const questions = await prisma.question.findMany({
        where: {
          OR: [
            { subCategoryId: { in: subCategoryIds } },
            { subLevelId: { in: subLevelIds } }
          ]
        },
        select: { id: true }
      });
      const questionIds = questions.map(q => q.id);
      
      // Bağlı cevapları say
      const responsesCount = await prisma.surveyResponse.count({
        where: { questionId: { in: questionIds } }
      });
      
      // Bağlı önerileri say
      const recommendationsCount = await prisma.recommendation.count({
        where: {
          OR: [
            { subCategoryId: { in: subCategoryIds } },
            { subLevelId: { in: subLevelIds } }
          ]
        }
      });
      
      // Bağlı benchmark'ları say
      const benchmarksCount = await prisma.benchmark.count({
        where: { surveyId: id }
      });
      
      return NextResponse.json({
        surveyName: survey.name,
        impact: {
          categories: categories.length,
          subCategories: subCategories.length,
          subLevels: subLevels.length,
          questions: questions.length,
          responses: responsesCount,
          recommendations: recommendationsCount,
          benchmarks: benchmarksCount,
          total: categories.length + subCategories.length + subLevels.length + 
                 questions.length + responsesCount + recommendationsCount + benchmarksCount
        }
      });
    }
    
    // Normal liste (arşivlenmemiş)
    const surveys = await prisma.survey.findMany({
      where: { archivedAt: null },
      orderBy: { order: 'asc' },
      include: {
        categories: {
          where: { archivedAt: null },
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { subCategories: true }
            }
          }
        },
        _count: {
          select: { categories: true }
        }
      }
    });
    return NextResponse.json(surveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
  }
}

// POST - Yeni anket oluştur
export async function POST(request: Request) {
  const auth = await withAuth(request as any, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { name, description, isActive, order } = await request.json();
    
    const survey = await prisma.survey.create({
      data: {
        name,
        description,
        isActive: isActive ?? true,
        order: order || 0
      }
    });
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}

// PUT - Anket güncelle
export async function PUT(request: Request) {
  const auth = await withAuth(request as any, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { id, name, description, isActive, order } = await request.json();
    
    // Eğer anket aktif edilmeye çalışılıyorsa, içeriğini kontrol et
    if (isActive === true) {
      const surveyContent = await prisma.survey.findUnique({
        where: { id },
        include: {
          categories: {
            include: {
              questions: { select: { id: true } },
              subCategories: {
                include: {
                  questions: { select: { id: true } },
                  subLevels: {
                    include: {
                      questions: { select: { id: true } }
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!surveyContent) {
        return NextResponse.json({ error: 'Anket bulunamadı' }, { status: 404 });
      }
      
      // Kategori kontrolü
      if (!surveyContent.categories || surveyContent.categories.length === 0) {
        return NextResponse.json({ 
          error: 'Boş anket aktif edilemez. Lütfen önce en az bir kategori ekleyin.',
          code: 'EMPTY_SURVEY'
        }, { status: 400 });
      }
      
      // Soru kontrolü - tüm hiyerarşiden soruları say
      let totalQuestions = 0;
      surveyContent.categories.forEach(cat => {
        totalQuestions += cat.questions?.length || 0;
        cat.subCategories?.forEach(sub => {
          totalQuestions += sub.questions?.length || 0;
          sub.subLevels?.forEach(level => {
            totalQuestions += level.questions?.length || 0;
          });
        });
      });
      
      if (totalQuestions === 0) {
        return NextResponse.json({ 
          error: 'Sorusu olmayan anket aktif edilemez. Lütfen önce soru ekleyin.',
          code: 'NO_QUESTIONS'
        }, { status: 400 });
      }
    }
    
    const survey = await prisma.survey.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        order
      }
    });
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error updating survey:', error);
    return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
  }
}

// DELETE - Anket sil
export async function DELETE(request: Request) {
  const auth = await withAuth(request as any, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
    }
    
    await archiveSurvey(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
