import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enforcePublicRateLimit, validators } from "@/lib/api-utils";
import { escapeHtml, sendEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { hashToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    // Token tahmini denemelerini de sınırlar.
    const throttled = await enforcePublicRateLimit(request, 'reset-password');
    if (throttled) return throttled;

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token ve şifre gerekli" },
        { status: 400 }
      );
    }

    // Kayıt akışıyla aynı kural (bkz. lib/api-utils validators.password);
    // reset üzerinden daha zayıf şifre belirlenmesini engeller.
    const passwordCheck = validators.password(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.message },
        { status: 400 }
      );
    }

    /**
     * İki tür bağlantı da buraya düşer: şifre sıfırlama ve hesap daveti.
     *
     * Davet eskiden `passwordResetToken` alanını ödünç alıyordu; kullanıcı
     * "şifremi unuttum"a bastığında bekleyen daveti sessizce ölüyordu (ve
     * tersi). Artık her birinin kendi alanı var, ikisi de özetlenerek
     * saklanıyor ve bu uç nokta ikisini de kabul ediyor.
     */
    const tokenHash = hashToken(String(token));
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { passwordResetToken: tokenHash, passwordResetExpires: { gt: now } },
          { invitationTokenHash: tokenHash, invitationExpires: { gt: now } },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz veya süresi dolmuş token" },
        { status: 400 }
      );
    }

    const viaInvitation = user.invitationTokenHash === tokenHash;

    // Şifreyi güncelle — token'ı atomik olarak "tüket".
    // updateMany + where token koşulu, eşzamanlı iki isteğin aynı token'ı
    // kullanmasını engeller (TOCTOU yarışını kapatır): yalnızca ilki başarılı olur.
    const hashedPassword = await bcrypt.hash(password, 10);

    const consumed = await prisma.user.updateMany({
      where: viaInvitation
        ? { id: user.id, invitationTokenHash: tokenHash, invitationExpires: { gt: now } }
        : { id: user.id, passwordResetToken: tokenHash, passwordResetExpires: { gt: now } },
      data: {
        password: hashedPassword,
        // Hangi yoldan gelinirse gelinsin iki token da tüketilir; yarım kalmış
        // bir bağlantının sonradan çalışması istenmez.
        passwordResetToken: null,
        passwordResetExpires: null,
        invitationTokenHash: null,
        invitationExpires: null,
        // Davetle oluşturulan hesaplarda bağlantının kullanılması aynı zamanda
        // e-posta sahipliğini kanıtlar; ayrı bir doğrulama turu gerekmez.
        emailVerified: true,
      },
    });

    if (consumed.count === 0) {
      return NextResponse.json(
        { error: "Geçersiz veya süresi dolmuş token" },
        { status: 400 }
      );
    }

    // Şifre değişiklik bildirimi gönder
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
            Merhaba <strong>${escapeHtml(user.firstName || "Değerli Kullanıcı")}</strong>,
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

    const emailResult = await sendEmail({
      to: user.email,
      subject: `${appName} - Şifreniz Değiştirildi 🔐`,
      html: htmlBody
    });

    if (!emailResult.success) {
      console.error("Şifre değişiklik bildirimi gönderilemedi:", emailResult.error);
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
