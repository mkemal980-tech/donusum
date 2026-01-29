"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight, Sparkles } from "lucide-react";

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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/2 -left-1/2 w-full h-full rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: "var(--blue-main)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-2xl p-8"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Sparkles className="w-8 h-8" style={{ color: "var(--bg-deep)" }} />
            </div>
          </div>

          {/* Loading */}
          {status === "loading" && (
            <div className="text-center">
              <Loader2
                className="w-12 h-12 mx-auto mb-4 animate-spin"
                style={{ color: "var(--accent)" }}
              />
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Email Adresiniz Doğrulanıyor...
              </h2>
              <p style={{ color: "var(--text-muted)" }}>
                Lütfen bekleyin.
              </p>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
              >
                <CheckCircle2 className="w-10 h-10 text-[var(--success)]" />
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Email Doğrulandı! 🎉
              </h2>
              <p className="mb-6" style={{ color: "var(--text-muted)" }}>
                {message}
              </p>
              <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
                Giriş sayfasına yönlendiriliyorsunuz...
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--bg-deep)",
                }}
              >
                Giriş Yap
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
              >
                <XCircle className="w-10 h-10 text-[var(--error)]" />
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Doğrulama Başarısız
              </h2>
              <p className="mb-6" style={{ color: "var(--text-muted)" }}>
                {message}
              </p>

              {/* Resend Form */}
              {!resendSuccess ? (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: "var(--bg-card-2)" }}
                >
                  <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                    Yeni doğrulama linki almak için email adresinizi girin:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Email adresiniz"
                      className="flex-1 px-4 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-soft)",
                        color: "var(--text-main)",
                      }}
                    />
                    <button
                      onClick={handleResend}
                      disabled={resending || !resendEmail}
                      className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--bg-deep)",
                      }}
                    >
                      {resending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Gönder"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                >
                  <p className="text-sm text-[var(--success)]">
                    ✅ Eğer email adresi kayıtlıysa, doğrulama linki gönderildi.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No Token */}
          {status === "no-token" && (
            <div className="text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(12, 193, 195, 0.1)" }}
              >
                <Mail className="w-10 h-10" style={{ color: "var(--accent)" }} />
              </div>
              <h2
                className="text-xl font-semibold mb-2"
                style={{ color: "var(--text-main)" }}
              >
                Email Doğrulama
              </h2>
              <p className="mb-6" style={{ color: "var(--text-muted)" }}>
                Email adresinizi doğrulamak için size gönderilen linke tıklayın.
              </p>

              {/* Resend Form */}
              {!resendSuccess ? (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: "var(--bg-card-2)" }}
                >
                  <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                    Doğrulama linki almadınız mı? Email adresinizi girin:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="Email adresiniz"
                      className="flex-1 px-4 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-soft)",
                        color: "var(--text-main)",
                      }}
                    />
                    <button
                      onClick={handleResend}
                      disabled={resending || !resendEmail}
                      className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "var(--bg-deep)",
                      }}
                    >
                      {resending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Gönder"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}
                >
                  <p className="text-sm text-[var(--success)]">
                    ✅ Eğer email adresi kayıtlıysa, doğrulama linki gönderildi.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              ← Giriş sayfasına dön
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: "var(--bg-main)" }}
        >
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "var(--accent)" }}
          />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
