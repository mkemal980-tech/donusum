import { withAuth } from "@/lib/api-utils";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { archiveSurvey } from "@/lib/soft-delete";
import { canEditSurvey, getManagedSurveyRootIds } from "@/lib/survey-management";
import { canManageTenantUnit } from "@/lib/organization-campaign";

export const dynamic = 'force-dynamic';

// GET - Tüm anketleri getir veya silme öncesi etki analizi
export async function GET(request: Request) {
  const auth = await withAuth(request as any, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');
    const managedRootIds = await getManagedSurveyRootIds(auth.userId, auth.user.role);
    
    // Silme öncesi etki analizi - bağlı kayıtları say
    if (action === 'delete-impact' && id) {
      if (!(await canEditSurvey(auth.userId, auth.user.role, id))) {
        return NextResponse.json({ error: 'Bu anketi yönetme yetkiniz yok' }, { status: 403 });
      }
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
      where: {
        archivedAt: null,
        ...(auth.user.role === 'ADMIN' ? {} : {
          OR: [
            { ownerUnitId: { in: managedRootIds } },
            { userAssignments: { some: { userId: auth.userId, isActive: true } } },
          ],
        }),
      },
      orderBy: { order: 'asc' },
      include: {
        // Sahibin adı listede gösterilir: hangi anketin hangi yapıya ait
        // olduğu ekranda görünmeden devir kör bir işlem olurdu.
        ownerUnit: { select: { id: true, name: true } },
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
    return NextResponse.json(surveys.map((survey) => ({
      ...survey,
      canEdit: auth.user.role === 'ADMIN' || Boolean(survey.ownerUnitId && managedRootIds.includes(survey.ownerUnitId)),
      isAssignedTemplate: auth.user.role !== 'ADMIN' && !survey.ownerUnitId,
    })));
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
  }
}

// POST - Yeni anket oluştur
export async function POST(request: Request) {
  const auth = await withAuth(request as any, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { name, description, isActive, isDemo, order, ownerUnitId } = await request.json();
    const normalizedName = String(name ?? '').trim().slice(0, 160);
    if (!normalizedName) {
      return NextResponse.json({ error: 'Anket adı gerekli' }, { status: 400 });
    }
    if (auth.user.role !== 'ADMIN') {
      if (!ownerUnitId || !(await canManageTenantUnit(auth.userId, auth.user.role, ownerUnitId))) {
        return NextResponse.json({ error: 'Bu kuruluş için anket oluşturamazsınız' }, { status: 403 });
      }
    }
    
    const survey = await prisma.$transaction(async (tx) => {
      const created = await tx.survey.create({
        data: {
          name: normalizedName,
          description,
          isActive: auth.user.role === 'ADMIN' ? isActive ?? true : false,
          isDemo: auth.user.role === 'ADMIN' ? isDemo ?? false : false,
          order: order || 0,
          ownerUnitId: ownerUnitId || null,
          createdById: auth.userId,
        }
      });
      if (auth.user.role !== 'ADMIN') {
        await tx.userSurveyAssignment.create({
          data: { userId: auth.userId, surveyId: created.id, assignedBy: auth.userId },
        });
      }
      return created;
    });
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}

// PUT - Anket güncelle
export async function PUT(request: Request) {
  const auth = await withAuth(request as any, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, name, description, isActive, isDemo, order } = body;
    if (!id || !(await canEditSurvey(auth.userId, auth.user.role, id))) {
      return NextResponse.json({ error: 'Bu anketi düzenleme yetkiniz yok' }, { status: 403 });
    }
    const normalizedName = String(name ?? '').trim().slice(0, 160);
    if (!normalizedName) return NextResponse.json({ error: 'Anket adı gerekli' }, { status: 400 });

    /**
     * Anket sahipliği devredilebilir — yalnızca platform yöneticisi tarafından.
     *
     * Sahiplik yalnızca oluşturma anında belirlenebiliyordu ve admin ekranı
     * hiç göndermiyordu; yani admin'in açtığı her anket kalıcı olarak
     * "platform anketi" kalıyordu. Sonucu: bir yapının yöneticisi, adı o yapıyı
     * işaret eden anketi bile üyelerine dağıtamıyordu. Tek yol anketi
     * yöneticiye *kişisel olarak atamaktı* — yani dağıtma yetkisi doldurma
     * yükümlülüğüne bağlanıyor, yönetici kendi panosunda katılımcı olarak
     * beliriyordu.
     *
     * Devir yalnızca kimin düzenleyip dağıtabileceğini değiştirir; mevcut
     * atamalara, cevaplara ve değerlendirmelere dokunmaz.
     */
    let ownerUnitUpdate: { ownerUnitId: string | null } | Record<string, never> = {};
    if ('ownerUnitId' in body) {
      if (auth.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Anket sahipliğini yalnızca platform yöneticisi değiştirebilir' },
          { status: 403 }
        );
      }
      const nextOwnerUnitId = body.ownerUnitId ? String(body.ownerUnitId) : null;
      if (nextOwnerUnitId) {
        const owner = await prisma.unit.findUnique({
          where: { id: nextOwnerUnitId },
          select: { id: true },
        });
        if (!owner) {
          return NextResponse.json({ error: 'Seçilen kuruluş bulunamadı' }, { status: 400 });
        }
      }
      ownerUnitUpdate = { ownerUnitId: nextOwnerUnitId };
    }
    
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
        name: normalizedName,
        description,
        isActive,
        ...(auth.user.role === 'ADMIN' && typeof isDemo === 'boolean' ? { isDemo } : {}),
        ...ownerUnitUpdate,
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
  const auth = await withAuth(request as any, { requireUnitManager: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
    }
    if (!(await canEditSurvey(auth.userId, auth.user.role, id))) {
      return NextResponse.json({ error: 'Bu anketi silme yetkiniz yok' }, { status: 403 });
    }
    
    await archiveSurvey(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
