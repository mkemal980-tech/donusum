import { prisma } from "./db";
import type { DbClient } from "./assessment";
import { managedUnitScope, ManagedAssessmentError, type ManagedActor } from "./managed-assessment";
import { loadUnitDashboardIndex, loadUnitAssessmentDetail, type UnitAssessmentDetail } from "./unit-dashboard";
import { buildUnitManagementAnalytics, managementGroups, ROOT_GROUP, type ManagementUnit } from "./unit-management-analytics";

export type UnitManagementInput = { unitId?: string | null; surveyId?: string | null; periodId?: string | null };

/**
 * Anket seçenekleri: üyelerde başlatılmış, kampanyayla gönderilmiş veya
 * kullanıcıya atanmış anketler. En son hareket gören önce gelir. Puan
 * hesaplamaz; yalnızca seçilen anket puanlanır.
 */
async function surveyOptions(memberIds: string[], db: DbClient) {
  const [assessed, invited, assigned] = await Promise.all([
    db.assessment.findMany({ where: { unitId: { in: memberIds }, survey: { isDemo: false } }, select: { surveyId: true, createdAt: true, survey: { select: { name: true } } } }),
    db.campaignRecipient.findMany({
      where: { memberUnitId: { in: memberIds }, campaign: { status: "ACTIVE", survey: { isDemo: false, isActive: true, archivedAt: null } } },
      select: { assignedAt: true, campaign: { select: { surveyId: true, survey: { select: { name: true } } } } },
    }),
    db.userSurveyAssignment.findMany({
      where: { isActive: true, user: { unitId: { in: memberIds }, isActive: true }, survey: { isActive: true, archivedAt: null, isDemo: false } },
      select: { surveyId: true, assignedAt: true, survey: { select: { name: true } } },
    }),
  ]);
  const latest = new Map<string, { id: string; name: string; at: number }>();
  const add = (id: string, name: string, at: Date) => {
    const known = latest.get(id);
    if (!known || at.getTime() > known.at) latest.set(id, { id, name, at: at.getTime() });
  };
  for (const row of assessed) add(row.surveyId, row.survey.name, row.createdAt);
  for (const row of invited) add(row.campaign.surveyId, row.campaign.survey.name, row.assignedAt);
  for (const row of assigned) add(row.surveyId, row.survey.name, row.assignedAt);
  return [...latest.values()].sort((a, b) => b.at - a.at || a.name.localeCompare(b.name, "tr")).map(({ id, name }) => ({ id, name }));
}

export async function loadUnitManagementDashboard(actor: ManagedActor, input: UnitManagementInput, db: DbClient = prisma) {
  const scope = await managedUnitScope(actor, db);
  const records = await db.unit.findMany({
    where: "in" in scope ? { id: { in: scope.in } } : {}, orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, description: true, sectorId: true, subSectorId: true, employeeCount: true,
      sector: { select: { name: true } }, _count: { select: { users: { where: { isActive: true } } } } },
  });
  const units: ManagementUnit[] = records.map(unit => ({ id: unit.id, name: unit.name, parentId: unit.parentId, description: unit.description,
    sectorId: unit.sectorId, subSectorId: unit.subSectorId, sectorName: unit.sector?.name ?? null, employeeCount: unit.employeeCount, activeUserCount: unit._count.users }));
  const groups = managementGroups(units);
  // Eski bağlantılar "tümü" için ROOT_GROUP taşır; sanal grup yoksa ilk birim seçilir.
  const requested = input.unitId && input.unitId !== ROOT_GROUP ? input.unitId : null;
  const group = requested ? groups.find(item => item.id === requested) : groups.find(item => item.id === input.unitId) ?? groups[0];
  if (!group) {
    // Üyesi olmayan birim karşılaştırılamaz; o birimin kendi panosu açılır.
    if (requested && !units.some(unit => unit.id === requested)) throw new ManagedAssessmentError("Bu birime erişiminiz yok.");
    const unitId = requested ?? units[0]?.id ?? null;
    return unitId ? { kind: "member" as const, unitId } : { kind: "none" as const };
  }
  const members = units.filter(unit => group.memberIds.includes(unit.id));

  const surveys = await surveyOptions(group.memberIds, db);
  if (input.surveyId && !surveys.some(survey => survey.id === input.surveyId)) throw new ManagedAssessmentError("Bu kapsamda anket bulunamadı.", 404);
  const surveyId = input.surveyId || surveys[0]?.id || null;
  const index = surveyId ? await loadUnitDashboardIndex(actor, db, group.memberIds, { surveyId }) : { assessments: [], hasAnonymousCampaigns: false };
  const surveyRows = index.assessments.filter(row => row.surveyId === surveyId);
  const startedAt = new Map<string, number>();
  for (const row of surveyRows) {
    const at = row.createdAt ? Date.parse(row.createdAt) : 0;
    startedAt.set(row.periodId, Math.min(startedAt.get(row.periodId) ?? at, at));
  }
  const periods = [...new Map(surveyRows.map(row => [row.periodId, { id: row.periodId, name: row.periodName }])).values()]
    .sort((a, b) => (startedAt.get(b.id) ?? 0) - (startedAt.get(a.id) ?? 0) || a.name.localeCompare(b.name, "tr"));
  if (input.periodId && !periods.some(period => period.id === input.periodId)) throw new ManagedAssessmentError("Bu kapsamda dönem bulunamadı.", 404);
  const periodId = input.periodId || surveyRows.find(row => !row.locked)?.periodId || periods[0]?.id || null;
  const rows = surveyRows.filter(row => row.periodId === periodId);

  // Taslaklar da yüklenir: katılımda kimin hangi bölümde beklediği gösterilir.
  const details: UnitAssessmentDetail[] = [];
  const assessments = rows.filter(row => row.assessmentId);
  for (let offset = 0; offset < assessments.length; offset += 4) {
    const batch = await Promise.all(assessments.slice(offset, offset + 4).map(row => loadUnitAssessmentDetail(actor, row.assessmentId!, db)));
    details.push(...batch);
  }
  const sectorIds = [...new Set(members.flatMap(unit => unit.sectorId ? [unit.sectorId] : []))];
  const [benchmarks, ironmanBenchmarks] = await Promise.all([
    surveyId && sectorIds.length ? db.benchmark.findMany({ where: { surveyId, sectorId: { in: sectorIds } } }) : [],
    sectorIds.length ? db.ironmanBenchmark.findMany({ where: { sectorId: { in: sectorIds } } }) : [],
  ]);
  return {
    kind: "group" as const,
    selection: { unitId: group.id, unitName: group.name, surveyId, surveyName: surveys.find(survey => survey.id === surveyId)?.name ?? null,
      periodId, periodName: periods.find(period => period.id === periodId)?.name ?? null,
      /** Kurum içi dönemde kampanya yoktur; hatırlatma yalnızca kampanyada gönderilir. */
      campaignId: periodId && periodId !== "internal" ? periodId : null },
    options: { groups: groups.map(({ id, name }) => ({ id, name })), surveys, periods,
      members: members.map(unit => ({ id: unit.id, name: unit.name, employeeCount: unit.employeeCount })) },
    hasAnonymousCampaigns: index.hasAnonymousCampaigns,
    analytics: buildUnitManagementAnalytics({ members, rows, details, benchmarks, ironmanBenchmarks }),
    generatedAt: new Date().toISOString(),
  };
}

export async function updateManagedEmployeeCount(actor: ManagedActor, input: { unitId: unknown; employeeCount: unknown }, db: DbClient = prisma) {
  if (typeof input.unitId !== "string" || !input.unitId.trim() || (input.employeeCount !== null && (typeof input.employeeCount !== "number" || !Number.isInteger(input.employeeCount) || input.employeeCount < 0 || input.employeeCount > 2147483647))) {
    throw new ManagedAssessmentError("Çalışan sayısı boş veya negatif olmayan bir tam sayı olmalı.", 400);
  }
  const scope = await managedUnitScope(actor, db);
  if ("in" in scope && !scope.in.includes(input.unitId)) throw new ManagedAssessmentError("Bu birimi düzenleme yetkiniz yok.");
  const unit = await db.unit.findUnique({ where: { id: input.unitId }, select: { id: true } });
  if (!unit) throw new ManagedAssessmentError("Birim bulunamadı.", 404);
  return db.unit.update({ where: { id: input.unitId }, data: { employeeCount: input.employeeCount as number | null }, select: { id: true, employeeCount: true } });
}
export type UnitManagementResult = Awaited<ReturnType<typeof loadUnitManagementDashboard>>;
export type UnitManagementDashboard = Extract<UnitManagementResult, { kind: "group" }>;
