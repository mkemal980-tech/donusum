import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Email doğrulama
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Doğrulama tokeni gerekli" },
        { status: 400 }
      );
    }

    // Token'ı kontrol et
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz veya süresi dolmuş doğrulama linki" },
        { status: 400 }
      );
    }

    // Zaten doğrulanmış mı?
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email adresiniz zaten doğrulanmış.",
      });
    }

    // Email'i doğrula
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Email adresiniz başarıyla doğrulandı! Şimdi giriş yapabilirsiniz.",
    });
  } catch (error) {
    console.error("Email doğrulama hatası:", error);
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}

// Yeni doğrulama emaili gönder
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email adresi gerekli" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Güvenlik için kullanıcı bulunamasa bile başarılı mesajı dön
      return NextResponse.json({
        success: true,
        message: "Eğer bu email adresi kayıtlıysa, doğrulama linki gönderildi.",
      });
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: "Email adresiniz zaten doğrulanmış.",
      });
    }

    // Yeni token oluştur
    const crypto = await import("crypto");
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken,
        emailVerificationExpires,
      },
    });

    // Email gönder
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${emailVerificationToken}`;
    const appName = "Dönüşüm Platformu";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0cc1c3; margin: 0;">✉️ Email Doğrulama</h1>
        </div>
        
        <div style="background: #161b22; padding: 25px; border-radius: 8px; border: 1px solid #30363d;">
          <p style="color: #e6edf3; font-size: 16px; margin: 0 0 15px 0;">
            Merhaba <strong>${user.firstName || "Değerli Kullanıcı"}</strong>,
          </p>
          <p style="color: #8b949e; margin: 0 0 20px 0;">
            Email adresinizi doğrulamak için aşağıdaki butona tıklayın.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="background: linear-gradient(135deg, #0cc1c3 0%, #0891b2 100%); color: #0d1117; padding: 14px 35px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              ✉️ Email Adresimi Doğrula
            </a>
          </div>
          
          <div style="background: #21262d; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <p style="color: #8b949e; font-size: 14px; margin: 0;">
              <strong style="color: #f0883e;">⏰ Önemli:</strong> Bu link 24 saat içinde geçerliliğini yitirecektir.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #30363d;">
          <p style="color: #484f58; font-size: 12px; margin: 0;">
            Bu email otomatik olarak gönderilmiştir.
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
          notification_id: process.env.NOTIF_ID_HOGELDIN_EMAIL_DORULAMA,
          subject: `${appName} - Email Doğrulama`,
          body: htmlBody,
          is_html: true,
          recipient_email: user.email,
          sender_email: "noreply@mail.abacusai.app",
          sender_alias: "Donusum Platformu",
        }),
      });

      const result = await response.json();
      if (!result.success && !result.notification_disabled) {
        console.error("Doğrulama emaili gönderilemedi:", result);
      }
    } catch (emailError) {
      console.error("Email gönderme hatası:", emailError);
    }

    return NextResponse.json({
      success: true,
      message: "Doğrulama linki email adresinize gönderildi.",
    });
  } catch (error) {
    console.error("Email gönderme hatası:", error);
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
