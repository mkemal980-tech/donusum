import { prisma } from "./db";
import { type DbClient, getContributorCandidates } from "./assessment";
import {
  MANAGED_ASSESSMENT_INCLUDE, ManagedAssessmentError, managedUnitScope,
  resolveManagedAssessment, canReadManagedCampaign, type ManagedActor,
} from "./managed-assessment";
import {
  calculateProgressScores, calculateUserScore,
  summarizeProgress, computeRecommendationContributions, computeProgressBreakdown, loadProgressInputs,
  getRecommendationsForUser, getScopeResolverForProfile, type ScoringAssessment,
} from "./scoring";
import { getDashboardResultState } from "./dashboard-result";
import { maturityFromPercentage } from "./organization-campaign";
import { rankStartingRecommendations, recommendationReasons } from "./recommendation-priority";

const iso = (date: Date | null | undefined) => date?.toISOString() ?? null;
const label = (user: { firstName: string | null; lastName: string | null; email: string }) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

/** Gösterim, puan ve tamamlanma aynı aktif soru kümesinden beslenir. */
export async function loadManagedStructure(scope: ScoringAssessment, db: DbClient = prisma) {
  const [tree, scopeOf] = await Promise.all([
    db.category.findMany({
      where: { surveyId: scope.surveyId, archivedAt: null }, orderBy: { order: "asc" },
      include: {
        questions: { where: { archivedAt: null }, orderBy: { order: "asc" } },
        subCategories: {
          where: { archivedAt: null }, orderBy: { order: "asc" },
          include: {
            questions: { where: { archivedAt: null }, orderBy: { order: "asc" } },
            subLevels: {
              where: { archivedAt: null }, orderBy: { order: "asc" },
              include: { questions: { where: { archivedAt: null }, orderBy: { order: "asc" } } },
            },
          },
        },
      },
    }),
    getScopeResolverForProfile(scope, scope.surveyId, db),
  ]);
  const categories = tree.map(category => ({
    ...category, subCategories: category.subCategories.filter(section => scopeOf(section.id).applicable),
  }));
  const questions = categories.flatMap(category => [
    ...category.questions.map(question => ({ ...question, categoryId: category.id, sectionId: null as string | null, sectionName: "Kategori soruları" })),
    ...category.subCategories.flatMap(section => {
      const rows = section.subLevels.length ? section.subLevels.flatMap(level => level.questions) : section.questions;
      return rows.map(question => ({ ...question, categoryId: category.id, sectionId: section.id, sectionName: section.name }));
    }),
  ]);
  return { categories, questions, scoring: { ...scope, questionIds: questions.map(question => question.id) } };
}

export async function loadUnitDashboardIndex(actor: ManagedActor, db: DbClient = prisma) {
  const scope = await managedUnitScope(actor, db);
  const unitWhere = "in" in scope ? { id: { in: scope.in } } : {};
  const [units, records, assignments, recipients, direct] = await Promise.all([
    db.unit.findMany({ where: unitWhere, select: { id: true, name: true, description: true, parentId: true }, orderBy: { name: "asc" } }),
    db.assessment.findMany({
      where: { unitId: scope, survey: { isDemo: false } }, include: MANAGED_ASSESSMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    db.userSurveyAssignment.findMany({
      where: { isActive: true, user: { unitId: scope, isActive: true }, survey: { isActive: true, archivedAt: null, isDemo: false } },
      select: { surveyId: true, assignedAt: true, deadline: true, hasDeadline: true, user: { select: { unitId: true } }, survey: { select: { name: true } } },
    }),
    db.campaignRecipient.findMany({
      where: { ...("in" in scope ? { memberUnitId: { in: scope.in } } : {}), campaign: { survey: { isDemo: false, archivedAt: null } } },
      include: { campaign: { include: { survey: { select: { name: true, isActive: true } } } }, assessment: { select: { id: true } } },
      orderBy: { assignedAt: "desc" },
    }),
    actor.user.role === "ADMIN" ? Promise.resolve([]) : db.unitAdmin.findMany({ where: { userId: actor.userId }, select: { unitId: true } }),
  ]);
  const directIds = new Set(direct.map(row => row.unitId));
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  const readable = (unitId: string, privacy?: string) => actor.user.role === "ADMIN" || privacy !== "ANONYMOUS" || directIds.has(unitId);
  const deadlineOf = (unitId: string, surveyId: string) => {
    const dates = assignments.filter(row => row.user.unitId === unitId && row.surveyId === surveyId && row.hasDeadline && row.deadline).map(row => row.deadline!);
    return dates.length ? new Date(Math.min(...dates.map(date => date.getTime()))) : null;
  };
  const rows: UnitAssessmentRow[] = [];
  // Sorgu eşzamanlılığı sınırlı tutulur: geniş bir kuruluş DB havuzunu tüketmez.
  for (let offset = 0; offset < records.length; offset += 4) {
    const batch = await Promise.all(records.slice(offset, offset + 4).map(async record => {
      if (!record.unitId || !record.unit || !readable(record.unitId, record.campaignRecipient?.campaign.privacyMode)) return null;
      const campaign = record.campaignRecipient?.campaign;
      const structure = await loadManagedStructure({ id: record.id, surveyId: record.surveyId, sectorId: record.unit.sectorId, subSectorId: record.unit.subSectorId }, db);
      const scores = await calculateProgressScores(actor.userId, { assessment: structure.scoring, db });
      const answered = scores.completedQuestions;
      const total = structure.questions.length;
      const deadline = campaign?.deadline ?? deadlineOf(record.unitId, record.surveyId);
      return {
        id: record.id, assessmentId: record.id, unitId: record.unitId, unitName: record.unit.name,
        surveyId: record.surveyId, surveyName: record.survey.name,
        periodId: campaign?.id ?? "internal", periodName: campaign?.name ?? "Kuruluş içi",
        campaignRecipientId: record.campaignRecipientId, createdAt: iso(record.createdAt),
        deadline: iso(deadline), deadlineLabel: campaign ? "Kampanya son tarihi" : "En yakın atama son tarihi",
        status: getDashboardResultState({ answeredQuestions: answered, totalQuestions: total, submitted: record.status === "SUBMITTED", isCoordinator: true }),
        responseCount: answered, totalQuestions: total, completionPercentage: total ? Math.round(answered / total * 100) : 0,
        score: answered ? scores.overallPercentage : null, maturityScore: answered ? scores.overallScore : null,
        maturityLabel: answered ? maturityFromPercentage(scores.overallPercentage) : null,
        submittedAt: iso(record.submittedAt), overdue: record.status !== "SUBMITTED" && Boolean(deadline && deadline < new Date()),
        locked: record.status === "SUBMITTED" || !record.survey.isActive || Boolean(record.survey.archivedAt) || campaign?.status === "CLOSED",
      } satisfies UnitAssessmentRow;
    }));
    rows.push(...batch.filter((row): row is NonNullable<typeof row> => row !== null));
  }
  const existing = new Set(rows.map(row => row.unitId + ":" + row.surveyId + ":" + row.periodId));
  const campaignPairs = new Set(recipients.map(row => row.memberUnitId + ":" + row.campaign.surveyId));
  const pending = (unitId: string, surveyId: string, surveyName: string, periodId: string, periodName: string, recipientId: string | null, assignedAt: Date, deadline: Date | null) => {
    const key = unitId + ":" + surveyId + ":" + periodId;
    if (existing.has(key) || !unitById.has(unitId)) return;
    existing.add(key);
    rows.push({
      id: "pending:" + key, assessmentId: null, unitId, unitName: unitById.get(unitId)!.name, surveyId, surveyName,
      periodId, periodName, campaignRecipientId: recipientId, createdAt: iso(assignedAt), deadline: iso(deadline),
      deadlineLabel: recipientId ? "Kampanya son tarihi" : "En yakın atama son tarihi",
      status: "NOT_STARTED", responseCount: 0, totalQuestions: 0, completionPercentage: 0, score: null, maturityScore: null,
      maturityLabel: null, submittedAt: null, overdue: Boolean(deadline && deadline < new Date()), locked: false,
    });
  };
  for (const row of recipients) {
    if (row.assessment || row.campaign.status !== "ACTIVE" || !row.campaign.survey.isActive || !readable(row.memberUnitId, row.campaign.privacyMode)) continue;
    pending(row.memberUnitId, row.campaign.surveyId, row.campaign.survey.name, row.campaign.id, row.campaign.name, row.id, row.assignedAt, row.campaign.deadline);
  }
  for (const row of assignments) {
    const unitId = row.user.unitId;
    if (!unitId || campaignPairs.has(unitId + ":" + row.surveyId)) continue;
    pending(unitId, row.surveyId, row.survey.name, "internal", "Kuruluş içi", null, row.assignedAt, deadlineOf(unitId, row.surveyId));
  }
  return {
    units: units.map(unit => ({ ...unit, assessmentCount: rows.filter(row => row.unitId === unit.id).length })),
    assessments: rows,
    hasAnonymousCampaigns: recipients.some(row => !readable(row.memberUnitId, row.campaign.privacyMode)),
  };
}

export type UnitAssessmentRow = {
  id: string; assessmentId: string | null; unitId: string; unitName: string; surveyId: string; surveyName: string;
  periodId: string; periodName: string; campaignRecipientId: string | null; createdAt: string | null;
  deadline: string | null; deadlineLabel: string; status: ReturnType<typeof getDashboardResultState>;
  responseCount: number; totalQuestions: number; completionPercentage: number; score: number | null;
  maturityScore: number | null; maturityLabel: string | null; submittedAt: string | null; overdue: boolean; locked: boolean;
};

export async function startManagedAssessment(actor: ManagedActor, input: { unitId: string; surveyId: string; campaignRecipientId?: string | null }, db: DbClient = prisma) {
  const scope = await managedUnitScope(actor, db);
  if ("in" in scope && !scope.in.includes(input.unitId)) throw new ManagedAssessmentError("Bu birimi yönetme yetkiniz yok.");
  const survey = await db.survey.findFirst({ where: { id: input.surveyId, isActive: true, archivedAt: null, isDemo: false } });
  if (!survey) throw new ManagedAssessmentError("Aktif anket bulunamadı.", 404);
  const recipientId = input.campaignRecipientId ?? null;
  if (recipientId) {
    const recipient = await db.campaignRecipient.findFirst({
      where: { id: recipientId, memberUnitId: input.unitId, campaign: { surveyId: input.surveyId, status: "ACTIVE" } },
      include: { campaign: { select: { privacyMode: true } } },
    });
    if (!recipient || !(await canReadManagedCampaign(actor, input.unitId, recipient.campaign.privacyMode, db))) throw new ManagedAssessmentError("Bu kampanyaya erişiminiz yok.");
  } else {
    const [assignment, campaignCount] = await Promise.all([
      db.userSurveyAssignment.findFirst({ where: { surveyId: input.surveyId, isActive: true, user: { unitId: input.unitId, isActive: true } } }),
      db.campaignRecipient.count({ where: { memberUnitId: input.unitId, campaign: { surveyId: input.surveyId } } }),
    ]);
    if (!assignment || campaignCount) throw new ManagedAssessmentError("Anket bu birime atanmamış veya kampanya dönemi seçilmemiş.");
  }
  const where = { unitId: input.unitId, surveyId: input.surveyId, campaignRecipientId: recipientId };
  const existing = await db.assessment.findFirst({ where });
  if (existing) return existing.id;
  try {
    return (await db.assessment.create({ data: where })).id;
  } catch (error) {
    const winner = await db.assessment.findFirst({ where });
    if (winner) return winner.id;
    throw error;
  }
}

export async function loadUnitAssessmentDetail(actor: ManagedActor, assessmentId: string, db: DbClient = prisma) {
  const record = await resolveManagedAssessment(actor, assessmentId, db);
  const structure = await loadManagedStructure(record.scoring, db);
  const scoring = structure.scoring;
  const [responses, assignments, members, roadmap, history, rawScores] = await Promise.all([
    db.surveyResponse.findMany({
      where: { assessmentId, questionId: { in: scoring.questionIds } },
      select: { id: true, questionId: true, value: true, score: true, answeredById: true, updatedAt: true, _count: { select: { documents: true } } },
    }),
    db.sectionAssignment.findMany({ where: { assessmentId }, select: { subCategoryId: true, assigneeId: true } }),
    getContributorCandidates({ unitId: record.unitId }, db),
    db.roadmapItem.findMany({
      where: { assessmentId }, orderBy: { priority: "asc" },
      include: { recommendation: { include: { subLevel: { include: { subCategory: { include: { category: true } } } }, subCategory: { include: { category: true } } } } },
    }),
    db.scoreHistory.findMany({ where: { assessmentId }, orderBy: { recordedAt: "asc" } }),
    calculateUserScore(actor.userId, record.surveyId, { assessment: scoring, db }),
  ]);
  const visible = await getRecommendationsForUser(actor.userId, { assessment: scoring, scores: rawScores, db });
  const recById = new Map(visible.map(row => [row.id, row]));
  const extra = roadmap.map(item => item.recommendation);
  const allCandidates = [...visible, ...extra];
  const progressInputs = await loadProgressInputs(actor.userId, { assessment: scoring, extraRecommendations: allCandidates, db });
  const contributions = {
    scores: summarizeProgress(progressInputs),
    contributions: computeRecommendationContributions(progressInputs, allCandidates.map(rec => rec.id)),
  };
  const breakdown = computeProgressBreakdown(progressInputs, structure.categories);
  const responseById = new Map(responses.filter(response => response.value.trim()).map(response => [response.questionId, response]));
  const memberById = new Map(members.map(member => [member.id, member]));
  const assignedBySection = new Map(assignments.map(assignment => [assignment.subCategoryId, assignment.assigneeId]));
  const categories = structure.categories.map(category => {
    const progress = breakdown.find(row => row.id === category.id)!;
    const questions = structure.questions.filter(question => question.categoryId === category.id);
    return {
      id: category.id, name: category.name, baseScore: progress.baseScore, currentScore: progress.totalScore,
      basePercentage: progress.baseScore ? Math.max(0, (progress.baseScore - 1) / 4 * 100) : 0,
      currentPercentage: progress.totalScore ? Math.max(0, (progress.totalScore - 1) / 4 * 100) : 0,
      delta: progress.bonusPoints, answeredQuestions: questions.filter(question => responseById.has(question.id)).length,
      totalQuestions: questions.length,
      sections: [
        ...(category.questions.length ? [{ id: null as string | null, name: "Kategori soruları", assigneeId: null as string | null }] : []),
        ...category.subCategories.map(section => ({ id: section.id as string | null, name: section.name, assigneeId: assignedBySection.get(section.id) ?? null })),
      ].map(section => {
        const rows = questions.filter(question => question.sectionId === section.id);
        const answered = rows.filter(question => responseById.has(question.id));
        const dates = answered.map(question => responseById.get(question.id)!.updatedAt.getTime());
        const activeAssigneeId = section.assigneeId && memberById.has(section.assigneeId) ? section.assigneeId : null;
        return {
          ...section, assigneeId: activeAssigneeId,
          assigneeName: activeAssigneeId ? label(memberById.get(activeAssigneeId)!) : section.id ? "Atanmamış" : "Koordinatör",
          questionCount: rows.length, answeredCount: answered.length,
          percentage: rows.length ? Math.round(answered.length / rows.length * 100) : 0,
          missingEvidence: rows.filter(question => question.requiresEvidence && responseById.has(question.id) && !responseById.get(question.id)!._count.documents).length,
          lastActivityAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
          questions: rows.map(question => {
            const response = responseById.get(question.id);
            return {
              id: question.id, text: question.text, type: question.type, options: question.options,
              conditionalOptions: question.conditionalOptions, value: response?.value ?? null,
              evidenceCount: response?._count.documents ?? 0, requiresEvidence: question.requiresEvidence,
              answeredBy: response?.answeredById && memberById.has(response.answeredById) ? label(memberById.get(response.answeredById)!) : null,
            };
          }),
        };
      }).filter(section => section.questionCount > 0),
    };
  }).filter(category => category.totalQuestions > 0);
  const sections = categories.flatMap(category => category.sections.map(section => ({ ...section, categoryId: category.id, categoryName: category.name })));
  const work = sections.flatMap(section => {
    const items: { kind: string; sectionId: string | null; categoryId: string; title: string; assigneeName: string; count: number }[] = [];
    if (section.id && !section.assigneeId && section.answeredCount < section.questionCount) items.push({ kind: "UNASSIGNED", sectionId: section.id, categoryId: section.categoryId, title: section.name + " için sorumlu seçin", assigneeName: section.assigneeName, count: section.questionCount - section.answeredCount });
    else if (section.answeredCount < section.questionCount) items.push({ kind: "INCOMPLETE", sectionId: section.id, categoryId: section.categoryId, title: section.name + " bölümünde cevaplar eksik", assigneeName: section.assigneeName, count: section.questionCount - section.answeredCount });
    if (section.missingEvidence) items.push({ kind: "EVIDENCE", sectionId: section.id, categoryId: section.categoryId, title: section.name + " bölümünde belge eksik", assigneeName: section.assigneeName, count: section.missingEvidence });
    return items;
  });
  const itemsByRec = new Map(roadmap.map(item => [item.recommendationId, item]));
  const allRecommendations = [...visible, ...extra.filter(rec => !recById.has(rec.id))];
  const recommendations = rankStartingRecommendations(allRecommendations.map(rec => {
    const shown = recById.get(rec.id);
    const item = itemsByRec.get(rec.id);
    const sectionId = rec.subLevel?.subCategoryId ?? rec.subCategoryId ?? shown?.resolvedSubCategoryId ?? null;
    const ownerId = item?.assigneeId ?? (sectionId ? assignedBySection.get(sectionId) : null) ?? null;
    const contribution = contributions.contributions.get(rec.id);
    return {
      id: rec.id, title: rec.title, description: rec.description, estimatedImpact: rec.estimatedImpact,
      strategicType: rec.strategicType, timeframe: rec.timeframe, costType: rec.costType,
      capexLevel: rec.capexLevel, opexLevel: rec.opexLevel, order: rec.order,
      isActionable: shown?.isActionable ?? false, stepDistance: shown?.stepDistance ?? 0,
      triggeredByQuestion: Boolean(rec.questionId), isInRoadmap: Boolean(item),
      status: item?.status ?? null, assigneeId: item?.assigneeId ?? null,
      assigneeName: ownerId && memberById.has(ownerId) ? label(memberById.get(ownerId)!) : "Atanmamış",
      dueDate: iso(item?.dueDate), plannedQuarter: item?.plannedQuarter ?? null, plannedYear: item?.plannedYear ?? null,
      overdue: Boolean(item?.dueDate && item.dueDate < new Date() && item.status !== "COMPLETED" && item.status !== "CANCELLED"),
      fullContribution: contribution?.full ?? 0, currentContribution: contribution?.current ?? 0,
      reasons: shown ? recommendationReasons(shown) : ["Yol haritasında"],
    };
  }));
  const comparisonRecords = await db.assessment.findMany({
    where: { unitId: record.unitId, surveyId: record.surveyId, status: "SUBMITTED" },
    include: MANAGED_ASSESSMENT_INCLUDE, orderBy: { submittedAt: "desc" },
  });
  const comparisons = [];
  for (const previous of comparisonRecords) {
    if (!(await canReadManagedCampaign(actor, record.unitId!, previous.campaignRecipient?.campaign.privacyMode, db))) continue;
    const scores = previous.id === record.id ? contributions.scores : await calculateProgressScores(actor.userId, { assessment: { ...scoring, id: previous.id }, db });
    comparisons.push({
      id: previous.id, period: previous.campaignRecipient?.campaign.name ?? "Kuruluş içi",
      submittedAt: iso(previous.submittedAt), score: scores.overallScore, percentage: scores.overallPercentage,
      completionPercentage: structure.questions.length ? Math.round(scores.completedQuestions / structure.questions.length * 100) : 0,
    });
  }
  return {
    assessment: {
      id: record.id, unitId: record.unitId!, unitName: record.unit!.name, surveyId: record.surveyId, surveyName: record.survey.name,
      periodName: record.campaignRecipient?.campaign.name ?? "Kuruluş içi", submittedAt: iso(record.submittedAt),
      status: getDashboardResultState({ answeredQuestions: responseById.size, totalQuestions: structure.questions.length, submitted: record.status === "SUBMITTED", isCoordinator: true }),
      locked: record.context.locked,
      roadmapLocked: !record.survey.isActive || Boolean(record.survey.archivedAt) || record.campaignRecipient?.campaign.status === "CLOSED",
    },
    scores: contributions.scores,
    answeredQuestions: responseById.size, totalQuestions: structure.questions.length,
    completionPercentage: structure.questions.length ? Math.round(responseById.size / structure.questions.length * 100) : 0,
    categories, work, recommendations,
    summary: {
      unassignedCount: work.filter(item => item.kind === "UNASSIGNED").length,
      incompleteCount: sections.filter(section => section.answeredCount < section.questionCount).length,
      missingEvidenceCount: sections.reduce((sum, section) => sum + section.missingEvidence, 0),
      overdueRoadmapCount: recommendations.filter(item => item.overdue).length,
      activeRoadmapCount: recommendations.filter(item => item.isInRoadmap && item.status !== "COMPLETED" && item.status !== "CANCELLED").length,
      completedRoadmapCount: recommendations.filter(item => item.status === "COMPLETED").length,
      contributorCount: new Set(responses.filter(response => response.value.trim() && response.answeredById).map(response => response.answeredById)).size,
    },
    members: members.map(member => ({ id: member.id, name: label(member), email: member.email })),
    team: members.map(member => {
      const owned = sections.filter(section => section.assigneeId === member.id);
      const authored = responses.filter(response => response.answeredById === member.id && response.value.trim());
      const questionCount = owned.reduce((sum, section) => sum + section.questionCount, 0);
      const answeredCount = owned.reduce((sum, section) => sum + section.answeredCount, 0);
      return {
        id: member.id, name: label(member), email: member.email, sections: owned.map(section => section.name),
        questionCount, answeredCount, authoredCount: authored.length,
        percentage: questionCount ? Math.round(answeredCount / questionCount * 100) : null,
        lastActivityAt: authored.length ? iso(new Date(Math.max(...authored.map(response => response.updatedAt.getTime())))) : null,
      };
    }),
    history: history.map(snapshot => ({
      id: snapshot.id, recordedAt: snapshot.recordedAt.toISOString(), score: snapshot.overallScore,
      percentage: snapshot.overallPercentage, triggerType: snapshot.triggerType, completedRecommendations: snapshot.completedRecommendations,
    })),
    comparisons,
  };
}

export type UnitDashboardIndex = Awaited<ReturnType<typeof loadUnitDashboardIndex>>;
export type UnitAssessmentDetail = Awaited<ReturnType<typeof loadUnitAssessmentDetail>>;
