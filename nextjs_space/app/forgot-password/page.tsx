"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

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
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a8a] to-[#3b5998] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Gönderildi</h2>
          <p className="text-gray-600 mb-6">
            Eğer bu email adresi sistemimizde kayıtlıysa, şifre sıfırlama linki gönderildi.
            Lütfen email kutunuzu kontrol edin.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[#1e3a8a] hover:underline"
          >
            <ArrowLeft size={16} />
            Giriş sayfasına dön
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a8a] to-[#3b5998] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="text-[#1e3a8a]" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Şifremi Unuttum</h1>
          <p className="text-gray-600 mt-2">
            Email adresinizi girin, size şifre sıfırlama linki gönderelim.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Adresi
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors disabled:opacity-50"
          >
            {loading ? "Gönderiliyor..." : "Sıfırlama Linki Gönder"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[#1e3a8a] hover:underline"
          >
            <ArrowLeft size={16} />
            Giriş sayfasına dön
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
