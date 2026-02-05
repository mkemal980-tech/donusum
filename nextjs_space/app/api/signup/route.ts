import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIP, validators } from "@/lib/api-utils";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  // Rate limit for signup (prevent abuse)
  const ip = getClientIP(request);
  const rateLimit = checkRateLimit(ip, 'auth');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kayıt denemesi. Lütfen biraz bekleyin." },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  try {
    const { email, password, firstName, lastName, organization, sectorId, subSectorId } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre gerekli" },
        { status: 400 }
      );
    }

    // Email validation
    if (!validators.email(email)) {
      return NextResponse.json(
        { error: "Geçerli bir e-posta adresi girin" },
        { status: 400 }
      );
    }

    // Password strength validation
    const passwordCheck = validators.password(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Email doğrulama tokeni oluştur
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        organization: organization || null,
        sectorId: sectorId || null,
        subSectorId: subSectorId || null,
        emailVerified: false,
        emailVerificationToken,
        emailVerificationExpires,
        isActive: true
      }
    });

    // Hoşgeldin ve Email Doğrulama maili gönder
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/verify-email?token=${emailVerificationToken}`;
    const appName = "Dönüşüm Platformu";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; padding: 30px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0cc1c3; margin: 0;">🎉 Hoş Geldiniz!</h1>
        </div>
        
        <div style="background: #161b22; padding: 25px; border-radius: 8px; border: 1px solid #30363d;">
          <p style="color: #e6edf3; font-size: 16px; margin: 0 0 15px 0;">
            Merhaba <strong>${firstName || "Değerli Kullanıcı"}</strong>,
          </p>
          <p style="color: #8b949e; margin: 0 0 20px 0;">
            <strong>${appName}</strong>'na kayıt olduğunuz için teşekkür ederiz! Hesabınızı aktifleştirmek için lütfen email adresinizi doğrulayın.
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
        
        <div style="margin-top: 25px; padding: 20px; background: #161b22; border-radius: 8px; border: 1px solid #30363d;">
          <h3 style="color: #0cc1c3; margin: 0 0 15px 0;">🚀 Platformda Neler Yapabilirsiniz?</h3>
          <ul style="color: #8b949e; margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 8px;">Sürdürülebilirlik ve dijital olgunluk anketlerini tamamlayın</li>
            <li style="margin-bottom: 8px;">Sektörel kıyaslamalarla kendinizi değerlendirin</li>
            <li style="margin-bottom: 8px;">Kişiselleştirilmiş stratejik öneriler alın</li>
            <li style="margin-bottom: 8px;">Yol haritanızı oluşturun ve takip edin</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #30363d;">
          <p style="color: #484f58; font-size: 12px; margin: 0;">
            Bu email otomatik olarak gönderilmiştir. Eğer bu hesabı siz oluşturmadıysanız, bu emaili görmezden gelebilirsiniz.
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
          subject: `${appName}'na Hoş Geldiniz! 🎉 Email Adresinizi Doğrulayın`,
          body: htmlBody,
          is_html: true,
          recipient_email: user.email,
          sender_email: "noreply@mail.abacusai.app",
          sender_alias: "Donusum Platformu",
        }),
      });

      const result = await response.json();
      if (!result.success && !result.notification_disabled) {
        console.error("Hoşgeldin emaili gönderilemedi:", result);
      }
    } catch (emailError) {
      console.error("Email gönderme hatası:", emailError);
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      message: "Kayıt başarılı! Lütfen email adresinizi doğrulayın."
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu" },
      { status: 500 }
    );
  }
}
