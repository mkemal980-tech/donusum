import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { canManageTenantUnit } from "@/lib/organization-campaign";

export const dynamic = "force-dynamic";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  const auth = await withAuth(request, { requireUnitManager: true, rateLimit: "auth" });
  if (!auth.success) return auth.response;

  try {
    const campaign = await prisma.surveyCampaign.findUnique({
      where: { id: params.campaignId },
      include: {
        tenantUnit: { select: { name: true } },
        survey: { select: { name: true } },
        recipients: {
          include: {
            memberUnit: {
              select: {
                name: true,
                users: {
                  where: { isActive: true },
                  select: { email: true, firstName: true, lastName: true },
                },
              },
            },
            assessment: { select: { status: true } },
          },
        },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Kampanya bulunamadı" }, { status: 404 });
    if (!(await canManageTenantUnit(auth.userId, auth.user.role, campaign.tenantUnitId))) {
      return NextResponse.json({ error: "Bu kampanya için hatırlatma gönderemezsiniz" }, { status: 403 });
    }
    if (campaign.status !== "ACTIVE") {
      return NextResponse.json({ error: "Kapalı kampanya için hatırlatma gönderilemez" }, { status: 400 });
    }
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "E-posta sağlayıcısı tanımlı değil; hatırlatma gönderilemiyor." },
        { status: 503 }
      );
    }

    const pending = campaign.recipients.filter(
      (recipient) => recipient.assessment?.status !== "SUBMITTED"
    );
    if (pending.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "Tüm üyeler gönderimini tamamlamış." });
    }

    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    let sent = 0;
    let failed = 0;
    for (const recipient of pending) {
      for (const user of recipient.memberUnit.users) {
        const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Merhaba";
        const safeName = escapeHtml(name);
        const safeTenant = escapeHtml(campaign.tenantUnit.name);
        const safeCampaign = escapeHtml(campaign.name);
        const safeMember = escapeHtml(recipient.memberUnit.name);
        const deadline = campaign.deadline
          ? new Date(campaign.deadline).toLocaleDateString("tr-TR")
          : null;
        const result = await sendEmail({
          to: user.email,
          subject: `${campaign.survey.name} — değerlendirme hatırlatması`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;padding:24px;border-radius:8px;">
              <p style="color:#c9d1d9;font-size:15px;">${safeName},</p>
              <p style="color:#c9d1d9;font-size:15px;">
                <strong>${safeTenant}</strong> tarafından yürütülen
                <strong>${safeCampaign}</strong> kampanyasındaki değerlendirmeniz henüz gönderilmedi.
              </p>
              <p style="color:#8b949e;font-size:14px;">
                Üye kuruluş: ${safeMember}${deadline ? ` · Son tarih: ${deadline}` : ""}
              </p>
              <p style="margin:24px 0;">
                <a href="${appUrl}/survey" style="background:#0cc1c3;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
                  Değerlendirmeye devam et
                </a>
              </p>
            </div>
          `,
          text:
            `${name}, ${campaign.name} kampanyasındaki ${campaign.survey.name} değerlendirmeniz henüz gönderilmedi.` +
            `${deadline ? ` Son tarih: ${deadline}.` : ""} ${appUrl}/survey`,
        });
        if (result.success) sent++;
        else failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      message: failed > 0 ? `${sent} kişiye gönderildi, ${failed} gönderim başarısız.` : `${sent} kişiye hatırlatma gönderildi.`,
    });
  } catch (error) {
    console.error("Campaign reminder error:", error);
    return NextResponse.json({ error: "Hatırlatma gönderilemedi" }, { status: 500 });
  }
}
