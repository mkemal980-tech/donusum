export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { isEmailConfigured, sendEmail } from "@/lib/email";

/**
 * E-posta sağlayıcısının durumu ve tek tıkla denenmesi.
 *
 * E-posta, çalışmadığında sessiz kalan bir bağımlılık: şifre sıfırlama,
 * kayıt doğrulama ve hatırlatma "gönderildi" der ama kimseye ulaşmaz. Bunu
 * gerçek bir kullanıcıyla fark etmek pahalı; yönetici burada tek düğmeyle
 * kendine deneme postası gönderir.
 *
 * Sağlayıcının hata metni olduğu gibi geri verilir. "Gönderilemedi" demek
 * teşhis için yetersiz — Resend'in "domain not verified" ya da "invalid
 * from address" cevabı doğrudan ne yapılacağını söylüyor.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  return NextResponse.json({
    configured: isEmailConfigured(),
    // Gönderen adresi gizli değil; hangi alan adının doğrulanmış olması
    // gerektiğini görmek için gerekli.
    from: process.env.EMAIL_FROM ?? null,
    missing: [
      ...(process.env.RESEND_API_KEY ? [] : ["RESEND_API_KEY"]),
      ...(process.env.EMAIL_FROM ? [] : ["EMAIL_FROM"]),
    ],
  });
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "auth" });
  if (!auth.success) return auth.response;

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "E-posta sağlayıcısı tanımlı değil. RESEND_API_KEY ve EMAIL_FROM ortam değişkenlerini ekleyin.",
      },
      { status: 503 }
    );
  }

  // Deneme postası yöneticinin kendi adresine gider: başka bir adrese
  // göndermek, bu ekranı istenmeyen posta aracına çevirirdi.
  const to = auth.user.email;
  const appName = "Dönüşüm Platformu";
  const sentAt = new Date().toLocaleString("tr-TR");

  const result = await sendEmail({
    to,
    subject: `${appName} — e-posta ayarı denemesi`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0d1117;padding:24px;border-radius:8px;">
        <p style="color:#c9d1d9;font-size:15px;">Bu bir deneme postasıdır.</p>
        <p style="color:#c9d1d9;font-size:15px;">
          Bunu görüyorsanız <strong>${appName}</strong> e-posta gönderebiliyor demektir:
          şifre sıfırlama, kayıt doğrulama ve bölüm hatırlatmaları çalışır.
        </p>
        <p style="color:#484f58;font-size:12px;">Gönderim zamanı: ${sentAt}</p>
      </div>
    `,
    text: `Bu bir deneme postasıdır. ${appName} e-posta gönderebiliyor. (${sentAt})`,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: "Deneme postası gönderilemedi.",
        // Sağlayıcının kendi metni: teşhisi mümkün kılan tek şey.
        providerError: result.error ?? null,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, to });
}
