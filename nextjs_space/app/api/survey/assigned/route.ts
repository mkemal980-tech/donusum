export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { getAssessmentIds } from "@/lib/assessment";

// Kullanıcıya atanan anketleri getir
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;

  try {
    const userId = auth.userId;
    const userRole = auth.user.role;

    // Admin ise tüm aktif anketleri gör (süre sınırı yok)
    if (userRole === "ADMIN") {
      const surveys = await prisma.survey.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { order: 'asc' }
      });
      // Admin için süre bilgisi ekleme
      const surveysWithDeadline = surveys.map(s => ({
        ...s,
        hasDeadline: false,
        deadline: null,
        isExpired: false
      }));
      return NextResponse.json(surveysWithDeadline);
    }

    // Normal kullanıcı ise sadece atanan anketleri gör
    const assignments = await prisma.userSurveyAssignment.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        survey: true
      },
      orderBy: { assignedAt: 'desc' }
    });

    const campaignRecipients = auth.user.unitId
      ? await prisma.campaignRecipient.findMany({
          where: { memberUnitId: auth.user.unitId },
          orderBy: { assignedAt: "desc" },
          select: {
            campaign: {
              select: {
                id: true,
                name: true,
                surveyId: true,
                status: true,
                privacyMode: true,
                deadline: true,
              },
            },
          },
        })
      : [];
    // Aynı anket zaman içinde yeniden gönderilebilir; en yeni kampanya geçerli.
    const latestCampaignBySurvey = new Map<string, (typeof campaignRecipients)[number]["campaign"]>();
    for (const recipient of campaignRecipients) {
      if (!latestCampaignBySurvey.has(recipient.campaign.surveyId)) {
        latestCampaignBySurvey.set(recipient.campaign.surveyId, recipient.campaign);
      }
    }

    /**
     * Hangi ankete başlanmış?
     *
     * Pano bunu öğrenmek için atanan her anket başına ayrı bir `countOnly`
     * isteği atıyordu. Tek sorguyla burada çözülür.
     */
    const assessmentIds = await getAssessmentIds(
      userId,
      assignments.map((assignment) => assignment.surveyId)
    );
    const startedSurveyIds = new Set(
      assessmentIds.length > 0
        ? (
            await prisma.surveyResponse.findMany({
              where: { assessmentId: { in: assessmentIds } },
              select: { assessment: { select: { surveyId: true } } },
              distinct: ["assessmentId"],
            })
          ).map((response) => response.assessment.surveyId)
        : []
    );

    const now = new Date();
    
    // Sadece aktif anketleri dön, süre bilgisi ile
    const surveys = assignments
      .filter(a => {
        const campaign = latestCampaignBySurvey.get(a.surveyId);
        return a.survey.isActive && !a.survey.archivedAt && (!campaign || campaign.status === "ACTIVE");
      })
      .map(a => {
        const campaign = latestCampaignBySurvey.get(a.surveyId);
        const effectiveDeadline = campaign?.deadline ?? a.deadline;
        const hasDeadline = Boolean(effectiveDeadline) || a.hasDeadline;
        const isExpired = hasDeadline && effectiveDeadline && new Date(effectiveDeadline) < now;
        return {
          ...a.survey,
          assignmentId: a.id,
          campaignId: campaign?.id ?? null,
          campaignName: campaign?.name ?? null,
          privacyMode: campaign?.privacyMode ?? null,
          hasDeadline,
          deadline: effectiveDeadline,
          isExpired,
          deadlineExtendedAt: a.deadlineExtendedAt,
          /** Üzerinde çalışılmış mı — pano ön seçimi bunu kullanır. */
          hasResponses: startedSurveyIds.has(a.surveyId),
        };
      });

    return NextResponse.json(surveys);
  } catch (error) {
    console.error("Error fetching assigned surveys:", error);
    return NextResponse.json({ error: "Failed to fetch assigned surveys" }, { status: 500 });
  }
}
