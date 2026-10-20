import { prisma } from "./db";
import type { DbClient } from "./assessment";
import {
  MANAGED_ASSESSMENT_INCLUDE, ManagedAssessmentError, resolveManagedAssessment, toResolvedAssessment,
  type ManagedActor, type ResolvedAssessment,
} from "./managed-assessment";
import { buildAssessmentDetail, loadOwnUnitDashboardIndex, loadUnitDashboardIndex } from "./unit-dashboard";
import { loadRoadmapAccess } from "./roadmap-access";
import { buildSectionVisibility } from "./section-assignment";

/**
 * Tek pano için rol farkındalıklı değerlendirme görünümü.
 *
 * Aynı değerlendirme herkese aynı sayılarla görünür; rol yalnızca neyin
 * görüneceğini ve neyin yapılabileceğini değiştirir:
 * - yönetici: değerlendirme yönetim kapsamında (birim yöneticisi, ADMIN);
 * - çalışan: kişinin kendi biriminin değerlendirmesi. Kişi bazlı ekip
 *   ilerlemesi ve başkasına atanmış bölümlerin cevapları sunucuda çıkarılır.
 */
export type ViewerRole = "manager" | "member";

const isManagerRole = (actor: ManagedActor) => actor.user.role === "ADMIN" || actor.user.role === "UNIT_MANAGER";

/** Çalışanın kendi biriminin değerlendirmesi: yetki yönetici kapsamından değil üyelikten gelir. */
export async function resolveOwnUnitAssessment(userId: string, assessmentId: string, db: DbClient = prisma) {
  if (typeof assessmentId !== "string" || !assessmentId.trim()) throw new ManagedAssessmentError("Geçerli değerlendirme kimliği gerekli.", 400);
  const user = await db.user.findUnique({ where: { id: userId }, select: { unitId: true } });
  if (!user?.unitId) throw new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok.");
  const assessment = await db.assessment.findFirst({
    where: { id: assessmentId, unitId: user.unitId, survey: { isDemo: false } },
    include: MANAGED_ASSESSMENT_INCLUDE,
  });
  if (!assessment?.unitId || !assessment.unit) throw new ManagedAssessmentError("Bu değerlendirmeye erişiminiz yok.");
  return toResolvedAssessment({ ...assessment, unitId: assessment.unitId, unit: assessment.unit }, false);
}

/** Yönetim kapsamındaysa yönetici, değilse kişinin kendi birimiyse çalışan olarak açar. */
export async function resolveViewableAssessment(actor: ManagedActor, assessmentId: string, db: DbClient = prisma): Promise<{ role: ViewerRole; record: ResolvedAssessment }> {
  if (isManagerRole(actor)) {
    try {
      return { role: "manager", record: await resolveManagedAssessment(actor, assessmentId, db) };
    } catch (error) {
      if (!(error instanceof ManagedAssessmentError) || error.status !== 403) throw error;
    }
  }
  return { role: "member", record: await resolveOwnUnitAssessment(actor.userId, assessmentId, db) };
}

export async function loadAssessmentView(actor: ManagedActor, assessmentId: string, db: DbClient = prisma) {
  const { role, record } = await resolveViewableAssessment(actor, assessmentId, db);
  const member = role === "member";
  const [detail, access] = await Promise.all([
    buildAssessmentDetail(actor, record, db, { ownUnit: member, member }),
    member ? loadRoadmapAccess(actor.userId, [record.id], db) : null,
  ]);
  return {
    ...detail,
    recommendations: detail.recommendations.map(rec => ({ ...rec, canUpdateStatus: !access || (rec.isInRoadmap && access.canUpdate(rec.id)) })),
    viewer: { role, canManageRoadmap: !member, canDistribute: !member, canExportTeam: !member },
  };
}
export type AssessmentView = Awaited<ReturnType<typeof loadAssessmentView>>;

/** Panodaki birim, anket ve dönem seçicilerinin listesi. */
export async function loadAssessmentIndex(actor: ManagedActor, db: DbClient = prisma) {
  if (isManagerRole(actor)) return { role: "manager" as ViewerRole, ...(await loadUnitDashboardIndex(actor, db)) };
  const user = await db.user.findUnique({ where: { id: actor.userId }, select: { unitId: true } });
  if (!user?.unitId) return { role: "member" as ViewerRole, units: [], assessments: [], hasAnonymousCampaigns: false };
  return { role: "member" as ViewerRole, ...(await loadOwnUnitDashboardIndex(actor, user.unitId, db)) };
}

/**
 * Değerlendirmeye yüklenen belgeler. Çalışan yalnızca anket ekranında
 * görebildiği bölümlerin belgelerini görür (lib/section-assignment).
 */
export async function loadAssessmentDocuments(actor: ManagedActor, assessmentId: string, db: DbClient = prisma) {
  const { role, record } = await resolveViewableAssessment(actor, assessmentId, db);
  const [documents, assignments] = await Promise.all([
    db.document.findMany({
      where: { response: { assessmentId: record.id } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, fileName: true, fileType: true, isPublic: true, cloudStoragePath: true, createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        response: { select: { question: { select: { text: true, subCategoryId: true, subLevel: { select: { subCategoryId: true } } } } } },
      },
    }),
    role === "member" ? db.sectionAssignment.findMany({ where: { assessmentId: record.id }, select: { subCategoryId: true, assigneeId: true } }) : [],
  ]);
  if (role === "manager") return documents;
  const visibility = buildSectionVisibility(assignments, { userId: actor.userId, isCoordinator: false });
  return documents.filter(doc => {
    const question = doc.response?.question;
    const sectionId = question?.subLevel?.subCategoryId ?? question?.subCategoryId ?? null;
    return sectionId ? visibility.canSee(sectionId) : visibility.canSeeDirect;
  });
}
