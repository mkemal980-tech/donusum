"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Building, UserPlus, AlertCircle, Factory, Layers, Sparkles, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

interface SubSector {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
  subSectors: SubSector[];
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    organization: "",
    sectorId: "",
    subSectorId: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const res = await fetch("/api/sectors");
        const data = await res.json();
        setSectors(data || []);
      } catch (err) {
        console.error("Failed to fetch sectors:", err);
      } finally {
        setLoadingSectors(false);
      }
    };
    fetchSectors();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target ?? {};
    setFormData(prev => {
      const newData = { ...(prev ?? {}), [name ?? '']: value ?? '' };
      if (name === 'sectorId') {
        newData.subSectorId = '';
      }
      return newData;
    });
  };

  const selectedSector = sectors.find(s => s.id === formData.sectorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if ((formData?.password ?? '') !== (formData?.confirmPassword ?? '')) {
      setError("Şifreler eşleşmiyor");
      return;
    }

    if ((formData?.password?.length ?? 0) < 6) {
      setError("Şifre en az 6 karakter olmalıdır");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData?.email,
          password: formData?.password,
          firstName: formData?.firstName,
          lastName: formData?.lastName,
          organization: formData?.organization,
          sectorId: formData?.sectorId,
          subSectorId: formData?.subSectorId || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Kayıt başarısız");
        setLoading(false);
        return;
      }

      const result = await signIn?.("credentials", {
        email: formData?.email,
        password: formData?.password,
        redirect: false,
        callbackUrl: "/dashboard"
      });

      if (result?.error) {
        setError("Kayıt başarılı ancak giriş yapılamadı");
        setLoading(false);
      } else if (result?.ok) {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  const inputClasses = "w-full pl-12 pr-4 py-3.5 bg-[var(--bg-secondary)] dark:bg-[var(--bg-main)] border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200";
  const selectClasses = "w-full pl-12 pr-4 py-3.5 bg-[var(--bg-secondary)] dark:bg-[var(--bg-main)] border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all duration-200 appearance-none cursor-pointer";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-[var(--bg-main)] dark:bg-gradient-to-br dark:from-[#0a1628] dark:to-[#111d32]">
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
        <div className="absolute top-20 right-20 w-72 h-72 bg-[var(--secondary)] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-10 animate-pulse" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-[var(--primary)] rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-20 dark:opacity-10 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
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
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Hesap Oluşturun</h1>
          <p className="text-[var(--text-secondary)] mt-2">Dönüşüm yolculuğunuza başlayın</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-3xl shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8 border border-[var(--border-light)]">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Ad</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Adınız"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Soyad</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Soyadınız"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Email adresiniz"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Organizasyon</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className={inputClasses}
                  placeholder="Şirket adı"
                  required
                />
              </div>
            </div>

            {!loadingSectors && sectors.length > 0 && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Sektör</label>
                  <div className="relative">
                    <Factory className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                    <select
                      name="sectorId"
                      value={formData.sectorId}
                      onChange={handleChange}
                      className={selectClasses}
                    >
                      <option value="">Sektör seçin (opsiyonel)</option>
                      {sectors.map(sector => (
                        <option key={sector.id} value={sector.id}>{sector.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedSector && selectedSector.subSectors?.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Alt Sektör</label>
                    <div className="relative">
                      <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                      <select
                        name="subSectorId"
                        value={formData.subSectorId}
                        onChange={handleChange}
                        className={selectClasses}
                      >
                        <option value="">Alt sektör seçin (opsiyonel)</option>
                        {selectedSector.subSectors.map(sub => (
                          <option key={sub.id} value={sub.id}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="En az 6 karakter"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">Şifre Tekrar</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)]" size={20} />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Şifreyi tekrarlayın"
                    required
                  />
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white dark:text-[var(--bg-main)] rounded-xl font-semibold hover:from-[var(--primary-light)] hover:to-[var(--secondary-light)] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg dark:shadow-[0_4px_20px_rgba(34,211,238,0.3)]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white dark:border-[var(--bg-main)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <><UserPlus size={20} /> Kayıt Ol</>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border-light)] text-center">
            <p className="text-[var(--text-secondary)]">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="text-[var(--primary)] font-semibold hover:text-[var(--primary-light)] transition-colors">
                Giriş Yapın
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
