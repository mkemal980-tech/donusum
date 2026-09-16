import { logDevEmailLink, sendEmail, type SendEmailResult } from "./email";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

function appUrl() {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

async function safelySend(input: Parameters<typeof sendEmail>[0]): Promise<SendEmailResult> {
  try {
    return await sendEmail(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email delivery error";
    console.error(`[email] Organization invitation failed: ${message}`);
    return { success: false, error: message };
  }
}

export async function sendMemberAccountInvitation(input: {
  email: string;
  firstName: string | null;
  tenantName: string;
  memberName: string;
  token: string;
}): Promise<SendEmailResult> {
  const invitationUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  const name = escapeHtml(input.firstName || "Merhaba");
  const tenantName = escapeHtml(input.tenantName);
  const memberName = escapeHtml(input.memberName);
  logDevEmailLink("Member invitation", invitationUrl);

  return safelySend({
    to: input.email,
    subject: `${tenantName} — Dönüşüm Platformu daveti`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;padding:28px;border-radius:10px;">
        <h2 style="color:#e6edf3;margin:0 0 20px;">Dönüşüm Platformu daveti</h2>
        <p style="color:#c9d1d9;">${name},</p>
        <p style="color:#c9d1d9;line-height:1.6;">
          <strong>${tenantName}</strong>, <strong>${memberName}</strong> adına anketlere katılmanız için hesabınızı oluşturdu.
        </p>
        <p style="margin:26px 0;">
          <a href="${invitationUrl}" style="background:#0cc1c3;color:#0d1117;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Şifremi belirle ve hesabı aç
          </a>
        </p>
        <p style="color:#8b949e;font-size:13px;">Bu bağlantı 7 gün geçerlidir ve yalnızca bir kez kullanılabilir.</p>
      </div>
    `,
    text:
      `${input.tenantName}, ${input.memberName} adına Dönüşüm Platformu hesabınızı oluşturdu. ` +
      `Şifrenizi belirlemek için: ${invitationUrl}`,
  });
}

export async function sendCampaignLaunchInvitation(input: {
  email: string;
  firstName: string | null;
  tenantName: string;
  memberName: string;
  campaignName: string;
  surveyName: string;
  deadline: Date | null;
}): Promise<SendEmailResult> {
  const surveyUrl = `${appUrl()}/survey`;
  const name = escapeHtml(input.firstName || "Merhaba");
  const tenantName = escapeHtml(input.tenantName);
  const memberName = escapeHtml(input.memberName);
  const campaignName = escapeHtml(input.campaignName);
  const surveyName = escapeHtml(input.surveyName);
  const deadline = input.deadline?.toLocaleDateString("tr-TR") ?? null;

  return safelySend({
    to: input.email,
    subject: `${input.surveyName} — anket daveti`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0d1117;padding:28px;border-radius:10px;">
        <h2 style="color:#e6edf3;margin:0 0 20px;">Yeni anket daveti</h2>
        <p style="color:#c9d1d9;">${name},</p>
        <p style="color:#c9d1d9;line-height:1.6;">
          <strong>${tenantName}</strong> tarafından yürütülen <strong>${campaignName}</strong> kampanyasında
          <strong>${surveyName}</strong> anketi <strong>${memberName}</strong> kuruluşunuza atandı.
        </p>
        ${deadline ? `<p style="color:#8b949e;">Son tarih: ${deadline}</p>` : ""}
        <p style="margin:26px 0;">
          <a href="${surveyUrl}" style="background:#0cc1c3;color:#0d1117;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">
            Ankete başla
          </a>
        </p>
      </div>
    `,
    text:
      `${input.tenantName}, ${input.campaignName} kapsamında ${input.surveyName} anketini ` +
      `${input.memberName} kuruluşunuza atadı.${deadline ? ` Son tarih: ${deadline}.` : ""} ${surveyUrl}`,
  });
}
