export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateSurveyAccess, withAuth } from "@/lib/api-utils";
import { getScopeResolver } from "@/lib/scoring";
import {
  getAssessmentContext,
  getContributorCandidates,
  getOrCreateAssessment,
  getSectionAssignments,
} from "@/lib/assessment";
import { sectionOfQuestion } from "@/lib/section-assignment";

/**
 * Bölüm bazlı görev dağılımı ve ilerlemesi.
 *
 * GET dağıtım tablosunu kurar: hangi bölüm kimde, ne kadarı doldu, kimler
 * katkı verebilir. Katkıcı da okuyabilir — "atık bölümü Ayşe'de" bilgisi
 * ekipte saklanacak bir şey değil; yazma yetkisi koordinatörde.
 *
 * Sektör kapsamı dışındaki bölümler listelenmez: kimseye sorulmayacak bir
 * bölümü dağıtmak boş iş yaratır (bkz. lib/sector-scope).
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const surveyId = new URL(request.url).searchParams.get("surveyId");
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const accessError = await validateSurveyAccess(auth.userId, auth.user.role, surveyId);
    if (accessError) return accessError;

    const context = await getAssessmentContext(auth.userId, surveyId);

    const [categories, assignments, members, scopeOf] = await Promise.all([
      prisma.category.findMany({
        where: { surveyId, archivedAt: null },
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { questions: { where: { archivedAt: null } } } },
          subCategories: {
            where: { archivedAt: null },
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              _count: { select: { questions: { where: { archivedAt: null } } } },
              subLevels: {
                where: { archivedAt: null },
                select: {
                  _count: { select: { questions: { where: { archivedAt: null } } } },
                },
              },
            },
          },
        },
      }),
      context.assessmentId ? getSectionAssignments(context.assessmentId) : [],
      getContributorCandidates({ unitId: context.unitId, ownerUserId: auth.userId }),
      getScopeResolver(auth.userId, surveyId),
    ]);

    const assigneeOfSection = new Map(
      assignments.map((assignment) => [assignment.subCategoryId, assignment.assigneeId])
    );

    /**
     * İlerleme: kuruluşun bu ankete verdiği cevaplar bölümlere dağıtılır.
     * Bir değerlendirmede en fazla soru sayısı kadar cevap olduğu için
     * gruplama bellekte yapılır; bölüm başına ayrı sorgu atmaya değmez.
     */
    const responses = context.assessmentId
      ? await prisma.surveyResponse.findMany({
          where: { assessmentId: context.assessmentId, question: { archivedAt: null } },
          select: {
            value: true,
            updatedAt: true,
            question: {
              select: {
                categoryId: true,
                subCategoryId: true,
                subLevel: { select: { subCategoryId: true } },
              },
            },
          },
        })
      : [];

    const answeredBySection = new Map<string, number>();
    const answeredByCategory = new Map<string, number>();
    const lastAnsweredAt = new Map<string, Date>();

    for (const response of responses) {
      // Boş değer cevap sayılmaz; anket ekranı da öyle sayıyor.
      if (!response.value) continue;

      const sectionId = sectionOfQuestion(response.question);

      if (!sectionId) {
        const categoryId = response.question.categoryId;
        if (categoryId) {
          answeredByCategory.set(categoryId, (answeredByCategory.get(categoryId) ?? 0) + 1);
        }
        continue;
      }

      answeredBySection.set(sectionId, (answeredBySection.get(sectionId) ?? 0) + 1);

      const previous = lastAnsweredAt.get(sectionId);
      if (!previous || response.updatedAt > previous) {
        lastAnsweredAt.set(sectionId, response.updatedAt);
      }
    }

    const shaped = categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        // Doğrudan kategoriye bağlı sorular atanamaz; koordinatörde kalır.
        directQuestionCount: category._count.questions,
        directAnsweredCount: answeredByCategory.get(category.id) ?? 0,
        sections: category.subCategories
          .filter((subCategory) => scopeOf(subCategory.id).applicable)
          .map((subCategory) => ({
            id: subCategory.id,
            name: subCategory.name,
            questionCount:
              subCategory._count.questions +
              subCategory.subLevels.reduce((sum, level) => sum + level._count.questions, 0),
            answeredCount: answeredBySection.get(subCategory.id) ?? 0,
            lastAnsweredAt: lastAnsweredAt.get(subCategory.id) ?? null,
            assigneeId: assigneeOfSection.get(subCategory.id) ?? null,
          })),
      }))
      .filter((category) => category.sections.length > 0 || category.directQuestionCount > 0);

    return NextResponse.json({
      assessmentId: context.assessmentId,
      isCoordinator: context.isCoordinator,
      distributed: assignments.length > 0,
      status: context.status,
      submittedAt: context.submittedAt,
      locked: context.locked,
      members,
      mySectionIds: assignments
        .filter((assignment) => assignment.assigneeId === auth.userId)
        .map((assignment) => assignment.subCategoryId),
      categories: shaped,
    });
  } catch (error) {
    console.error("Error fetching section assignments:", error);
    return NextResponse.json({ error: "Görev dağılımı alınamadı" }, { status: 500 });
  }
}

/**
 * Tek bir bölümün sorumlusunu değiştirir.
 *
 * `assigneeId: null` atamayı kaldırır — kayıt yokluğu "dağıtılmadı" demektir
 * ve bölüm koordinatöre döner. Tekillik veritabanındaki @@unique ile
 * garanti altında; buradaki upsert yalnızca sorumluyu değiştirir.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { surveyId, subCategoryId } = body ?? {};
    const assigneeId: string | null = body?.assigneeId || null;

    if (!surveyId || !subCategoryId) {
      return NextResponse.json(
        { error: "surveyId ve subCategoryId gerekli" },
        { status: 400 }
      );
    }

    const accessError = await validateSurveyAccess(auth.userId, auth.user.role, surveyId);
    if (accessError) return accessError;

    const context = await getAssessmentContext(auth.userId, surveyId);
    if (!context.isCoordinator) {
      return NextResponse.json(
        { error: "Görev dağıtma yetkiniz yok." },
        { status: 403 }
      );
    }

    // Gönderilmiş değerlendirmede dağıtım da donar: kimin neyi doldurduğu
    // kaydın bir parçası, sonradan değiştirilmemeli.
    if (context.locked) {
      return NextResponse.json(
        { error: "Değerlendirme gönderildi; görev dağılımı kilitli." },
        { status: 403 }
      );
    }

    // Bölüm gerçekten bu ankete mi ait? Aksi hâlde başka bir anketin bölümü
    // bu değerlendirmeye iliştirilebilirdi.
    const subCategory = await prisma.subCategory.findUnique({
      where: { id: subCategoryId },
      select: { archivedAt: true, category: { select: { surveyId: true } } },
    });

    if (!subCategory || subCategory.archivedAt || subCategory.category.surveyId !== surveyId) {
      return NextResponse.json({ error: "Bölüm bu ankete ait değil." }, { status: 400 });
    }

    const assessmentId = await getOrCreateAssessment(auth.userId, surveyId);

    if (!assigneeId) {
      await prisma.sectionAssignment.deleteMany({ where: { assessmentId, subCategoryId } });
      return NextResponse.json({ success: true, removed: true });
    }

    // Sorumlu, değerlendirmeye katkı verebilecek biri olmalı.
    const members = await getContributorCandidates({
      unitId: context.unitId,
      ownerUserId: auth.userId,
    });

    if (!members.some((member) => member.id === assigneeId)) {
      return NextResponse.json(
        { error: "Bu kişi kuruluşun bir üyesi değil." },
        { status: 400 }
      );
    }

    const assignment = await prisma.sectionAssignment.upsert({
      where: { assessmentId_subCategoryId: { assessmentId, subCategoryId } },
      update: { assigneeId, assignedById: auth.userId },
      create: { assessmentId, subCategoryId, assigneeId, assignedById: auth.userId },
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error) {
    console.error("Error saving section assignment:", error);
    return NextResponse.json({ error: "Görev ataması kaydedilemedi" }, { status: 500 });
  }
}
