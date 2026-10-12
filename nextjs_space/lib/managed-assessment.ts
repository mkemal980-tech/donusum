import { prisma } from "./db";
import { getManagedUnitIds, type DbClient } from "./assessment";
import { isLocked } from "./submission";
import type { ScoringAssessment } from "./scoring";

export type ManagedActor = { userId: string; user: { role: string; unitId?: string | null } };

export class ManagedAssessmentError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
  }
}

export const MANAGED_ASSESSMENT_INCLUDE = {
  unit: { select: { id: true, name: true, sectorId: true, subSectorId: true } },
  survey: { select: { id: true, name: true, isActive: true, archivedAt: true, isDemo: true } },
  campaignRecipient: {
    include: {
      campaign: { select: { id: true, name: true, tenantUnitId: true, privacyMode: true, status: true, deadline: true, launchedAt: true } },
    },
  },
} as const;

export async function managedUnitScope(actor: ManagedActor, db: DbClient = prisma): Promise<{ in: string[] } | { not: null }> {
  if (actor.user.role === "ADMIN") return { not: null };
  if (actor.user.role !== "UNIT_MANAGER") throw new ManagedAssessmentError("Birim yönetme yetkiniz yok.");
  return { in: await getManagedUnitIds(actor.userId, db) };
}

/** Anonim kampanyada üst kuruluş, bir üyenin tekil sonucunu okuyamaz. */
export async function canReadManagedCampaign(
  actor: ManagedActor,
  unitId: string,
  privacyMode: string | undefined,
  db: DbClient = prisma
) {
  if (actor.user.role === "ADMIN" || privacyMode !== "ANONYMOUS") return true;
  return (await db.unitAdmin.count({ where: { userId: actor.userId, unitId } })) > 0;
}

export async function resolveManagedAssessment(actor: ManagedActor, assessmentId: string, db: DbClient = prisma) {
  if (typeof assessmentId !== "string" || !assessmentId.trim()) throw new ManagedAssessmentError("Geçerli değerlendirme kimliği gerekli.", 400);
  const scope = await managedUnitScope(actor, db);
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, unitId: scope, survey: { isDemo: false } },
    include: MANAGED_ASSESSMENT_INCLUDE,
  });
  if (!assessment?.unitId || !assessment.unit) throw new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok.");
  if (!(await canReadManagedCampaign(actor, assessment.unitId, assessment.campaignRecipient?.campaign.privacyMode, db))) {
    throw new ManagedAssessmentError("Anonim kampanyanın tekil sonuçları görüntülenemez.");
  }
  return {
    ...assessment,
    scoring: {
      id: assessment.id,
      surveyId: assessment.surveyId,
      sectorId: assessment.unit.sectorId,
      subSectorId: assessment.unit.subSectorId,
    } satisfies ScoringAssessment,
    context: {
      assessmentId: assessment.id,
      unitId: assessment.unitId,
      isCoordinator: true,
      status: assessment.status,
      submittedAt: assessment.submittedAt,
      locked: isLocked(assessment.status) || !assessment.survey.isActive || Boolean(assessment.survey.archivedAt) || assessment.campaignRecipient?.campaign.status === "CLOSED",
    },
  };
}
