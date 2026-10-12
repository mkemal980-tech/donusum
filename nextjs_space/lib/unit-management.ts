import { prisma } from "./db";
import type { DbClient } from "./assessment";
import { managedUnitScope, ManagedAssessmentError, type ManagedActor } from "./managed-assessment";
import { loadUnitDashboardIndex, loadUnitAssessmentDetail, type UnitAssessmentDetail } from "./unit-dashboard";
import { buildUnitManagementAnalytics, managementScopeIds, type ManagementBasis, type ManagementUnit } from "./unit-management-analytics";

export type UnitManagementInput = { unitId?: string | null; surveyId?: string | null; periodId?: string | null; basis?: string | null; includeDescendants?: boolean };
export async function loadUnitManagementDashboard(actor: ManagedActor, input: UnitManagementInput, db: DbClient = prisma) {
  const scope = await managedUnitScope(actor, db);
  const records = await db.unit.findMany({
    where: "in" in scope ? { id: { in: scope.in } } : {}, orderBy: { name: "asc" },
    select: { id: true, name: true, parentId: true, description: true, sectorId: true, subSectorId: true, employeeCount: true,
      sector: { select: { name: true } }, _count: { select: { users: { where: { isActive: true } } } } },
  });
  const units: ManagementUnit[] = records.map(unit => ({ id: unit.id, name: unit.name, parentId: unit.parentId, description: unit.description,
    sectorId: unit.sectorId, subSectorId: unit.subSectorId, sectorName: unit.sector?.name ?? null, employeeCount: unit.employeeCount, activeUserCount: unit._count.users }));
  const unitId = input.unitId || (units.length > 1 ? "all" : units[0]?.id ?? "all");
  const includeDescendants = unitId === "all" || input.includeDescendants !== false;
  const selectedIds = managementScopeIds(units, unitId, includeDescendants);
  if (unitId !== "all" && !selectedIds.length) throw new ManagedAssessmentError("Bu birime erişiminiz yok.");
  const basis: ManagementBasis = input.basis === "submitted" ? "submitted" : "answered";
  if (input.basis && input.basis !== "answered" && input.basis !== "submitted") throw new ManagedAssessmentError("Geçerli sonuç kapsamı seçilmeli.", 400);
  const index = await loadUnitDashboardIndex(actor, db, selectedIds);
  const surveys = [...new Map(index.assessments.map(row => [row.surveyId, { id: row.surveyId, name: row.surveyName }])).values()];
  const surveyId = input.surveyId || index.assessments.find(row => !row.locked)?.surveyId || surveys[0]?.id || null;
  if (input.surveyId && !surveys.some(survey => survey.id === input.surveyId)) throw new ManagedAssessmentError("Bu kapsamda anket bulunamadı.", 404);
  const surveyRows = index.assessments.filter(row => row.surveyId === surveyId);
  const periods = [...new Map(surveyRows.map(row => [row.periodId, { id: row.periodId, name: row.periodName }])).values()];
  const periodId = input.periodId || surveyRows.find(row => !row.locked)?.periodId || periods[0]?.id || null;
  if (input.periodId && !periods.some(period => period.id === input.periodId)) throw new ManagedAssessmentError("Bu kapsamda dönem bulunamadı.", 404);
  const rows = surveyRows.filter(row => row.periodId === periodId);
  const selectedUnits = units.filter(unit => selectedIds.includes(unit.id));
  const details: UnitAssessmentDetail[] = [];
  const assessments = rows.filter(row => row.assessmentId);
  for (let offset = 0; offset < assessments.length; offset += 4) {
    const batch = await Promise.all(assessments.slice(offset, offset + 4).map(row => loadUnitAssessmentDetail(actor, row.assessmentId!, db)));
    details.push(...batch);
  }
  const sectorIds = [...new Set(selectedUnits.flatMap(unit => unit.sectorId ? [unit.sectorId] : []))];
  const [benchmarks, ironmanBenchmarks] = await Promise.all([
    surveyId && sectorIds.length ? db.benchmark.findMany({ where: { surveyId, sectorId: { in: sectorIds } } }) : [],
    sectorIds.length ? db.ironmanBenchmark.findMany({ where: { sectorId: { in: sectorIds } } }) : [],
  ]);
  return {
    selection: { unitId, unitName: units.find(unit => unit.id === unitId)?.name ?? "Tüm yönetilen birimler", surveyId,
      surveyName: surveys.find(survey => survey.id === surveyId)?.name ?? null, periodId,
      periodName: periods.find(period => period.id === periodId)?.name ?? null, basis, includeDescendants },
    options: { units, surveys, periods }, hasAnonymousCampaigns: index.hasAnonymousCampaigns,
    analytics: buildUnitManagementAnalytics({ units: selectedUnits, rows, details, benchmarks, ironmanBenchmarks, basis }),
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
export type UnitManagementDashboard = Awaited<ReturnType<typeof loadUnitManagementDashboard>>;
