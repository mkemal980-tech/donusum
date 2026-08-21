"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthLayout from "@/components/ui/auth-layout";

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
  /** Hatanın türü — ekran buna göre çözüm önerir. */
  const [errorReason, setErrorReason] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
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
        // Uç nokta hata döndüğünde gövde dizi değil `{error}` olur; onu
        // olduğu gibi state'e koymak aşağıdaki `sectors.find` çağrısını
        // patlatır ve kullanıcı formu değil boş bir hata ekranı görür.
        setSectors(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch sectors:", err);
        setSectors([]);
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

  /** Kayıtlı ama doğrulanmamış hesap için doğrulama postasını yeniden ister. */
  const handleResendVerification = async () => {
    setResendState("sending");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.");
        setErrorReason("");
        setResendState("idle");
        return;
      }
      setResendState("sent");
    } catch (err) {
      console.error("Resend verification failed:", err);
      setError("Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.");
      setErrorReason("");
      setResendState("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrorReason("");
    setResendState("idle");

    if ((formData?.password ?? '') !== (formData?.confirmPassword ?? '')) {
      setError("Şifreler birbirini tutmuyor.");
      return;
    }

    if (!formData?.sectorId) {
      setError("Sektör seçilmeden kayıt tamamlanamıyor.");
      return;
    }

    // Sunucudaki kuralın aynısı (bkz. lib/api-utils validators.password).
    // Ekran 6 karakter derken sunucu 8 + büyük harf + rakam istiyordu;
    // kullanıcı formu doldurup gönderdikten sonra beklemediği bir hata alıyordu.
    const password = formData?.password ?? "";
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Şifre en az 8 karakter olmalı; bir büyük harf ve bir rakam içermeli.");
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
        setError(data?.error || "Kayıt tamamlanamadı. Lütfen tekrar deneyin.");
        setErrorReason(typeof data?.reason === "string" ? data.reason : "");
        setLoading(false);
        return;
      }

      // Kayıt başarılı - email doğrulama mesajı göster
      setSuccess(`${formData.email} adresine doğrulama bağlantısı gönderildi. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.`);
      setLoading(false);
      
      // 5 saniye sonra login sayfasına yönlendir
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch (err) {
      setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      setLoading(false);
    }
  };

  const groupLabel = "t-label mb-1.5 block";

  return (
    <AuthLayout
      title="Hesap oluştur"
      subtitle="Kuruluşunuzu tanımlayın, değerlendirmeye buradan başlayın."
      footer={
        <p className="t-sm" style={{ color: "var(--ink-2)" }}>
          Hesabınız var mı?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
            Giriş yapın
          </Link>
        </p>
      }
    >
      {success ? (
        /* Kayıt bittiğinde form değil, tek bir sonraki adım kalır. */
        <div role="status" aria-live="polite" className="flex flex-col gap-4">
          <p
            className="rounded-[var(--radius-xs)] p-3 t-body"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            {success}
          </p>
          <p className="t-sm" style={{ color: "var(--ink-3)" }}>
            Giriş sayfasına yönlendiriliyorsunuz.
          </p>
          <Button asChild>
            <Link href="/login">Giriş sayfasına git</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-[var(--radius-xs)] p-3"
              style={{ background: "var(--error-bg)" }}
            >
              <div className="flex gap-2.5">
                <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--error)" }} aria-hidden="true" />
                <p className="t-sm" style={{ color: "var(--error)" }}>
                  {error}
                </p>
              </div>

              {/* Hata söylendi; sıradaki soru "peki ne yapacağım" — cevabı
                  aynı kutuda dursun, kullanıcı çıkış aramasın. */}
              {errorReason === "email_taken" && (
                <ul
                  className="mt-3 flex list-disc flex-col gap-1.5 pl-5 pt-3 t-sm"
                  style={{ borderTop: "1px solid var(--line)", color: "var(--ink-2)" }}
                >
                  <li>
                    Hesap sizinse{" "}
                    <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                      giriş yapın
                    </Link>
                    .
                  </li>
                  <li>
                    Şifrenizi hatırlamıyorsanız{" "}
                    <Link href="/forgot-password" className="font-medium hover:underline" style={{ color: "var(--accent)" }}>
                      sıfırlayın
                    </Link>
                    .
                  </li>
                  <li>
                    Doğrulama e-postası gelmediyse{" "}
                    {resendState === "sent" ? (
                      <span className="font-medium" style={{ color: "var(--success)" }}>
                        gönderildi — gelen kutunuzu ve spam klasörünü kontrol edin
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendState === "sending" || !formData.email}
                        className="font-medium hover:underline disabled:opacity-50"
                        style={{ color: "var(--accent)" }}
                      >
                        {resendState === "sending" ? "gönderiliyor" : "yeniden gönderin"}
                      </button>
                    )}
                    .
                  </li>
                  <li>Başka bir e-posta adresiyle kayıt olabilirsiniz.</li>
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="firstName" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Ad
              </label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                autoComplete="given-name"
                value={formData.firstName}
                onChange={handleChange}
                className="theme-input"
                placeholder="Adınız"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Soyad
              </label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                autoComplete="family-name"
                value={formData.lastName}
                onChange={handleChange}
                className="theme-input"
                placeholder="Soyadınız"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className={groupLabel} style={{ color: "var(--ink-2)" }}>
              E-posta
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              className="theme-input"
              placeholder="ad.soyad@kurum.com"
              required
            />
          </div>

          <div>
            <label htmlFor="organization" className={groupLabel} style={{ color: "var(--ink-2)" }}>
              Kuruluş
            </label>
            <input
              id="organization"
              type="text"
              name="organization"
              autoComplete="organization"
              value={formData.organization}
              onChange={handleChange}
              className="theme-input"
              placeholder="Şirket adı"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sectorId" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Sektör
              </label>
              <select
                id="sectorId"
                name="sectorId"
                value={formData.sectorId}
                onChange={handleChange}
                className="theme-select"
                disabled={loadingSectors}
                required
              >
                <option value="">{loadingSectors ? "Yükleniyor" : "Sektör seçin"}</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
              {!loadingSectors && sectors.length === 0 && (
                <p className="mt-1.5 t-sm" style={{ color: "var(--warning)" }}>
                  Sektör listesi yüklenemedi. Sayfayı yenileyin.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="subSectorId" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Alt sektör{" "}
                <span className="font-normal" style={{ color: "var(--ink-3)" }}>
                  (isteğe bağlı)
                </span>
              </label>
              <select
                id="subSectorId"
                name="subSectorId"
                value={formData.subSectorId}
                onChange={handleChange}
                className="theme-select"
                disabled={!selectedSector || (selectedSector.subSectors?.length ?? 0) === 0}
              >
                <option value="">
                  {selectedSector ? "Alt sektör seçin" : "Önce sektör seçin"}
                </option>
                {selectedSector?.subSectors?.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="password" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Şifre
              </label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                className="theme-input"
                aria-describedby="password-rule"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={groupLabel} style={{ color: "var(--ink-2)" }}>
                Şifre tekrar
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="theme-input"
                required
              />
            </div>
          </div>

          <p id="password-rule" className="-mt-2 t-sm" style={{ color: "var(--ink-3)" }}>
            En az 8 karakter, bir büyük harf ve bir rakam.
          </p>

          <Button type="submit" loading={loading} className="mt-1">
            {!loading && <UserPlus size={16} aria-hidden="true" />}
            {loading ? "Hesap oluşturuluyor" : "Hesap oluştur"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
