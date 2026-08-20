"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/ui/auth-layout";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Bu sıfırlama bağlantısı geçersiz. Yeni bir bağlantı isteyin.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Şifreler birbirini tutmuyor.");
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 3000);
      } else {
        setError(data.error || "Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir.");
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
        title="Şifre güncellendi"
        subtitle="Yeni şifrenizle giriş yapabilirsiniz."
        footer={backToLogin}
      >
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <p
            className="rounded-[var(--radius-xs)] p-3 t-body"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            Şifreniz değiştirildi. Giriş sayfasına yönlendiriliyorsunuz.
          </p>
          <Button asChild>
            <Link href="/login">Giriş sayfasına git</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Yeni şifre belirle"
      subtitle="Bağlantı tek kullanımlıktır; şifreyi bir kez belirleyebilirsiniz."
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
          <label htmlFor="password" className="t-label mb-1.5 block" style={{ color: "var(--ink-2)" }}>
            Yeni şifre
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="theme-input"
              style={{ paddingRight: 44 }}
              aria-describedby="password-rule"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn"
              style={{ width: 32, height: 32 }}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p id="password-rule" className="mt-1.5 t-sm" style={{ color: "var(--ink-3)" }}>
            En az 6 karakter.
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="t-label mb-1.5 block" style={{ color: "var(--ink-2)" }}>
            Şifre tekrar
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="theme-input"
            required
          />
        </div>

        <Button type="submit" loading={loading} className="mt-1 w-full">
          {loading ? "Güncelleniyor" : "Şifreyi güncelle"}
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="spinner" role="status" aria-label="Yükleniyor" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
