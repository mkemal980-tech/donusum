"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Tema seçici.
 *
 * İki tema var: koyu (varsayılan, platformun bugünkü görünümü) ve açık
 * "ESG LAB" teması. Seçim next-themes ile tarayıcıda saklanır, sunucuya
 * gitmez — kullanıcı hesabına bağlı bir tercih değil, cihaz tercihidir.
 *
 * `mounted` beklemesi şart: sunucu hangi temanın seçili olduğunu bilmez,
 * beklemeden çizersek ilk kare yanlış temayla gelir.
 */

const THEMES = [
  { value: "dark", label: "Koyu", icon: Moon },
  { value: "light", label: "Açık", icon: Sun },
] as const;

export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Yer tutucu: düğme belirince satırın kaymaması için aynı ölçüde.
    return <div className={compact ? "h-9 w-[76px]" : "h-10 w-[168px]"} aria-hidden />;
  }

  const active = theme === "light" ? "light" : "dark";

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]"
    >
      {THEMES.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            title={`${label} tema`}
            className={`inline-flex items-center gap-2 rounded-md transition-colors ${
              compact ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm"
            } ${
              selected
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Icon size={compact ? 14 : 16} />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
