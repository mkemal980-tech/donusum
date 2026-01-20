"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#1e3a8a] to-[#a78bfa] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Hoş Geldiniz</h1>
          <p className="text-gray-600 mt-2">Dönüşüm platformuna giriş yapın</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle size={20} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent outline-none transition-all"
                  placeholder="Email adresinizi girin"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Şifre</label>
                <Link href="/forgot-password" className="text-sm text-[#1e3a8a] hover:underline">
                  Şifremi Unuttum
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target?.value ?? '')}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent outline-none transition-all"
                  placeholder="Şifrenizi girin"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><LogIn size={20} /> Giriş Yap</>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Hesabınız yok mu?{" "}
              <Link href="/signup" className="text-[#1e3a8a] font-medium hover:underline">
                Kayıt Ol
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}