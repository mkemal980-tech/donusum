"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/ui/app-shell";

/**
 * Hesap ve görünüm.
 *
 * Sayfa eskiden tema ve vurgu rengi seçtiriyordu. Arayüz artık tek koyu
 * temayla geliyor (bkz. DESIGN.md > Theme), o yüzden seçim kalmadı; yerine
 * kullanıcının hangi kayıtla çalıştığını gösteren profil özeti kondu.
 * Alanlar salt okunur: değişiklik yetkisi platform yöneticisinde.
 */

interface Profile {
  firstName: string | null;
  lastName: string | null;
  email: string;
  organization: string | null;
  role: string;
  sector: { name: string } | null;
  subSector: { name: string } | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Platform yöneticisi",
  UNIT_MANAGER: "Birim yöneticisi",
  USER: "Kullanıcı",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) setProfile(await res.json());
      } catch (error) {
        console.error("Profil okunamadı:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const rows: { label: string; value: string }[] = profile
    ? [
        {
          label: "Ad soyad",
          value: [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—",
        },
        { label: "E-posta", value: profile.email },
        { label: "Kuruluş", value: profile.organization || "—" },
        { label: "Sektör", value: profile.sector?.name || "Tanımlı değil" },
        { label: "Alt sektör", value: profile.subSector?.name || "Tanımlı değil" },
        { label: "Rol", value: ROLE_LABEL[profile.role] ?? profile.role },
        {
          label: "Kayıt tarihi",
          value: new Date(profile.createdAt).toLocaleDateString("tr-TR"),
        },
      ]
    : [];

  return (
    <>
      <AppShell />

      <main>
        <h1 className="t-display" style={{ color: "var(--ink)" }}>
          Hesap
        </h1>
        <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
          Değerlendirmenin hangi kayda işlendiğini buradan görebilirsiniz.
        </p>

        <section
          className="mt-6 max-w-2xl rounded-[var(--radius-lg)] p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-5" />
              ))}
            </div>
          ) : profile ? (
            <dl>
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  className="flex flex-wrap items-baseline justify-between gap-4 py-3"
                  style={{ borderTop: i === 0 ? undefined : "1px solid var(--line)" }}
                >
                  <dt className="t-sm" style={{ color: "var(--ink-2)" }}>
                    {row.label}
                  </dt>
                  <dd className="t-body" style={{ color: "var(--ink)" }}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="t-body" style={{ color: "var(--ink-2)" }}>
              Profil bilgileri okunamadı. Sayfayı yenileyin.
            </p>
          )}
        </section>

        <p className="mt-4 max-w-2xl t-sm" style={{ color: "var(--ink-3)" }}>
          Bu alanları değiştirmek için kuruluşunuzun platform yöneticisiyle görüşün.
          Arayüz tek koyu temayla gelir, ayrı bir görünüm tercihi tutulmaz.
        </p>
      </main>
    </>
  );
}
