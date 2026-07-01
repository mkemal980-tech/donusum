import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logDevEmailLink, sendEmail } from "@/lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
        message: "Eğer bu email adresi kayıtlıysa, şifre sıfırlama linki gönderildi.",
      });
    }

    // Token oluştur
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 3600000); // 1 saat

    // Token'ı veritabanına kaydet
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Email gönder
    const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    const appName = appUrl ? new URL(appUrl).hostname.split(".")[0] : "Dönüşüm Platformu";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">
          Şifre Sıfırlama Talebi
        </h2>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 10px 0;">Merhaba ${user.firstName || "Kullanıcı"},</p>
          <p style="margin: 10px 0;">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #1e3a8a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Şifremi Sıfırla
            </a>
          </div>
          <p style="margin: 10px 0; color: #666; font-size: 14px;">Bu link 1 saat içinde geçerliliğini yitirecektir.</p>
          <p style="margin: 10px 0; color: #666; font-size: 14px;">Eğer bu talebi siz yapmadıysanız, bu emaili görmezden gelebilirsiniz.</p>
        </div>
        <p style="color: #666; font-size: 12px;">
          Bu email otomatik olarak gönderilmiştir.
        </p>
      </div>
    `;

    logDevEmailLink("Password reset", resetUrl);
    const emailResult = await sendEmail({
      to: user.email,
      subject: "Şifre Sıfırlama Talebi",
      html: htmlBody
    });

    if (!emailResult.success) {
      console.error("Şifre sıfırlama emaili gönderilemedi:", emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: "Eğer bu email adresi kayıtlıysa, şifre sıfırlama linki gönderildi.",
    });
  } catch (error) {
    console.error("Şifre sıfırlama hatası:", error);
    return NextResponse.json(
      { error: "Bir hata oluştu" },
      { status: 500 }
    );
  }
}
