"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [showResendVerification, setShowResendVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
          setError("Email adresiniz henüz doğrulanmamış. Lütfen email kutunuzu kontrol edin.");
          setShowResendVerification(true);
        }
        // Hesap devre dışı hatası
        else if (result.error === "ACCOUNT_DISABLED" || result.error.includes("ACCOUNT_DISABLED")) {
          setError("Hesabınız devre dışı bırakılmış. Lütfen yönetici ile iletişime geçin.");
        }
        // Genel hata
        else {
          setError("Geçersiz email veya şifre");
        }
        setLoading(false);
      } else if (result?.ok) {
        window.location.href = "/dashboard";
      } else {
        setError("Beklenmeyen bir hata oluştu");
        setLoading(false);
      }
    } catch (err) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
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
        setError("Doğrulama linki email adresinize gönderildi!");
        setShowResendVerification(false);
      }
    } catch {
      // Güvenlik için hata gösterme
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-main)' }}>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ background: 'var(--accent)' }} />
        <div className="absolute bottom-20 right-20 w-72 h-72 rounded-full filter blur-3xl opacity-10 animate-pulse" style={{ background: 'var(--blue-main)', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full filter blur-3xl opacity-5" style={{ background: 'var(--accent-bright)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              boxShadow: '0 0 30px var(--accent-glow)'
            }}
          >
            <Sparkles className="w-10 h-10" style={{ color: 'var(--bg-deep)' }} />
          </motion.div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-main)' }}>Hoş Geldiniz</h1>
          <p className="mt-2" style={{ color: 'var(--text-muted)' }}>Dönüşüm platformuna giriş yapın</p>
        </div>

        <div className="rounded-2xl p-8" style={{ 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                role="alert"
                aria-live="assertive"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 rounded-lg"
                style={{
                  background: showResendVerification ? 'var(--accent-soft)' : 'var(--error-bg)', 
                  color: showResendVerification ? 'var(--accent)' : 'var(--error)',
                  border: showResendVerification ? '1px solid var(--accent-glow)' : '1px solid rgba(229, 77, 77, 0.3)'
                }}
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
                {showResendVerification && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="mt-3 w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--bg-deep)',
                    }}
                  >
                    Doğrulama Linkini Tekrar Gönder
                  </button>
                )}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-main)' }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--accent)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3.5 rounded-lg transition-all duration-200 outline-none"
                  style={{ 
                    background: 'var(--bg-card-2)', 
                    border: '1px solid var(--border-soft)',
                    color: 'var(--text-main)'
                  }}
                  placeholder="Email adresinizi girin"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Şifre</label>
                <Link href="/forgot-password" className="text-sm font-medium transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--accent)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3.5 rounded-lg transition-all duration-200 outline-none"
                  style={{ 
                    background: 'var(--bg-card-2)', 
                    border: '1px solid var(--border-soft)',
                    color: 'var(--text-main)'
                  }}
                  placeholder="Şifrenizi girin"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              loading={loading}
              className="w-full font-semibold shadow-[0_4px_15px_var(--accent-glow)]"
            >
              {!loading && <LogIn size={20} />}
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>

          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid var(--divider)' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              Hesabınız yok mu?{" "}
              <Link href="/signup" className="font-semibold transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
