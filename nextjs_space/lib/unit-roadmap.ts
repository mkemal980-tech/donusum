import { prisma } from "./db";
import type { DbClient } from "./assessment";
import type { ManagedActor, ResolvedAssessment } from "./managed-assessment";
import { loadManagedStructure } from "./unit-dashboard";
import { getRecommendationsForUser } from "./scoring";
import { updateRoadmapStatus } from "./roadmap-status";
import { loadRoadmapAccess, ROADMAP_FORBIDDEN } from "./roadmap-access";
import type { ViewerRole } from "./assessment-view";

type Outcome = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Outcome => ({ status, body: { error } });

/**
 * Panodan yol haritası kaydı. Yönetici iş ekler, planlar, sorumlu ve tarih
 * atar; çalışan yalnızca kendisine düşen işin durumunu değiştirir (bkz.
 * lib/roadmap-access). Kayıt her zaman ekranda açık olan değerlendirmeye
 * yazılır — çalışan geçmiş bir döneme bakarken güncel döneme yazılmaz.
 */
export async function saveAssessmentRoadmap(
  actor: ManagedActor, role: ViewerRole, record: ResolvedAssessment,
  body: { recommendationId: string; status?: unknown; assigneeId?: unknown; dueDate?: unknown },
  db: DbClient = prisma,
): Promise<Outcome> {
  if (!record.survey.isActive || record.survey.archivedAt || record.campaignRecipient?.campaign.status === "CLOSED") return fail(409, "Bu değerlendirme dönemi kapalı.");
  const scoring = (await loadManagedStructure(record.scoring, db)).scoring;
  const existing = await db.roadmapItem.findUnique({
    where: { assessmentId_recommendationId: { assessmentId: record.id, recommendationId: body.recommendationId } },
  });

  if (role === "member") {
    if ("assigneeId" in body || "dueDate" in body || body.status === undefined) return fail(403, ROADMAP_FORBIDDEN);
    const access = await loadRoadmapAccess(actor.userId, [record.id], db);
    if (!existing || !access.canUpdate(body.recommendationId)) return fail(403, ROADMAP_FORBIDDEN);
    const outcome = await updateRoadmapStatus(actor.userId, { recommendationId: body.recommendationId, assessment: scoring, status: body.status });
    return outcome.ok ? { status: 200, body: { success: true, earned: outcome.result.earned } } : fail(outcome.error.httpStatus, outcome.error.message);
  }

  const available = await getRecommendationsForUser(actor.userId, { assessment: scoring, db });
  if (!existing && !available.some(rec => rec.id === body.recommendationId && rec.isActionable)) return fail(403, "Bu öneri biriminize açık değil.");
  const metadata: { assigneeId?: string | null; dueDate?: Date | null } = {};
  if ("assigneeId" in body) {
    if (body.assigneeId !== null && typeof body.assigneeId !== "string") return fail(400, "Geçersiz sorumlu.");
    if (body.assigneeId) {
      const member = await db.user.findFirst({ where: { id: body.assigneeId, unitId: record.unitId, isActive: true }, select: { id: true } });
      if (!member) return fail(400, "Sorumlu bu birimin aktif üyesi olmalı.");
    }
    metadata.assigneeId = (body.assigneeId as string | null) || null;
  }
  if ("dueDate" in body) {
    if (body.dueDate === null || body.dueDate === "") metadata.dueDate = null;
    else {
      const day = body.dueDate;
      if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(new Date(day).getTime()) || new Date(day).toISOString().slice(0, 10) !== day) {
        return fail(400, "Hedef tarih geçerli bir tarih olmalı.");
      }
      metadata.dueDate = new Date(day + "T23:59:59.999+03:00");
    }
  }
  if (body.status === undefined && existing) {
    await db.roadmapItem.update({ where: { id: existing.id }, data: metadata });
    return { status: 200, body: { success: true } };
  }
  const outcome = await updateRoadmapStatus(actor.userId, {
    recommendationId: body.recommendationId, assessment: scoring, status: body.status ?? "PLANNED", ...metadata,
  });
  return outcome.ok ? { status: 200, body: { success: true, earned: outcome.result.earned } } : fail(outcome.error.httpStatus, outcome.error.message);
}
