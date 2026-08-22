export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

// Kullanıcıya atanan anketleri getir
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = (session.user as any)?.role || "USER";

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

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { unitId: true },
    });
    const campaignRecipients = currentUser?.unitId
      ? await prisma.campaignRecipient.findMany({
          where: { memberUnitId: currentUser.unitId },
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
          deadlineExtendedAt: a.deadlineExtendedAt
        };
      });

    return NextResponse.json(surveys);
  } catch (error) {
    console.error("Error fetching assigned surveys:", error);
    return NextResponse.json({ error: "Failed to fetch assigned surveys" }, { status: 500 });
  }
}
