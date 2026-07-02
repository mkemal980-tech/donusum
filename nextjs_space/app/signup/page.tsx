"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Building, UserPlus, AlertCircle, Factory, Layers, Sparkles } from "lucide-react";

interface SubSector {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
  naicsCode: string | null;
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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const router = useRouter();

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

      // Kayıt başarılı - email doğrulama mesajı göster
      setSuccess(`🎉 Kayıt başarılı! ${formData.email} adresine doğrulama linki gönderildi. Lütfen email kutunuzu kontrol edin.`);
      setLoading(false);
      
      // 5 saniye sonra login sayfasına yönlendir
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch (err) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
      setLoading(false);
    }
  };

  const inputClasses = "w-full pl-12 pr-4 py-3.5 bg-[var(--bg-card-2)] border border-[var(--border-soft)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all duration-200";
  const selectClasses = "w-full pl-12 pr-4 py-3.5 bg-[var(--bg-card-2)] border border-[var(--border-soft)] rounded-xl text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all duration-200 appearance-none cursor-pointer";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 bg-[var(--bg-main)]">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-[var(--accent-bright)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-[var(--accent)] rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }} />
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
            className="w-20 h-20 bg-gradient-to-br from-[var(--accent)] to-[var(--blue-main)] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg"
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[var(--text-main)]">Hesap Oluşturun</h1>
          <p className="text-[var(--text-muted)] mt-2">Dönüşüm yolculuğunuza başlayın</p>
        </div>

        <div className="bg-[var(--bg-card)] rounded-3xl shadow-xl p-8 border border-[var(--border-soft)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                role="alert"
                aria-live="assertive"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 bg-[var(--error-bg)] rounded-xl flex items-center gap-3 text-[var(--error)] border border-[var(--error)]"
              >
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-xl text-center bg-[var(--success-bg)] border border-[var(--success)]"
              >
                <div className="text-4xl mb-3">✉️</div>
                <p className="text-[var(--success)] font-medium">{success}</p>
                <p className="text-sm mt-3 text-[var(--text-muted)]">
                  Giriş sayfasına yönlendiriliyorsunuz...
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-4 px-6 py-2 rounded-lg text-sm font-medium transition-all bg-[var(--accent)] text-[var(--bg-deep)] hover:opacity-90"
                >
                  Giriş Sayfasına Git
                </Link>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Ad</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
                <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Soyad</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
              <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
              <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Organizasyon</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
                  <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Sektör</label>
                  <div className="relative">
                    <Factory className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
                    <select
                      name="sectorId"
                      value={formData.sectorId}
                      onChange={handleChange}
                      className={selectClasses}
                    >
                      <option value="">Sektör seçin (opsiyonel)</option>
                      {sectors.map(sector => (
                        <option key={sector.id} value={sector.id}>
                          {sector.naicsCode ? `[${sector.naicsCode}] ` : ''}{sector.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedSector && selectedSector.subSectors?.length > 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Alt Sektör</label>
                    <div className="relative">
                      <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
                <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
                <label className="block text-sm font-semibold text-[var(--text-main)] mb-2">Şifre Tekrar</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--accent)]" size={20} />
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
              className="w-full py-3.5 bg-[var(--accent)] text-[var(--bg-deep)] rounded-xl font-semibold hover:opacity-90 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[var(--accent)]/30"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--bg-deep)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <><UserPlus size={20} /> Kayıt Ol</>
              )}
            </motion.button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border-soft)] text-center">
            <p className="text-[var(--text-muted)]">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="text-[var(--accent)] font-semibold hover:opacity-80 transition-colors">
                Giriş Yapın
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
