import * as React from "react";

/**
 * Sayı kartı: etiket, tek büyük değer, altında bir satır bağlam.
 *
 * Dekoratif ikon kutusu taşımaz — kartın işi sayıyı okutmak; renkli ikon
 * karesi sayıdan önce göze giriyordu. `tone` yalnızca durum bildiren
 * sayılarda (gecikmiş, hatalı) kullanılır, süs için değil.
 */
export function StatCard({
  label,
  value,
  note,
  tone = "neutral",
  children,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  /** İlerleme çubuğu gibi ek bir satır. */
  children?: React.ReactNode;
}) {
  const toneColor = {
    neutral: "var(--ink-3)",
    accent: "var(--accent)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--error)",
  }[tone];

  return (
    <div
      className="rounded-[var(--radius-lg)] p-5"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <p className="t-label" style={{ color: "var(--ink-2)" }}>
        {label}
      </p>
      <p className="mt-2 t-metric" style={{ color: "var(--ink)" }}>
        {value}
      </p>
      {note && (
        <p className="mt-1.5 t-sm" style={{ color: toneColor }}>
          {note}
        </p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default StatCard;
