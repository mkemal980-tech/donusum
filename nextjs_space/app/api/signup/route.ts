import { NextRequest, NextResponse } from "next/server";
import { prisma, withRetry } from "@/lib/db";
import { checkRateLimit, getClientIP, validators } from "@/lib/api-utils";
import { logDevEmailLink, sendEmail } from "@/lib/email";
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

    /**
     * Sektör zorunlu: puanın yarısı ona bağlı. Sektörü olmayan kullanıcı
     * kıyas göremiyor ("Benchmark yok") ve sektöre göre kapsam kuralları
     * devreye girmiyor — yani anketi doldurup eksik bir sonuç alıyor.
     * Sonradan yöneticiden düzeltmesini istemek yerine baştan sorulur.
     */
    if (!sectorId) {
      return NextResponse.json(
        { error: "Sektör seçimi gerekli" },
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

    // Check if user already exists (with retry for connection issues)
    const existingUser = await withRetry(() => 
      prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      })
    );

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

    // Create user (with retry for connection issues)
    const user = await withRetry(() => prisma.user.create({
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
    }));

    /**
     * Tanıtım anketini otomatik ata.
     *
     * Aksi hâlde yeni kullanıcı e-postasını doğrulayıp giriş yapıyor ve
     * "Henüz Anket Atanmadı" görüyor: yönetici ona bir anket atayana kadar
     * yapabileceği hiçbir şey yok. Tanıtım anketiyle döngüyü kendi başına
     * görebiliyor — doldur, puanı gör, önerileri al.
     *
     * Bu değerlendirmeler yönetici raporlarına girmez (bkz. Survey.isDemo);
     * ziyaretçinin rastgele cevapları sektör ortalamalarını bozmamalı.
     * Kayıt bu yüzden başarısız sayılmaz: atama yapılamazsa hesap yine açılır.
     */
    try {
      const demoSurveys = await prisma.survey.findMany({
        where: { isDemo: true, isActive: true, archivedAt: null },
        select: { id: true },
      });

      if (demoSurveys.length > 0) {
        await prisma.userSurveyAssignment.createMany({
          data: demoSurveys.map((survey) => ({ userId: user.id, surveyId: survey.id })),
          skipDuplicates: true,
        });
      }
    } catch (assignError) {
      console.error("Tanıtım anketi atanamadı:", assignError);
    }

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

    logDevEmailLink("Email verification", verifyUrl);
    const emailResult = await sendEmail({
      to: user.email,
      subject: `${appName}'na Hoş Geldiniz! 🎉 Email Adresinizi Doğrulayın`,
      html: htmlBody
    });

    if (!emailResult.success && process.env.NODE_ENV === "production") {
      console.error("Hoşgeldin emaili gönderilemedi:", emailResult.error);
      return NextResponse.json(
        { error: "Kayıt oluşturuldu ancak doğrulama emaili gönderilemedi. Lütfen daha sonra tekrar doğrulama emaili isteyin." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      message: "Kayıt başarılı! Lütfen email adresinizi doğrulayın."
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Signup error:", err.message, err.stack);
    
    // Daha açıklayıcı hata mesajları
    const errorMessage = err.message || '';
    if (errorMessage.includes('idle-session timeout') || 
        errorMessage.includes('Connection') ||
        errorMessage.includes('ECONNRESET')) {
      return NextResponse.json(
        { error: "Veritabanı bağlantı hatası. Lütfen tekrar deneyin." },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    );
  }
}
