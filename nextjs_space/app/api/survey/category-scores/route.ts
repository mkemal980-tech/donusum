import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import {
  breakdownPercentage, calculateProgressBreakdown, getAccessibleSurveyIds, getScopeResolver,
  type ProgressBreakdownNode,
} from "@/lib/scoring";
import { canReadSurveyTemplate } from "@/lib/survey-management";

export const dynamic = "force-dynamic";

/**
 * Kategori analizi için kategori → bölüm → basamak puanları.
 *
 * Sayılar ilerleme motorundan gelir (docs/GELISIM-PUANI.md): birim panosu,
 * yönetim panosu ve yol haritasıyla aynı "mevcut puan". Eskiden bu rota
 * genel puanı başka bir motordan, kategori ve basamakları kendi içindeki
 * üçüncü bir hesaptan üretiyordu; tamamlanan öneriler hiç görünmüyor, aynı
 * değerlendirme birim panosunda farklı puan gösteriyordu. Soru sayıları
 * kapsamdaki sorulardan sayılır: arşivlenmiş veya sektör kapsamı dışındaki
 * soru tamamlanacak iş gibi görünmez.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const requestedSurveyId = searchParams.get("surveyId");

    // Anket adları ve yapısı başka kiracıya ait özel anketten okunamaz.
    if (requestedSurveyId && !(await canReadSurveyTemplate(userId, auth.user.role, requestedSurveyId))) {
      return NextResponse.json({ error: "Bu ankete erişiminiz yok" }, { status: 403 });
    }
    const surveyId = requestedSurveyId ?? (await getAccessibleSurveyIds(userId))[0];
    if (!surveyId) return NextResponse.json({ overallScore: 0, overallPercentage: 0, baselinePercentage: 0, surveyId: null, categories: [] });

    const [categories, progress, scopeOf] = await Promise.all([
      prisma.category.findMany({
        where: { surveyId, archivedAt: null },
        orderBy: { order: "asc" },
        select: {
          id: true, name: true, description: true, surveyId: true, survey: { select: { name: true } },
          subCategories: {
            where: { archivedAt: null }, orderBy: { order: "asc" },
            select: { id: true, name: true, subLevels: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true } } },
          },
        },
      }),
      calculateProgressBreakdown(userId, { surveyId }),
      getScopeResolver(userId, surveyId),
    ]);

    const nodes = new Map<string, ProgressBreakdownNode>();
    for (const category of progress.categories) {
      nodes.set(category.id, category);
      for (const section of category.subCategories) {
        nodes.set(section.id, section);
        for (const level of section.subLevels) nodes.set(level.id, level);
      }
    }
    // Hiç cevaplanmamış düğüm ölçeğin tabanında (1.0 · %0) gösterilir; ekran "veri yok"u soru sayısından okur.
    const view = (id: string) => {
      const node = nodes.get(id);
      const answered = Boolean(node?.responseCount);
      return {
        score: answered ? Math.round(node!.totalScore * 10) / 10 : 1,
        percentage: answered ? Math.round(breakdownPercentage(node!.totalScore)) : 0,
        questionCount: node?.questionCount ?? 0,
        answeredCount: node?.responseCount ?? 0,
      };
    };
    const inScope = (id: string) => (nodes.get(id)?.questionCount ?? 0) > 0;

    const categoryScores = categories.filter(category => inScope(category.id)).map(category => {
      const { questionCount, answeredCount, ...score } = view(category.id);
      return {
        id: category.id, name: category.name, description: category.description,
        surveyId: category.surveyId, surveyName: category.survey?.name,
        ...score, questionCount, answeredCount,
        // Kategorinin göreli ağırlığı bölüm kurallarından türetilir (tek matris).
        weight: category.subCategories.reduce((sum, section) => {
          const scope = scopeOf(section.id);
          return sum + (scope.applicable ? scope.weight : 0);
        }, 0),
        subCategories: category.subCategories.filter(section => inScope(section.id)).map(section => ({
          id: section.id, name: section.name, ...view(section.id), target: 5,
          hasSubLevels: section.subLevels.length > 0,
          subLevels: section.subLevels.filter(level => inScope(level.id)).map(level => ({ id: level.id, name: level.name, ...view(level.id) })),
        })),
      };
    });

    if (categoryId) {
      const category = categoryScores.find(row => row.id === categoryId);
      if (!category) return NextResponse.json({ error: "Kategori bulunamadı" }, { status: 404 });
      return NextResponse.json({ category, overallScore: progress.scores.overallScore });
    }

    return NextResponse.json({
      overallScore: progress.scores.overallScore,
      overallPercentage: progress.scores.overallPercentage,
      baselinePercentage: progress.scores.baselineOverallPercentage,
      surveyId,
      categories: categoryScores,
    });
  } catch (error) {
    console.error("Error fetching category scores:", error);
    return NextResponse.json({ error: "Puanlar alınırken hata oluştu" }, { status: 500 });
  }
}
