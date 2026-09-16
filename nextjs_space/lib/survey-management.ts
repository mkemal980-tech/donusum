import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { canManageTenantUnit, getOrganizationRoots } from "./organization-campaign";

type DbClient = Prisma.TransactionClient | typeof prisma;

export function canEditSurveyRecord(
  role: string,
  ownerUnitId: string | null,
  managedRootIds: string[]
) {
  return role === "ADMIN" || Boolean(ownerUnitId && managedRootIds.includes(ownerUnitId));
}

export async function getManagedSurveyRootIds(
  userId: string,
  role: string,
  db: DbClient = prisma
) {
  return (await getOrganizationRoots(userId, role, db)).map((root) => root.id);
}

export async function canEditSurvey(
  userId: string,
  role: string,
  surveyId: string,
  db: DbClient = prisma
) {
  if (role === "ADMIN") return true;
  const survey = await db.survey.findUnique({
    where: { id: surveyId },
    select: { ownerUnitId: true },
  });
  if (!survey?.ownerUnitId) return false;
  const managed = await canManageTenantUnit(userId, role, survey.ownerUnitId, db);
  return canEditSurveyRecord(role, survey.ownerUnitId, managed ? [survey.ownerUnitId] : []);
}

export async function canReadSurveyTemplate(
  userId: string,
  role: string,
  surveyId: string,
  db: DbClient = prisma
) {
  if (role === "ADMIN" || await canEditSurvey(userId, role, surveyId, db)) return true;
  return (await db.userSurveyAssignment.count({
    where: { userId, surveyId, isActive: true, survey: { archivedAt: null } },
  })) > 0;
}

export async function surveyIdForCategory(categoryId: string, db: DbClient = prisma) {
  return (await db.category.findUnique({ where: { id: categoryId }, select: { surveyId: true } }))?.surveyId ?? null;
}

export async function surveyIdForSubCategory(subCategoryId: string, db: DbClient = prisma) {
  return (await db.subCategory.findUnique({
    where: { id: subCategoryId },
    select: { category: { select: { surveyId: true } } },
  }))?.category.surveyId ?? null;
}

export async function surveyIdForSubLevel(subLevelId: string, db: DbClient = prisma) {
  return (await db.subLevel.findUnique({
    where: { id: subLevelId },
    select: { subCategory: { select: { category: { select: { surveyId: true } } } } },
  }))?.subCategory.category.surveyId ?? null;
}

export async function surveyIdForQuestion(questionId: string, db: DbClient = prisma) {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      category: { select: { surveyId: true } },
      subCategory: { select: { category: { select: { surveyId: true } } } },
      subLevel: { select: { subCategory: { select: { category: { select: { surveyId: true } } } } } },
    },
  });
  return question?.category?.surveyId ??
    question?.subCategory?.category.surveyId ??
    question?.subLevel?.subCategory.category.surveyId ??
    null;
}
