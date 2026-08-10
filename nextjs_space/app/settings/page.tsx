"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Palette } from "lucide-react";
import Header from "@/components/ui/header";
import ThemeSwitch from "@/components/ui/theme-switch";

/**
 * Görünüm ayarları.
 *
 * Tema ve vurgu rengi cihaz tercihidir: tarayıcıda saklanır, hesaba
 * yazılmaz. Vurgu seçenekleri yalnızca açık temada geçerli — koyu tema
 * platformun kurumsal turkuazıyla sabittir.
 */

const ACCENTS = [
  { value: "orange", label: "Turuncu (ESG LAB)", color: "#fa541c" },
  { value: "blue", label: "Mavi", color: "#2563eb" },
  { value: "indigo", label: "Indigo", color: "#4f46e5" },
  { value: "cyan", label: "Camgöbeği", color: "#0e7490" },
  { value: "green", label: "Yeşil", color: "#1f8a5b" },
];

const ACCENT_STORAGE_KEY = "esg-accent";

export default function SettingsPage() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [accent, setAccent] = useState("orange");

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored) {
      setAccent(stored);
      document.documentElement.setAttribute("data-accent", stored);
    }
  }, []);

  const chooseAccent = (value: string) => {
    setAccent(value);
    document.documentElement.setAttribute("data-accent", value);
    window.localStorage.setItem(ACCENT_STORAGE_KEY, value);
  };

  const lightActive = mounted && theme === "light";

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-main)] flex items-center gap-3">
            <Palette className="text-[var(--accent)]" />
            Görünüm
          </h1>
          <p className="text-[var(--text-muted)] mt-2">
            Tema tercihiniz bu cihazda saklanır; başka bir cihazda oturum açtığınızda
            yeniden seçmeniz gerekir.
          </p>
        </div>

        <section className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)] space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Tema</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              <strong className="text-[var(--text-main)]">Koyu</strong> — platformun bugünkü
              görünümü, turkuaz vurgulu.{" "}
              <strong className="text-[var(--text-main)]">Açık</strong> — ESG LAB kurumsal
              kimliği: turuncu vurgu, Space Grotesk ve IBM Plex yazı aileleri.
            </p>
          </div>
          <ThemeSwitch />
        </section>

        <section className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)] space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-main)]">Vurgu rengi</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Açık temada geçerlidir. Marka rengi turuncudur; diğerleri iç kullanım içindir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((option) => {
              const selected = accent === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseAccent(option.value)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-2 px-3 h-10 rounded-lg border text-sm transition-colors ${
                    selected
                      ? "border-[var(--accent)] text-[var(--text-main)]"
                      : "border-[var(--border-soft)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-[var(--border-soft)]"
                    style={{ background: option.color }}
                    aria-hidden
                  />
                  {option.label}
                  {selected && <Check size={14} className="text-[var(--accent)]" />}
                </button>
              );
            })}
          </div>

          {mounted && !lightActive && (
            <p className="text-xs text-[var(--text-dim)]">
              Seçiminiz kaydedildi; etkisini görmek için açık temaya geçin.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
