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

  /**
   * Zaman aşımı zorunlu.
   *
   * Sunucu tarafındaki hiçbir dış çağrıda zaman aşımı yoktu (`grep AbortSignal`
   * sıfır sonuç). Sağlayıcı yavaşladığında istek süresiz bloke oluyordu; toplu
   * gönderimde bu, tek bir yavaş çağrının bütün partiyi durdurması demekti.
   */
  let response: Response;
  try {
    response = await fetch(RESEND_API_URL, {
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
      }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[email] request failed: ${message}`);
    return { success: false, error: `Email request failed: ${message}` };
  }

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

/**
 * E-posta HTML'ine gömülecek kullanıcı metnini kaçırır.
 *
 * Kayıt ve şifre sıfırlama şablonlarında `${firstName}` kaçırılmadan
 * gömülüyordu. Saldırgan kurbanın e-posta adresiyle kaydolup, sizin alan
 * adınızdan SPF/DKIM geçerek giden bir e-postaya kimlik avı içeriği
 * yerleştirebiliyordu. Hatırlatma şablonu bunu zaten doğru yapıyordu.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
