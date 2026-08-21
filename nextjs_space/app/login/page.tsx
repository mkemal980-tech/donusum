"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { AlertCircle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/ui/auth-layout";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [showResendVerification, setShowResendVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setShowResendVerification(false);
    setLoading(true);

    try {
      const result = await signIn?.("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        // Email doğrulama hatası
        if (result.error === "EMAIL_NOT_VERIFIED" || result.error.includes("EMAIL_NOT_VERIFIED")) {
          setError("Bu adres henüz doğrulanmadı. Gelen kutunuzdaki doğrulama bağlantısını kullanın.");
          setShowResendVerification(true);
        }
        // Hesap devre dışı hatası
        else if (result.error === "ACCOUNT_DISABLED" || result.error.includes("ACCOUNT_DISABLED")) {
          setError("Hesap devre dışı. Kuruluşunuzun platform yöneticisiyle görüşün.");
        }
        // Genel hata
        else {
          setError("E-posta veya şifre hatalı.");
        }
        setLoading(false);
      } else if (result?.ok) {
        window.location.href = "/dashboard";
      } else {
        setError("Giriş tamamlanamadı. Birkaç saniye sonra tekrar deneyin.");
        setLoading(false);
      }
    } catch (err) {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setError("");
        setNotice("Doğrulama bağlantısı e-posta adresinize gönderildi.");
        setShowResendVerification(false);
      }
    } catch {
      // Güvenlik için hata gösterme
    }
  };

  return (
    <AuthLayout
      title="Giriş yap"
      subtitle="Kuruluşunuzun olgunluk değerlendirmesine devam edin."
      footer={
        <p className="t-sm" style={{ color: "var(--ink-2)" }}>
          Hesabınız yok mu?{" "}
          <Link href="/signup" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Kayıt olun
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex gap-2.5 rounded-[var(--radius-xs)] p-3"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="t-sm">{error}</p>
              {showResendVerification && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="mt-2 t-sm font-medium underline underline-offset-4"
                  style={{ color: "var(--ink)" }}
                >
                  Doğrulama bağlantısını tekrar gönder
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-[var(--radius-xs)] p-3 t-sm"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            {notice}
          </p>
        )}

        <div>
          <label htmlFor="email" className="t-label mb-1.5 block" style={{ color: "var(--ink-2)" }}>
            E-posta
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target?.value ?? "")}
            className="theme-input"
            placeholder="ad.soyad@kurum.com"
            required
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="t-label" style={{ color: "var(--ink-2)" }}>
              Şifre
            </label>
            <Link
              href="/forgot-password"
              className="t-sm hover:underline"
              style={{ color: "var(--accent)" }}
            >
              Şifremi unuttum
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target?.value ?? "")}
            className="theme-input"
            required
          />
        </div>

        {/* Tek birincil eylem. Kayıt yolu altta, giriş ile yarışmasın. */}
        <Button type="submit" loading={loading} className="mt-1 w-full">
          {!loading && <LogIn size={16} aria-hidden="true" />}
          {loading ? "Giriş yapılıyor" : "Giriş yap"}
        </Button>
      </form>
    </AuthLayout>
  );
}
