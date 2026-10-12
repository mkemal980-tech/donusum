export const dynamic = "force-dynamic";
export const maxDuration = 180;

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { getAssessmentIds } from "@/lib/assessment";
import { getAccessibleSurveyIds, getRecommendationsForUser, getScopeResolver } from "@/lib/scoring";
import { callLLMForJSON, isLLMConfigured } from "@/lib/llm";
import { currentRoadmapQuarter, hasRoadmapTiming, roadmapQuarterIndex } from "@/lib/roadmap-calendar";
import {
  buildRoadmapPlanningPrompt, eligibleRoadmapCandidates, ROADMAP_PLANNER_SYSTEM_PROMPT,
  validateRoadmapSelection, type GeneratedRoadmapSelection, type RoadmapPlanningGroup,
} from "@/lib/roadmap-planner";

async function loadPlanningContext(userId: string) {
  const surveyIds = await getAccessibleSurveyIds(userId);
  const [recommendations, assessmentIds, scopeOf] = await Promise.all([
    getRecommendationsForUser(userId), getAssessmentIds(userId, surveyIds),
    getScopeResolver(userId, undefined),
  ]);
  const [existing, assessments, subCategories] = await Promise.all([
    prisma.roadmapItem.findMany({ where: { assessmentId: { in: assessmentIds } } }),
    prisma.assessment.findMany({
      where: { id: { in: assessmentIds } }, select: { id: true, surveyId: true },
    }),
    prisma.subCategory.findMany({
      where: {
        id: { in: recommendations.flatMap((item) => item.resolvedSubCategoryId ? [item.resolvedSubCategoryId] : []) },
        archivedAt: null,
        category: { archivedAt: null, surveyId: { in: surveyIds } },
      },
      select: { id: true, name: true, category: { select: { name: true, surveyId: true } } },
      orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    }),
  ]);
  const candidates = eligibleRoadmapCandidates(recommendations, existing);
  const assessmentBySurvey = new Map(assessments.map((item) => [item.surveyId, item.id]));
  const groups: RoadmapPlanningGroup[] = [];
  for (const subCategory of subCategories) {
    const surveyId = subCategory.category.surveyId;
    if (!surveyId) continue;
    const assessmentId = assessmentBySurvey.get(surveyId);
    if (!assessmentId || !scopeOf(subCategory.id).applicable) continue;
    const rows = candidates.filter((item) => item.resolvedSubCategoryId === subCategory.id);
    if (rows.length === 0) continue;
    groups.push({
      subCategoryId: subCategory.id, subCategoryName: subCategory.name,
      categoryName: subCategory.category.name, assessmentId, candidates: rows,
    });
  }
  return { groups, existing, assessmentIds };
}

class StaleRoadmapPlanError extends Error {}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { rateLimit: "ai" });
  if (!auth.success) return auth.response;
  if (!isLLMConfigured()) {
    return NextResponse.json({ error: "AI hizmeti şu anda kullanılamıyor. Lütfen yöneticinizle iletişime geçin." }, { status: 503 });
  }

  try {
    const context = await loadPlanningContext(auth.userId);
    if (context.groups.length === 0) {
      return NextResponse.json({
        error: "Yol haritasına eklenebilecek öneri yok. Anket yanıtlarınızı ve önerilerin basamak durumlarını kontrol edin.",
      }, { status: 400 });
    }
    const start = currentRoadmapQuarter();
    const batches: RoadmapPlanningGroup[][] = [];
    for (let offset = 0; offset < context.groups.length; offset += 4) {
      batches.push(context.groups.slice(offset, offset + 4));
    }
    const selections: GeneratedRoadmapSelection[] = [];
    try {
      // Uzun yanıtları küçük gruplara böler; aynı anda en fazla üç AI isteği.
      for (let offset = 0; offset < batches.length; offset += 3) {
        const generated = await Promise.all(batches.slice(offset, offset + 3).map(async (groups) => {
          const result = await callLLMForJSON<unknown>(
            buildRoadmapPlanningPrompt(groups, start, context.existing),
            ROADMAP_PLANNER_SYSTEM_PROMPT, { temperature: 0.2, maxTokens: 4000 },
          );
          return validateRoadmapSelection(result, groups, start);
        }));
        selections.push(...generated.flat());
      }
    } catch {
      return NextResponse.json({ error: "AI geçerli bir yol haritası oluşturamadı. Lütfen tekrar deneyin." }, { status: 502 });
    }

    // AI beklenirken cevaplar, kademe veya erişim değişmiş olabilir.
    const latest = await loadPlanningContext(auth.userId);
    for (const selection of selections) {
      const group = latest.groups.find((item) => item.subCategoryId === selection.subCategoryId);
      if (group?.assessmentId !== selection.assessmentId || !group.candidates.some((item) => item.id === selection.recommendationId)) {
        throw new StaleRoadmapPlanError();
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.roadmapItem.findMany({ where: { assessmentId: { in: latest.assessmentIds } } });
      const byKey = new Map(current.map((item) => [`${item.assessmentId}:${item.recommendationId}`, item]));
      for (const selection of selections) {
        const item = byKey.get(`${selection.assessmentId}:${selection.recommendationId}`);
        if (item?.status === "COMPLETED" || item?.status === "CANCELLED") throw new StaleRoadmapPlanError();
        if (item && hasRoadmapTiming(item)) {
          selection.plannedQuarter = item.plannedQuarter!;
          selection.plannedYear = item.plannedYear!;
        }
      }
      selections.sort((a, b) =>
        roadmapQuarterIndex({ q: a.plannedQuarter, year: a.plannedYear }) -
        roadmapQuarterIndex({ q: b.plannedQuarter, year: b.plannedYear })
      );
      let addedCount = 0;
      let scheduledCount = 0;
      let preservedCount = 0;
      for (const [index, selection] of selections.entries()) {
        const item = byKey.get(`${selection.assessmentId}:${selection.recommendationId}`);
        if (item && hasRoadmapTiming(item)) {
          selection.priority = item.priority;
          preservedCount++;
          continue;
        }
        selection.priority = index + 1;
        const timing = {
          plannedQuarter: selection.plannedQuarter, plannedYear: selection.plannedYear, priority: selection.priority,
        };
        // Yalnızca zamanlama yazılır. Durum ve puan değişimi ortak serviste kalır.
        await tx.roadmapItem.upsert({
          where: { assessmentId_recommendationId: {
            assessmentId: selection.assessmentId, recommendationId: selection.recommendationId,
          } },
          update: timing,
          create: { assessmentId: selection.assessmentId, recommendationId: selection.recommendationId, ...timing },
        });
        if (item) scheduledCount++;
        else addedCount++;
      }
      return {
        categoryCount: context.groups.length, selectedCount: selections.length,
        addedCount, scheduledCount, preservedCount, selections,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof StaleRoadmapPlanError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) {
      return NextResponse.json({ error: "Öneriler veya yol haritası işlem sırasında değişti. Lütfen tekrar deneyin." }, { status: 409 });
    }
    console.error("Error generating roadmap:", error);
    return NextResponse.json({ error: "Yol haritası oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }
}
