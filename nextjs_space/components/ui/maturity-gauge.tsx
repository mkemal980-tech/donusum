"use client";

import { MaturityLevelBar } from "./maturity-level-bar";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
  showOverallLevel?: boolean;
}

/**
 * Puanlama:
 * - Puan = (Yüzde / 100) × 4 + 1
 * - %0 → 1.0 puan, %100 → 5.0 puan
 *
 * Basamak renkleri tek renkli mavi rampadır: seviye yükseldikçe parlar.
 * Sıcak/soğuk renk karışımı seviyeyi değil "iyi/kötü"yü anlatıyordu.
 */
export const getScoreLevel = (score: number): { label: string; color: string; darkColor: string } => {
  const percentage = ((score - 1) / 4) * 100;

  if (percentage >= 80) return { label: "Lider", color: "var(--level-5)", darkColor: "var(--level-5)" };
  if (percentage >= 60) return { label: "Olgun", color: "var(--level-4)", darkColor: "var(--level-4)" };
  if (percentage >= 40) return { label: "Gelişen", color: "var(--level-3)", darkColor: "var(--level-3)" };
  if (percentage >= 20) return { label: "Farkındalık", color: "var(--level-2)", darkColor: "var(--level-2)" };
  return { label: "Başlangıç", color: "var(--level-1)", darkColor: "var(--level-1)" };
};

export const percentageToScore = (percentage: number): number => {
  return (percentage / 100) * 4 + 1;
};

export const scoreToPercentage = (score: number): number => {
  return ((score - 1) / 4) * 100;
};

/**
 * Kategori kartındaki seviyelendirme. Panonun tepesindeki ölçekle aynı
 * bileşeni kullanır — aynı şey iki ekranda iki farklı biçimde çizilmesin.
 */
export function MaturityGauge({ score, title = "Seviyelendirme" }: MaturityGaugeProps) {
  return (
    <section
      className="h-full rounded-[var(--radius-lg)] p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      aria-label={title}
    >
      <MaturityLevelBar score={score} isPercentage={false} />
    </section>
  );
}
