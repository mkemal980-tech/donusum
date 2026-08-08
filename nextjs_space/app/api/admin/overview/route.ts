import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, logError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * Yönetim panelinin giriş ekranı için özet sayılar.
 *
 * /api/admin/dashboard anket bazlı puan analizi yapıyor ve ağır; genel bakış
 * ekranının ihtiyacı sadece sayaçlar, o yüzden ayrı ve tek turda hesaplanıyor.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeDeadline = {
      isActive: true,
      hasDeadline: true,
      deadline: { not: null },
    } as const;

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalUnits,
      activeSurveys,
      archivedSurveys,
      activeAssignments,
      overdueAssignments,
      dueSoonAssignments,
      inProgressAssessments,
      submittedAssessments,
      submittedLast30Days,
      recentResponses,
      upcomingDeadlines,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.unit.count(),
      prisma.survey.count({ where: { isActive: true, archivedAt: null } }),
      prisma.survey.count({ where: { archivedAt: { not: null } } }),
      prisma.userSurveyAssignment.count({ where: { isActive: true } }),
      prisma.userSurveyAssignment.count({
        where: { ...activeDeadline, deadline: { lt: now } },
      }),
      prisma.userSurveyAssignment.count({
        where: { ...activeDeadline, deadline: { gte: now, lte: inSevenDays } },
      }),
      prisma.assessment.count({ where: { status: "IN_PROGRESS" } }),
      prisma.assessment.count({ where: { status: "SUBMITTED" } }),
      prisma.assessment.count({
        where: { status: "SUBMITTED", submittedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.surveyResponse.count({ where: { updatedAt: { gte: thirtyDaysAgo } } }),
      prisma.userSurveyAssignment.findMany({
        where: { ...activeDeadline, deadline: { lte: inSevenDays } },
        orderBy: { deadline: "asc" },
        take: 6,
        select: {
          id: true,
          deadline: true,
          survey: { select: { name: true } },
          user: {
            select: { firstName: true, lastName: true, email: true, organization: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      users: { total: totalUsers, active: activeUsers, admins: adminUsers },
      units: { total: totalUnits },
      surveys: { active: activeSurveys, archived: archivedSurveys },
      assignments: {
        active: activeAssignments,
        overdue: overdueAssignments,
        dueSoon: dueSoonAssignments,
      },
      assessments: {
        inProgress: inProgressAssessments,
        submitted: submittedAssessments,
        submittedLast30Days,
      },
      activity: { responsesLast30Days: recentResponses },
      upcomingDeadlines: upcomingDeadlines.map((assignment) => ({
        id: assignment.id,
        deadline: assignment.deadline,
        surveyName: assignment.survey.name,
        userName:
          [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ") ||
          assignment.user.email,
        organization: assignment.user.organization,
      })),
    });
  } catch (error) {
    logError("GET /api/admin/overview", error);
    return NextResponse.json({ error: "Özet bilgiler alınamadı" }, { status: 500 });
  }
}
