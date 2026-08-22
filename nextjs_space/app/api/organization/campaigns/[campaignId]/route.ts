import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { canManageTenantUnit } from "@/lib/organization-campaign";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = (await request.json()) ?? {};
    if (body.action !== "close") {
      return NextResponse.json({ error: "Desteklenmeyen kampanya işlemi" }, { status: 400 });
    }

    const campaign = await prisma.surveyCampaign.findUnique({
      where: { id: params.campaignId },
      select: { id: true, tenantUnitId: true, status: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    }
    if (!(await canManageTenantUnit(auth.userId, auth.user.role, campaign.tenantUnitId))) {
      return NextResponse.json({ error: "Bu kampanyayı kapatma yetkiniz yok" }, { status: 403 });
    }
    if (campaign.status === "CLOSED") {
      return NextResponse.json({ error: "Kampanya zaten kapalı" }, { status: 400 });
    }

    const closed = await prisma.surveyCampaign.update({
      where: { id: campaign.id },
      data: { status: "CLOSED", closedAt: new Date() },
      select: { id: true, status: true, closedAt: true },
    });
    return NextResponse.json({ success: true, campaign: closed });
  } catch (error) {
    console.error("Campaign close error:", error);
    return NextResponse.json({ error: "Kampanya kapatılamadı" }, { status: 500 });
  }
}
