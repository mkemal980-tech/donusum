import { prisma } from "./db";
import { getAssessmentIds, getOrCreateAssessment } from "./assessment";
import {
  calculateProgressScores,
  getAccessibleSurveyIds,
  isRecommendationActionable,
  type DbClient,
  type ProgressScores
} from "./scoring";

/**
 * Yol haritası durumunun tek servisi (docs/GELISIM-PUANI.md, kural 5-6).
 *
 * Öneriler sayfası da yol haritası sayfası da buradan geçer; böylece kilit,
 * skor geçmişi ve dönen sayılar hangi ekrandan yapıldığından bağımsız olarak
 * aynıdır. Eskiden iki uç iki ayrı kural setiyle çalışıyordu: yol haritası
 * sayfasından yapılan tamamlama kilidi atlıyor ve trend grafiğine hiç
 * düşmüyordu.
 */

export const ROADMAP_STATUSES = [
  "NOT_STARTED",
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
  return typeof value === "string" && (ROADMAP_STATUSES as readonly string[]).includes(value);
}

/** İleri yönde hareket yumuşak kilide tabidir; geri alma her zaman serbest. */
export function isForwardMove(status: RoadmapStatus): boolean {
  return status === "IN_PROGRESS" || status === "COMPLETED";
}

export type RoadmapStatusError = {
  code: "INVALID_STATUS" | "LOCKED" | "NO_SURVEY" | "NOT_FOUND";
  message: string;
  httpStatus: number;
};

export type RoadmapStatusResult = {
  item: Awaited<ReturnType<typeof upsertItem>>;
  surveyId: string;
  wasCompleted: boolean;
  isCompleted: boolean;
  /** Değişiklik öncesi ve sonrası gelişim puanı. */
  before: ProgressScores;
  after: ProgressScores;
  /** Bu değişikliğin genel puana etkisi: after − before (2 ondalık). */
  earned: number;
};

const RECOMMENDATION_INCLUDE = {
  recommendation: {
    include: {
      subLevel: { select: { axisType: true, subCategoryId: true, subCategory: { select: { categoryId: true } } } },
      subCategory: { select: { categoryId: true } }
    }
  }
} as const;

/** Önerinin bağlı olduğu anket. Kapsamsız genel öneride null. */
export async function surveyIdForRecommendation(
  recommendationId: string,
  db: DbClient = prisma
): Promise<string | null> {
  const rec = await db.recommendation.findUnique({
    where: { id: recommendationId },
    select: {
      // Recommendation'ın kategoriye ilişkisi yok, yalnızca kimliği var.
      categoryId: true,
      subCategory: { select: { category: { select: { surveyId: true } } } },
      subLevel: { select: { subCategory: { select: { category: { select: { surveyId: true } } } } } },
      question: {
        select: {
          category: { select: { surveyId: true } },
          subCategory: { select: { category: { select: { surveyId: true } } } },
          subLevel: { select: { subCategory: { select: { category: { select: { surveyId: true } } } } } }
        }
      }
    }
  });
  if (!rec) return null;
  const q = rec.question;
  const fromRelations =
    q?.category?.surveyId ??
    q?.subCategory?.category?.surveyId ??
    q?.subLevel?.subCategory?.category?.surveyId ??
    rec.subCategory?.category?.surveyId ??
    rec.subLevel?.subCategory?.category?.surveyId ??
    null;
  if (fromRelations) return fromRelations;
  if (!rec.categoryId) return null;
  const category = await db.category.findUnique({
    where: { id: rec.categoryId },
    select: { surveyId: true }
  });
  return category?.surveyId ?? null;
}

/**
 * Önerinin değerlendirmesini çözer: önce önerinin kendi anketi, yoksa
 * çağıranın verdiği anket, o da yoksa erişilebilen ilk anket.
 */
export async function resolveAssessmentForRecommendation(
  userId: string,
  recommendationId: string,
  surveyIdHint?: string,
  db: DbClient = prisma
): Promise<{ assessmentId: string; surveyId: string } | null> {
  const surveyId =
    (await surveyIdForRecommendation(recommendationId, db)) ??
    surveyIdHint ??
    (await getAccessibleSurveyIds(userId, undefined, db))[0];
  if (!surveyId) return null;
  return { assessmentId: await getOrCreateAssessment(userId, surveyId, db), surveyId };
}

/** Skor geçmişine kayıt ekler; puanı motor üretir. */
export async function recordScoreHistory(
  userId: string,
  triggerType: string,
  triggerEntityId?: string,
  surveyId?: string,
  db: DbClient = prisma
): Promise<ProgressScores> {
  const scores = await calculateProgressScores(userId, { surveyId, db });
  const assessmentIds = await getAssessmentIds(
    userId,
    surveyId ? [surveyId] : await getAccessibleSurveyIds(userId, undefined, db),
    db
  );

  if (assessmentIds[0]) {
    await db.scoreHistory.create({
      data: {
        assessmentId: assessmentIds[0],
        surveyId: surveyId ?? null,
        overallScore: scores.overallScore,
        overallPercentage: scores.overallPercentage,
        velocityScore: scores.velocityScore,
        enduranceScore: scores.enduranceScore,
        quadrant: scores.quadrant,
        completedQuestions: scores.completedQuestions,
        totalQuestions: scores.totalQuestions,
        completedRecommendations: scores.completedRecommendations,
        triggerType,
        triggerEntityId
      }
    });
  }

  return scores;
}

function upsertItem(
  db: DbClient,
  assessmentId: string,
  recommendationId: string,
  data: {
    status: RoadmapStatus;
    plannedQuarter?: number | null;
    plannedYear?: number | null;
    priority?: number;
  }
) {
  const timing = {
    ...(data.plannedQuarter !== undefined && { plannedQuarter: data.plannedQuarter }),
    ...(data.plannedYear !== undefined && { plannedYear: data.plannedYear }),
    ...(data.priority !== undefined && { priority: data.priority })
  };
  return db.roadmapItem.upsert({
    where: { assessmentId_recommendationId: { assessmentId, recommendationId } },
    create: {
      assessmentId,
      recommendationId,
      status: data.status,
      plannedQuarter: data.plannedQuarter ?? null,
      plannedYear: data.plannedYear ?? null,
      priority: data.priority ?? 0
    },
    update: { status: data.status, ...timing },
    include: RECOMMENDATION_INCLUDE
  });
}

export type UpdateRoadmapStatusInput = {
  recommendationId: string;
  status: unknown;
  /** Öneri bir ankete bağlı değilse kullanılacak anket. */
  surveyId?: string;
  plannedQuarter?: number | null;
  plannedYear?: number | null;
  priority?: number;
};

/**
 * Durumu günceller.
 *
 * - Geçersiz durum → 400
 * - İleri yönde hareket ve sırası gelmemiş basamak → 409
 * - `COMPLETED` durumuna giriş ve çıkış skor geçmişine kayıt düşer; upsert ve
 *   kayıt tek transaction'dadır, yarım kalmış yazma olmaz.
 * - Dönüşte önceki/sonraki puan ve bu değişikliğin farkı vardır; ekranlar
 *   kendi hesabını yapmaz.
 */
export async function updateRoadmapStatus(
  userId: string,
  input: UpdateRoadmapStatusInput,
  db: DbClient = prisma
): Promise<{ ok: true; result: RoadmapStatusResult } | { ok: false; error: RoadmapStatusError }> {
  if (!isRoadmapStatus(input.status)) {
    return {
      ok: false,
      error: { code: "INVALID_STATUS", message: "Geçersiz durum değeri.", httpStatus: 400 }
    };
  }
  const status = input.status;

  if (isForwardMove(status)) {
    const actionable = await isRecommendationActionable(userId, input.recommendationId);
    if (!actionable) {
      return {
        ok: false,
        error: {
          code: "LOCKED",
          message: "Bu öneriye sıra gelmedi. Önce bir önceki basamağı tamamlayın.",
          httpStatus: 409
        }
      };
    }
  }

  const resolved = await resolveAssessmentForRecommendation(userId, input.recommendationId, input.surveyId, db);
  if (!resolved) {
    return {
      ok: false,
      error: { code: "NO_SURVEY", message: "Öneri bir ankete bağlı değil.", httpStatus: 400 }
    };
  }
  const { assessmentId, surveyId } = resolved;

  const before = await calculateProgressScores(userId, { surveyId, db });

  const run = async (tx: DbClient) => {
    const previous = await tx.roadmapItem.findUnique({
      where: { assessmentId_recommendationId: { assessmentId, recommendationId: input.recommendationId } },
      select: { status: true }
    });
    const wasCompleted = previous?.status === "COMPLETED";
    const isCompleted = status === "COMPLETED";

    const item = await upsertItem(tx, assessmentId, input.recommendationId, {
      status,
      plannedQuarter: input.plannedQuarter,
      plannedYear: input.plannedYear,
      priority: input.priority
    });

    // Tamamlanma durumu değiştiyse trend grafiğine nokta düşer; yön fark
    // etmez — geri alınan bir tamamlama da puanı düşürür ve görünmelidir.
    const after = wasCompleted !== isCompleted
      ? await recordScoreHistory(
          userId,
          isCompleted ? "RECOMMENDATION_COMPLETED" : "RECOMMENDATION_REVERTED",
          input.recommendationId,
          surveyId,
          tx
        )
      : await calculateProgressScores(userId, { surveyId, db: tx });

    return { item, wasCompleted, isCompleted, after };
  };

  // Transaction istemcisi $transaction taşımaz; zaten bir işlem içindeysek
  // aynı istemciyle devam edilir.
  const outcome = "$transaction" in db && typeof db.$transaction === "function"
    ? await db.$transaction(run)
    : await run(db);

  // Taban her iki hesapta da aynı; fark 2 ondalıkla tam okunur.
  const earned = Math.round((outcome.after.delta - before.delta) * 100) / 100;

  return {
    ok: true,
    result: { ...outcome, surveyId, before, earned }
  };
}
