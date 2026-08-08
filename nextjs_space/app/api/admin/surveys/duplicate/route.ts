export const dynamic = "force-dynamic";

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { nextCopyName, type DuplicateSummary } from "@/lib/survey-duplicate";

/**
 * Anketi her şeyiyle çoğaltır (bkz. lib/survey-duplicate — ne kopyalanır,
 * ne kopyalanmaz ve neden).
 *
 * TEK İŞLEM
 * Kopyalama tek transaction içinde yapılır: yarım kalmış bir kopya, soruları
 * eksik ama kullanılabilir görünen bir anket demek olurdu ve bu hatanın fark
 * edilmesi haftalar alırdı.
 *
 * KİMLİKLER ÖNCEDEN ÜRETİLİR
 * Kayıtlar tek tek değil toplu ekleniyor (createMany), çünkü 71 soruluk bir
 * ankette tek tek ekleme yüzlerce gidiş-geliş demek. Toplu ekleme kimlik
 * döndürmediği için kimlikler burada üretilip eşleme tablosunda tutuluyor;
 * öneriler ve kapsam kuralları yeni kimliklere bu tablodan bağlanıyor.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const surveyId: string | undefined = body?.surveyId;
    const requestedName: string | undefined = body?.name?.trim() || undefined;

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const source = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { id: true, name: true, description: true, order: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Anket bulunamadı" }, { status: 404 });
    }

    const existingNames = (
      await prisma.survey.findMany({ select: { name: true } })
    ).map((survey) => survey.name);

    const name = requestedName ?? nextCopyName(source.name, existingNames);

    // Arşivlenmiş içerik kopyalanmaz: kullanıcı onları silmişti.
    const categories = await prisma.category.findMany({
      where: { surveyId: source.id, archivedAt: null },
      orderBy: { order: "asc" },
      include: {
        questions: { where: { archivedAt: null } },
        subCategories: {
          where: { archivedAt: null },
          orderBy: { order: "asc" },
          include: {
            questions: { where: { archivedAt: null } },
            subLevels: {
              where: { archivedAt: null },
              orderBy: { order: "asc" },
              include: { questions: { where: { archivedAt: null } } },
            },
          },
        },
      },
    });

    /** eski kimlik → yeni kimlik */
    const categoryIds = new Map<string, string>();
    const subCategoryIds = new Map<string, string>();
    const subLevelIds = new Map<string, string>();
    const questionIds = new Map<string, string>();

    const newSurveyId = randomUUID();

    const categoryRows: any[] = [];
    const subCategoryRows: any[] = [];
    const subLevelRows: any[] = [];
    const questionRows: any[] = [];

    const cloneQuestion = (
      question: any,
      target: { categoryId?: string; subCategoryId?: string; subLevelId?: string }
    ) => {
      const id = randomUUID();
      questionIds.set(question.id, id);
      questionRows.push({
        id,
        text: question.text,
        type: question.type,
        options: question.options ?? undefined,
        conditionalOptions: question.conditionalOptions ?? undefined,
        weight: question.weight,
        requiresEvidence: question.requiresEvidence,
        order: question.order,
        axisType: question.axisType,
        categoryId: target.categoryId ?? null,
        subCategoryId: target.subCategoryId ?? null,
        subLevelId: target.subLevelId ?? null,
      });
    };

    for (const category of categories) {
      const categoryId = randomUUID();
      categoryIds.set(category.id, categoryId);
      categoryRows.push({
        id: categoryId,
        name: category.name,
        description: category.description,
        order: category.order,
        surveyId: newSurveyId,
      });

      for (const question of category.questions) cloneQuestion(question, { categoryId });

      for (const subCategory of category.subCategories) {
        const subCategoryId = randomUUID();
        subCategoryIds.set(subCategory.id, subCategoryId);
        subCategoryRows.push({
          id: subCategoryId,
          name: subCategory.name,
          description: subCategory.description,
          order: subCategory.order,
          hasSubLevels: subCategory.hasSubLevels,
          categoryId,
        });

        for (const question of subCategory.questions) cloneQuestion(question, { subCategoryId });

        for (const subLevel of subCategory.subLevels) {
          const subLevelId = randomUUID();
          subLevelIds.set(subLevel.id, subLevelId);
          subLevelRows.push({
            id: subLevelId,
            name: subLevel.name,
            description: subLevel.description,
            order: subLevel.order,
            axisType: subLevel.axisType,
            subCategoryId,
          });

          for (const question of subLevel.questions) cloneQuestion(question, { subLevelId });
        }
      }
    }

    // Öneriler ankete doğrudan bağlı değil; kategori/bölüm/alt seviye/soru
    // üzerinden bağlı. Bu yüzden kopyalanan kimlikler üzerinden aranıyor.
    const recommendations = await prisma.recommendation.findMany({
      where: {
        OR: [
          { categoryId: { in: [...categoryIds.keys()] } },
          { subCategoryId: { in: [...subCategoryIds.keys()] } },
          { subLevelId: { in: [...subLevelIds.keys()] } },
          { questionId: { in: [...questionIds.keys()] } },
        ],
      },
    });

    const recommendationRows = recommendations.map((recommendation) => ({
      id: randomUUID(),
      title: recommendation.title,
      description: recommendation.description,
      costType: recommendation.costType,
      timeframe: recommendation.timeframe,
      strategicType: recommendation.strategicType,
      estimatedImpact: recommendation.estimatedImpact,
      minScoreThreshold: recommendation.minScoreThreshold,
      maxScoreThreshold: recommendation.maxScoreThreshold,
      order: recommendation.order,
      capexLevel: recommendation.capexLevel,
      opexLevel: recommendation.opexLevel,
      xPosition: recommendation.xPosition,
      yPosition: recommendation.yPosition,
      triggerOptions: recommendation.triggerOptions,
      triggerMaxAnswerScore: recommendation.triggerMaxAnswerScore,
      points: recommendation.points,
      videoUrl: recommendation.videoUrl,
      categoryId: recommendation.categoryId
        ? categoryIds.get(recommendation.categoryId) ?? null
        : null,
      subCategoryId: recommendation.subCategoryId
        ? subCategoryIds.get(recommendation.subCategoryId) ?? null
        : null,
      subLevelId: recommendation.subLevelId
        ? subLevelIds.get(recommendation.subLevelId) ?? null
        : null,
      questionId: recommendation.questionId
        ? questionIds.get(recommendation.questionId) ?? null
        : null,
    }));

    const scopeRules = await prisma.sectorScopeRule.findMany({ where: { surveyId: source.id } });
    const scopeRuleRows = scopeRules
      .filter((rule) => subCategoryIds.has(rule.subCategoryId))
      .map((rule) => ({
        id: randomUUID(),
        sectorId: rule.sectorId,
        subSectorId: rule.subSectorId,
        surveyId: newSurveyId,
        subCategoryId: subCategoryIds.get(rule.subCategoryId)!,
        applicable: rule.applicable,
        weight: rule.weight,
      }));

    const benchmarks = await prisma.benchmark.findMany({ where: { surveyId: source.id } });
    const benchmarkRows = benchmarks.map((benchmark) => ({
      id: randomUUID(),
      sectorId: benchmark.sectorId,
      subSectorId: benchmark.subSectorId,
      surveyId: newSurveyId,
      level: benchmark.level,
      // targetId, seviyesine göre kategori ya da bölümü işaret eder; kopyada
      // yenisini göstermeli, yoksa kıyas eski anketin kategorisine bakardı.
      targetId: benchmark.targetId
        ? categoryIds.get(benchmark.targetId) ??
          subCategoryIds.get(benchmark.targetId) ??
          benchmark.targetId
        : null,
      bestScore: benchmark.bestScore,
      averageScore: benchmark.averageScore,
    }));

    await prisma.$transaction(
      async (tx) => {
        await tx.survey.create({
          data: {
            id: newSurveyId,
            name,
            description: source.description,
            order: source.order,
            // Kopya pasif başlar: gözden geçirilmeden kullanıcıların ekranında
            // belirmemeli.
            isActive: false,
          },
        });

        if (categoryRows.length) await tx.category.createMany({ data: categoryRows });
        if (subCategoryRows.length) await tx.subCategory.createMany({ data: subCategoryRows });
        if (subLevelRows.length) await tx.subLevel.createMany({ data: subLevelRows });
        if (questionRows.length) await tx.question.createMany({ data: questionRows });
        if (recommendationRows.length)
          await tx.recommendation.createMany({ data: recommendationRows });
        if (scopeRuleRows.length) await tx.sectorScopeRule.createMany({ data: scopeRuleRows });
        if (benchmarkRows.length) await tx.benchmark.createMany({ data: benchmarkRows });
      },
      { timeout: 30_000 }
    );

    const summary: DuplicateSummary = {
      categories: categoryRows.length,
      subCategories: subCategoryRows.length,
      subLevels: subLevelRows.length,
      questions: questionRows.length,
      recommendations: recommendationRows.length,
      scopeRules: scopeRuleRows.length,
      benchmarks: benchmarkRows.length,
    };

    return NextResponse.json({ success: true, survey: { id: newSurveyId, name }, summary });
  } catch (error) {
    console.error("Anket kopyalama hatası:", error);
    return NextResponse.json({ error: "Anket kopyalanamadı" }, { status: 500 });
  }
}
