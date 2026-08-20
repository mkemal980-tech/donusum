"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/ui/auth-layout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "İstek tamamlanamadı. Birkaç saniye sonra tekrar deneyin.");
      }
    } catch {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = (
    <p className="t-sm" style={{ color: "var(--ink-2)" }}>
      <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
        Giriş sayfasına dön
      </Link>
    </p>
  );

  if (success) {
    return (
      <AuthLayout
        title="Bağlantı gönderildi"
        subtitle="Sıradaki adım e-posta kutunuzda."
        footer={backToLogin}
      >
        <p
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-xs)] p-3 t-body"
          style={{ background: "var(--success-bg)", color: "var(--success)" }}
        >
          Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu ve
          spam klasörünü kontrol edin.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Şifremi unuttum"
      subtitle="E-posta adresinizi girin, sıfırlama bağlantısını gönderelim."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="flex gap-2.5 rounded-[var(--radius-xs)] p-3 t-sm"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div>
          <label htmlFor="email" className="t-label mb-1.5 block" style={{ color: "var(--ink-2)" }}>
            E-posta
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="theme-input"
            placeholder="ad.soyad@kurum.com"
            required
          />
        </div>

        <Button type="submit" loading={loading} className="mt-1 w-full">
          {loading ? "Gönderiliyor" : "Sıfırlama bağlantısı gönder"}
        </Button>
      </form>
    </AuthLayout>
  );
}
