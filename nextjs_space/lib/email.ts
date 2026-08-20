export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

const RESEND_API_URL = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({
  to,
  subject,
  html,
  text
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    const error = "Email provider is not configured";
    console.warn(`[email] ${error}. Subject: ${subject}, recipient: ${to}`);
    return { success: false, skipped: true, error };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = `Email provider returned ${response.status}: ${errorText}`;
    console.error(`[email] ${error}`);
    return { success: false, error };
  }

  return { success: true };
}

export function logDevEmailLink(label: string, url: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] ${label}: ${url}`);
  }
}
