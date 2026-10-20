"use client";

/** Üye panosuna giden bağlantı; ADMIN ile birim yöneticisinde farklı sayfadır. */
export type MemberHref = (row: { unitId: string; assessmentId?: string | null; surveyId?: string | null }, tab?: string) => string;

export const n = (value: number) => value.toLocaleString("tr-TR");
export const empty = (text = "Seçili dönemde gönderilmiş sonuç yok.") => <p className="t-sm text-[var(--ink-2)]">{text}</p>;

export function Legend({ color, label, value }: { color: string; label: string; value: number | string }) {
  return <span className="flex items-center gap-2 t-sm text-[var(--ink-2)]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />{label}<strong className="tabular font-medium text-[var(--ink)]">{value}</strong></span>;
}

/** Birden çok seçenekten biri; sekme değil, aynı listeyi farklı açıdan gösterir. */
export function Toggle<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-1">
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
      className={"min-h-[36px] rounded-[6px] px-3 t-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] " + (value === key ? "bg-[var(--surface)] text-[var(--ink)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]")}>{text}</button>)}
  </div>;
}

/** Kart içi sayı bloğu: iç içe kart yerine --surface-2 zeminli, kenarlıksız blok (DESIGN.md > Card). */
export function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><p className="t-label text-[var(--ink-2)]">{label}</p><p className="mt-2 t-metric tabular">{value}</p>{note && <p className="mt-1 t-sm text-[var(--ink-3)]">{note}</p>}</div>;
}
