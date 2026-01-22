"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, AlertCircle, Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn?.("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        setError("Geçersiz email veya şifre");
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-main)] dark:bg-gradient-to-br dark:from-[#0a1628] dark:to-[#111d32]">
      {/* Theme Toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-6 right-6 z-50 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-light)] shadow-lg hover:shadow-xl transition-all duration-300"
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5 text-yellow-400" />
        ) : (
          <Moon className="w-5 h-5 text-[var(--primary)]" />
        )}
      </button>

      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-[var(--primary)] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-10 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-[var(--secondary)] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-10 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--accent)] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-10 dark:opacity-5" />
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
            className="w-20 h-20 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg dark:shadow-[0_0_30px_rgba(34,211,238,0.3)]"
          >
            <Sparkles className="w-10 h-10 text-white dark:text-[var(--bg-main)]" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Hoş Geldiniz</h1>
          <p className="text-[var(--text-secondary)] mt-2">Dönüşüm platformuna giriş yapın</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-3xl shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 border border-[var(--border-light)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50"
              >
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--bg-secondary)] dark:bg-[var(--bg-main)] border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
                  placeholder="Email adresinizi girin"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-[var(--text-primary)]">Şifre</label>
                <Link href="/forgot-password" className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors">
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3.5 bg-[var(--bg-secondary)] dark:bg-[var(--bg-main)] border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200"
                  placeholder="Şifrenizi girin"
                  required
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white dark:text-[var(--bg-main)] rounded-xl font-semibold hover:from-[var(--primary-light)] hover:to-[var(--primary)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg dark:shadow-[0_4px_20px_rgba(34,211,238,0.3)]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white dark:border-[var(--bg-main)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <><LogIn size={20} /> Giriş Yap</>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border-light)] text-center">
            <p className="text-[var(--text-secondary)]">
              Hesabınız yok mu?{" "}
              <Link href="/signup" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-light)] transition-colors">
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
