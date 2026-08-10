"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        setError(data.error || "Bir hata oluştu");
      }
    } catch {
      setError("Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--bg-card)] rounded-2xl shadow-2xl p-8 w-full max-w-md text-center"
        >
          <div className="w-16 h-16 bg-[var(--accent-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-[var(--accent)]" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Email Gönderildi</h2>
          <p className="text-[var(--text-muted)] mb-6">
            Eğer bu email adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderildi.
            Lütfen email kutunuzu kontrol edin.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline"
          >
            <ArrowLeft size={16} />
            Giriş sayfasına dön
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-card)] rounded-2xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--info-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-[var(--accent)]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">Şifremi Unuttum</h1>
          <p className="text-[var(--text-muted)] mt-2">
            Email adresinizi girin, size şifre sıfırlama linki gönderelim.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[var(--error-bg)] border border-[var(--error)]/50 rounded-lg flex items-center gap-2 text-[var(--error)]">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              Email Adresi
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <Button type="submit" size="lg" loading={loading} className="w-full">
            {loading ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline"
          >
            <ArrowLeft size={16} />
            Giriş sayfasına dön
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
