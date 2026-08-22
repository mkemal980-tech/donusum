import type { CampaignPrivacyMode, CampaignStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";
import { buildSurveyQuestionWhere, classifyQuadrant, maxScoreForQuestion } from "./scoring";
import { buildScopeResolver, type ScopeRule } from "./sector-scope";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type CampaignMemberStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";

export function maturityFromPercentage(percentage: number) {
  if (percentage >= 80) return "Lider";
  if (percentage >= 60) return "Olgun";
  if (percentage >= 40) return "Gelişen";
  if (percentage >= 20) return "Farkındalık";
  return "Başlangıç";
}

export function memberStatus(input: {
  assessmentStatus?: string | null;
  responseCount: number;
}): CampaignMemberStatus {
  if (input.assessmentStatus === "SUBMITTED") return "SUBMITTED";
  return input.responseCount > 0 ? "IN_PROGRESS" : "NOT_STARTED";
}

export function median(values: number[]) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

/** Bir kökün tüm alt birimleri. Kök sonuç listesine dahil edilmez. */
export async function getDescendantUnitIds(rootId: string, db: DbClient = prisma) {
  const units = await db.unit.findMany({ select: { id: true, parentId: true } });
  const children = new Map<string, string[]>();
  for (const unit of units) {
    if (!unit.parentId) continue;
    const rows = children.get(unit.parentId) ?? [];
    rows.push(unit.id);
    children.set(unit.parentId, rows);
  }

  const result: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [...(children.get(rootId) ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

/** Oda/STK yöneticisinin doğrudan sahibi olduğu kökler. */
export async function getOrganizationRoots(
  userId: string,
  role: string,
  db: DbClient = prisma
) {
  if (role === "ADMIN") {
    return db.unit.findMany({
      where: { parentId: null },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
  }

  const assignments = await db.unitAdmin.findMany({
    where: { userId },
    select: { unit: { select: { id: true, name: true, description: true } } },
    orderBy: { unit: { name: "asc" } },
  });
  return assignments.map((assignment) => assignment.unit);
}

export async function canManageTenantUnit(
  userId: string,
  role: string,
  tenantUnitId: string,
  db: DbClient = prisma
) {
  if (role === "ADMIN") return true;
  return (await db.unitAdmin.count({ where: { userId, unitId: tenantUnitId } })) > 0;
}

type QuestionShape = {
  id: string;
  weight: number;
  axisType: string;
  type: string;
  options: unknown;
  conditionalOptions: unknown;
  categoryId: string | null;
  subCategoryId: string | null;
  subCategory: { categoryId: string } | null;
  subLevel: { subCategoryId: string; subCategory: { categoryId: string } } | null;
};

function placement(question: QuestionShape) {
  return {
    categoryId:
      question.categoryId ??
      question.subCategory?.categoryId ??
      question.subLevel?.subCategory.categoryId ??
      null,
    subCategoryId: question.subCategoryId ?? question.subLevel?.subCategoryId ?? null,
  };
}

function scoreAssessment(
  questions: QuestionShape[],
  responses: { questionId: string; score: number; updatedAt: Date }[],
  scopeRules: ScopeRule[],
  profile: { sectorId: string | null; subSectorId: string | null }
) {
  const scopeOf = buildScopeResolver(scopeRules, profile);
  const scopedQuestions = questions.filter((question) => {
    const { subCategoryId } = placement(question);
    return scopeOf(subCategoryId).applicable;
  });
  const questionById = new Map(scopedQuestions.map((question) => [question.id, question]));
  const categoryTotals = new Map<string, { score: number; max: number }>();
  let score = 0;
  let max = 0;
  let velocityScore = 0;
  let velocityWeight = 0;
  let enduranceScore = 0;
  let enduranceWeight = 0;

  for (const question of scopedQuestions) {
    const { categoryId, subCategoryId } = placement(question);
    if (!categoryId) continue;
    const scope = scopeOf(subCategoryId);
    const weight = (question.weight || 1) * scope.weight;
    const questionMax = maxScoreForQuestion(question) * weight;
    max += questionMax;
    const total = categoryTotals.get(categoryId) ?? { score: 0, max: 0 };
    total.max += questionMax;
    categoryTotals.set(categoryId, total);
  }

  const answeredQuestionIds = new Set<string>();
  let lastActivityAt: Date | null = null;
  for (const response of responses) {
    const question = questionById.get(response.questionId);
    if (!question) continue;
    answeredQuestionIds.add(response.questionId);
    if (!lastActivityAt || response.updatedAt > lastActivityAt) lastActivityAt = response.updatedAt;

    const { categoryId, subCategoryId } = placement(question);
    if (!categoryId) continue;
    const scope = scopeOf(subCategoryId);
    const weight = (question.weight || 1) * scope.weight;
    const questionMax = maxScoreForQuestion(question);
    const bounded = Math.min(questionMax, Math.max(0, response.score || 0));
    const weighted = bounded * weight;
    score += weighted;
    const category = categoryTotals.get(categoryId) ?? { score: 0, max: 0 };
    category.score += weighted;
    categoryTotals.set(categoryId, category);

    const ratio = questionMax > 0 ? bounded / questionMax : 0;
    if (question.axisType === "ENDURANCE") {
      enduranceScore += ratio * weight;
      enduranceWeight += weight;
    } else {
      velocityScore += ratio * weight;
      velocityWeight += weight;
    }
  }

  const percentage = max > 0 ? Math.round((score / max) * 1000) / 10 : 0;
  const axis = (sum: number, weight: number) =>
    weight > 0 ? Math.round((1 + (sum / weight) * 4) * 10) / 10 : 0;
  const velocity = axis(velocityScore, velocityWeight);
  const endurance = axis(enduranceScore, enduranceWeight);

  return {
    answeredQuestions: answeredQuestionIds.size,
    totalQuestions: scopedQuestions.length,
    completionPercentage:
      scopedQuestions.length > 0
        ? Math.round((answeredQuestionIds.size / scopedQuestions.length) * 100)
        : 0,
    percentage,
    scoreOn5: Math.round((1 + (percentage / 100) * 4) * 10) / 10,
    velocity,
    endurance,
    quadrant: classifyQuadrant(velocity, endurance),
    lastActivityAt,
    categoryPercentages: Object.fromEntries(
      [...categoryTotals].map(([categoryId, total]) => [
        categoryId,
        total.max > 0 ? Math.round((total.score / total.max) * 1000) / 10 : 0,
      ])
    ) as Record<string, number>,
  };
}

export async function loadCampaignDashboard(
  campaignId: string,
  userId: string,
  role: string,
  db: DbClient = prisma
) {
  const campaign = await db.surveyCampaign.findUnique({
    where: { id: campaignId },
    include: {
      tenantUnit: { select: { id: true, name: true } },
      survey: { select: { id: true, name: true } },
      recipients: {
        orderBy: { memberUnit: { name: "asc" } },
        include: {
          memberUnit: {
            select: {
              id: true,
              name: true,
              users: {
                where: { isActive: true },
                select: { sectorId: true, subSectorId: true },
                orderBy: { createdAt: "asc" },
                take: 1,
              },
            },
          },
          assessment: {
            select: {
              status: true,
              submittedAt: true,
              responses: {
                select: { questionId: true, score: true, updatedAt: true },
              },
              scoreHistory: {
                where: { triggerType: "SUBMISSION" },
                orderBy: { recordedAt: "desc" },
                take: 1,
                select: { velocityScore: true, enduranceScore: true, quadrant: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) return { kind: "not_found" as const };
  if (!(await canManageTenantUnit(userId, role, campaign.tenantUnitId, db))) {
    return { kind: "forbidden" as const };
  }

  const [categories, questions, rules] = await Promise.all([
    db.category.findMany({
      where: { surveyId: campaign.surveyId, archivedAt: null },
      select: { id: true, name: true, order: true },
      orderBy: { order: "asc" },
    }),
    db.question.findMany({
      where: { archivedAt: null, ...buildSurveyQuestionWhere(campaign.surveyId) },
      select: {
        id: true,
        weight: true,
        axisType: true,
        type: true,
        options: true,
        conditionalOptions: true,
        categoryId: true,
        subCategoryId: true,
        subCategory: { select: { categoryId: true } },
        subLevel: {
          select: { subCategoryId: true, subCategory: { select: { categoryId: true } } },
        },
      },
    }),
    db.sectorScopeRule.findMany({
      where: { surveyId: campaign.surveyId },
      select: {
        sectorId: true,
        subSectorId: true,
        subCategoryId: true,
        applicable: true,
        weight: true,
      },
    }),
  ]);

  const rows = campaign.recipients.map((recipient) => {
    const assessment = recipient.assessment;
    const profile = recipient.memberUnit.users[0] ?? { sectorId: null, subSectorId: null };
    const calculated = scoreAssessment(
      questions as QuestionShape[],
      assessment?.responses ?? [],
      rules as ScopeRule[],
      profile
    );
    const status = memberStatus({
      assessmentStatus: assessment?.status,
      responseCount: assessment?.responses.length ?? 0,
    });
    const snapshot = assessment?.scoreHistory[0];

    return {
      id: recipient.id,
      memberUnitId: recipient.memberUnitId,
      memberName: recipient.memberUnit.name,
      status,
      answeredQuestions: calculated.answeredQuestions,
      totalQuestions: calculated.totalQuestions,
      completionPercentage: calculated.completionPercentage,
      resultPercentage: status === "SUBMITTED" ? calculated.percentage : null,
      maturityScore: status === "SUBMITTED" ? calculated.scoreOn5 : null,
      maturityLevel: status === "SUBMITTED" ? maturityFromPercentage(calculated.percentage) : null,
      velocity: status === "SUBMITTED" ? (snapshot?.velocityScore ?? calculated.velocity) : null,
      endurance: status === "SUBMITTED" ? (snapshot?.enduranceScore ?? calculated.endurance) : null,
      quadrant: status === "SUBMITTED" ? (snapshot?.quadrant ?? calculated.quadrant) : null,
      submittedAt: assessment?.submittedAt ?? null,
      lastActivityAt: calculated.lastActivityAt,
      categoryPercentages: calculated.categoryPercentages,
    };
  });

  const submitted = rows.filter((row) => row.status === "SUBMITTED");
  const inProgress = rows.filter((row) => row.status === "IN_PROGRESS");
  const notStarted = rows.filter((row) => row.status === "NOT_STARTED");
  const resultsVisible =
    campaign.privacyMode === "IDENTIFIED" || submitted.length >= campaign.minimumCohortSize;
  const resultPercentages = submitted.flatMap((row) =>
    row.resultPercentage === null ? [] : [row.resultPercentage]
  );
  const average = (values: number[]) =>
    values.length > 0
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : null;

  const categoryStats = resultsVisible
    ? categories.map((category) => {
        const values = submitted
          .map((row) => row.categoryPercentages[category.id])
          .filter((value): value is number => typeof value === "number");
        return {
          id: category.id,
          name: category.name,
          average: average(values),
          best: values.length > 0 ? Math.max(...values) : null,
          lowest: values.length > 0 ? Math.min(...values) : null,
          assessmentCount: values.length,
        };
      })
    : [];

  const distribution = [
    { label: "Başlangıç", min: 0, max: 20 },
    { label: "Farkındalık", min: 20, max: 40 },
    { label: "Gelişen", min: 40, max: 60 },
    { label: "Olgun", min: 60, max: 80 },
    { label: "Lider", min: 80, max: 101 },
  ].map((bucket) => ({
    label: bucket.label,
    count: resultsVisible
      ? resultPercentages.filter((value) => value >= bucket.min && value < bucket.max).length
      : 0,
  }));

  const lastActivityAt = rows.reduce<Date | null>(
    (latest, row) =>
      row.lastActivityAt && (!latest || row.lastActivityAt > latest) ? row.lastActivityAt : latest,
    null
  );

  return {
    kind: "ok" as const,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status as CampaignStatus,
      privacyMode: campaign.privacyMode as CampaignPrivacyMode,
      minimumCohortSize: campaign.minimumCohortSize,
      deadline: campaign.deadline,
      launchedAt: campaign.launchedAt,
      tenantUnit: campaign.tenantUnit,
      survey: campaign.survey,
    },
    participation: {
      total: rows.length,
      submitted: submitted.length,
      inProgress: inProgress.length,
      notStarted: notStarted.length,
      overdue: rows.filter(
        (row) => campaign.deadline && campaign.deadline < new Date() && row.status !== "SUBMITTED"
      ).length,
      completionRate: rows.length > 0 ? Math.round((submitted.length / rows.length) * 100) : 0,
      lastActivityAt,
    },
    results: {
      visible: resultsVisible,
      requiredCohortSize: campaign.minimumCohortSize,
      submittedCount: submitted.length,
      averagePercentage: resultsVisible ? average(resultPercentages) : null,
      medianPercentage: resultsVisible ? median(resultPercentages) : null,
      maturityLevel:
        resultsVisible && average(resultPercentages) !== null
          ? maturityFromPercentage(average(resultPercentages)!)
          : null,
      averageVelocity: resultsVisible
        ? average(submitted.flatMap((row) => row.velocity === null ? [] : [row.velocity]))
        : null,
      averageEndurance: resultsVisible
        ? average(submitted.flatMap((row) => row.endurance === null ? [] : [row.endurance]))
        : null,
      distribution,
      categories: categoryStats,
    },
    // Anonim kampanyada üye bazlı durum/puan eşlemesi sunucu tarafında da
    // kapalıdır; yalnızca toplu katılım sayıları döner.
    members:
      campaign.privacyMode === "IDENTIFIED"
        ? rows.map(({ categoryPercentages: _categoryPercentages, ...row }) => row)
        : [],
  };
}
