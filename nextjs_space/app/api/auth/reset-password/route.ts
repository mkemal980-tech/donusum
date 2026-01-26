import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token ve şifre gerekli" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı" },
        { status: 400 }
      );
    }

    // Token'ı kontrol et
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz veya süresi dolmuş token" },
        { status: 400 }
      );
    }

    // Şifreyi güncelle
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Şifre değişiklik bildirimi gönder
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const appName = "Dönüşüm Platformu";
    const changeDate = new Date().toLocaleString("tr-TR", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0cc1c3; margin: 0;">🔐 Şifre Değişikliği</h1>
        </div>
        
        <div style="background: #161b22; padding: 25px; border-radius: 8px; border: 1px solid #30363d;">
          <p style="color: #e6edf3; font-size: 16px; margin: 0 0 15px 0;">
            Merhaba <strong>${user.firstName || "Değerli Kullanıcı"}</strong>,
          </p>
          <p style="color: #8b949e; margin: 0 0 20px 0;">
            Hesabınızın şifresi başarıyla değiştirildi.
          </p>
          
          <div style="background: #21262d; padding: 15px; border-radius: 6px;">
            <p style="color: #8b949e; font-size: 14px; margin: 0;">
              <strong style="color: #e6edf3;">📅 Değişiklik Tarihi:</strong> ${changeDate}
            </p>
          </div>
          
          <div style="background: #3d1f1f; padding: 15px; border-radius: 6px; margin-top: 15px; border: 1px solid #f8514966;">
            <p style="color: #f85149; font-size: 14px; margin: 0;">
              <strong>⚠️ Önemli:</strong> Eğer bu değişikliği siz yapmadıysanız, lütfen hemen bizimle iletişime geçin ve şifrenizi tekrar değiştirin.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #30363d;">
          <p style="color: #484f58; font-size: 12px; margin: 0;">
            Bu email güvenlik bildirimi olarak otomatik gönderilmiştir.
          </p>
        </div>
      </div>
    `;

    try {
      const response = await fetch("https://apps.abacus.ai/api/sendNotificationEmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          app_id: process.env.WEB_APP_ID,
          notification_id: process.env.NOTIF_ID_IFRE_DEIIKLIK_BILDIRIMI,
          subject: `${appName} - Şifreniz Değiştirildi 🔐`,
          body: htmlBody,
          is_html: true,
          recipient_email: user.email,
          sender_email: "noreply@mail.abacusai.app",
          sender_alias: "Donusum Platformu",
        }),
      });

      const result = await response.json();
      if (!result.success && !result.notification_disabled) {
        console.error("Şifre değişiklik bildirimi gönderilemedi:", result);
      }
    } catch (emailError) {
      console.error("Email gönderme hatası:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Şifreniz başarıyla güncellendi",
    });
  } catch (error) {
    console.error("Şifre güncelleme hatası:", error);
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
