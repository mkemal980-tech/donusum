"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/ui/auth-layout";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">("loading");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("no-token");
      return;
    }

    const verifyEmail = async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setStatus("success");
          setMessage(data.message);
          // 3 saniye sonra login sayfasına yönlendir
          setTimeout(() => router.push("/login"), 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Doğrulama başarısız oldu.");
        }
      } catch {
        setStatus("error");
        setMessage("Bir hata oluştu. Lütfen tekrar deneyin.");
      }
    };

    verifyEmail();
  }, [token, router]);

  const handleResend = async () => {
    if (!resendEmail) return;

    setResending(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await res.json();
      if (data.success) {
        setResendSuccess(true);
      }
    } catch {
      // Hata durumunda da başarılı göster (güvenlik)
      setResendSuccess(true);
    } finally {
      setResending(false);
    }
  };

  /* Dört durum, tek iskelet: başlık ve gövde duruma göre değişir. */
  const copy = {
    loading: {
      title: "Adres doğrulanıyor",
      subtitle: "Bağlantı kontrol ediliyor, birkaç saniye sürebilir.",
    },
    success: {
      title: "Adres doğrulandı",
      subtitle: "Artık giriş yapabilirsiniz.",
    },
    error: {
      title: "Doğrulama tamamlanamadı",
      subtitle: "Bağlantının süresi dolmuş ya da daha önce kullanılmış olabilir.",
    },
    "no-token": {
      title: "E-posta doğrulama",
      subtitle: "Size gönderilen bağlantıya tıklayarak adresinizi doğrulayın.",
    },
  }[status];

  const resendBlock = resendSuccess ? (
    <p
      role="status"
      aria-live="polite"
      className="rounded-[var(--radius-xs)] p-3 t-sm"
      style={{ background: "var(--success-bg)", color: "var(--success)" }}
    >
      Bu adres kayıtlıysa doğrulama bağlantısı gönderildi. Gelen kutunuzu ve spam
      klasörünü kontrol edin.
    </p>
  ) : (
    <div>
      <label htmlFor="resend-email" className="t-label mb-1.5 block" style={{ color: "var(--ink-2)" }}>
        Yeni bağlantı iste
      </label>
      <div className="flex gap-2">
        <input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          placeholder="ad.soyad@kurum.com"
          className="theme-input"
        />
        <Button type="button" onClick={handleResend} disabled={resending || !resendEmail}>
          {resending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : "Gönder"}
        </Button>
      </div>
    </div>
  );

  return (
    <AuthLayout
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        <p className="t-sm" style={{ color: "var(--ink-2)" }}>
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Giriş sayfasına dön
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        {status === "loading" && (
          <p role="status" aria-live="polite" className="flex items-center gap-2.5 t-body" style={{ color: "var(--ink-2)" }}>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Bekleyin.
          </p>
        )}

        {status === "success" && (
          <>
            <p
              role="status"
              aria-live="polite"
              className="rounded-[var(--radius-xs)] p-3 t-body"
              style={{ background: "var(--success-bg)", color: "var(--success)" }}
            >
              {message}
            </p>
            <Button asChild>
              <Link href="/login">Giriş yap</Link>
            </Button>
            <p className="t-sm" style={{ color: "var(--ink-3)" }}>
              Giriş sayfasına yönlendiriliyorsunuz.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p
              role="alert"
              aria-live="assertive"
              className="rounded-[var(--radius-xs)] p-3 t-body"
              style={{ background: "var(--error-bg)", color: "var(--error)" }}
            >
              {message}
            </p>
            {resendBlock}
          </>
        )}

        {status === "no-token" && resendBlock}
      </div>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="spinner" role="status" aria-label="Yükleniyor" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
