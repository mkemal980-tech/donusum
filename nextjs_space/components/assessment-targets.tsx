"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import type { AssessmentView } from "@/lib/assessment-view";

type Row = { percentage: string; targetDate: string };
const toRow = (value: { percentage: number; targetDate: string | null } | null | undefined): Row => ({
  percentage: value ? String(value.percentage) : "",
  // Hedef tarihi gün sonu (İstanbul) olarak saklanır; tarih alanı İstanbul günüyle dolar.
  targetDate: value?.targetDate ? new Date(value.targetDate).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : "",
});
const toTarget = (row: Row) => row.percentage.trim() ? { percentage: Number(row.percentage.replace(",", ".")), targetDate: row.targetDate || null } : null;

/**
 * Kuruluşun kendi hedefi: genel ve kategori başına, 100 üzerinden puan ve
 * isteğe bağlı tarih. Boş bırakılan alan hedef yok demektir.
 */
export function TargetsDialog({ view, open, saving, onOpenChange, onSave }: {
  view: AssessmentView; open: boolean; saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (targets: { overall: ReturnType<typeof toTarget>; categories: ({ categoryId: string } & NonNullable<ReturnType<typeof toTarget>>)[] }) => void;
}) {
  const [overall, setOverall] = useState<Row>(toRow(view.targets.overall));
  const [categories, setCategories] = useState<Record<string, Row>>({});
  useEffect(() => {
    if (!open) return;
    setOverall(toRow(view.targets.overall));
    setCategories(Object.fromEntries(view.categories.map(category => [category.id, toRow(view.targets.categories[category.id])])));
  }, [open, view]);

  const columns = "grid grid-cols-[minmax(0,1fr)_7rem_10rem] items-center gap-3";
  const field = (id: string, label: string, row: Row, change: (row: Row) => void) => <fieldset key={id} className={columns}>
    <legend className="sr-only">{label}</legend>
    <span className="t-sm font-medium text-[var(--ink)]">{label}</span>
    <div><label htmlFor={"target-" + id} className="sr-only">Hedef puan</label>
      <input id={"target-" + id} aria-label={label + " hedef puanı"} type="number" inputMode="decimal" min="1" max="100" step="0.1" className="theme-input w-full" placeholder="—"
        value={row.percentage} disabled={saving} onChange={event => change({ ...row, percentage: event.target.value })} /></div>
    <div><label htmlFor={"target-date-" + id} className="sr-only">Tarih</label>
      <input id={"target-date-" + id} aria-label={label + " hedef tarihi"} type="date" className="theme-input w-full"
        value={row.targetDate} disabled={saving || !row.percentage.trim()} onChange={event => change({ ...row, targetDate: event.target.value })} /></div>
  </fieldset>;

  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Hedefler</DialogTitle>
        <DialogDescription>100 üzerinden hedef puan ve isteğe bağlı tarih. Boş bıraktığınız alanda hedef gösterilmez. Hedef dönemden bağımsızdır; sonraki dönemlerde de geçerlidir.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={event => {
        event.preventDefault();
        onSave({
          overall: toTarget(overall),
          categories: view.categories.flatMap(category => {
            const target = toTarget(categories[category.id] ?? { percentage: "", targetDate: "" });
            return target ? [{ categoryId: category.id, ...target }] : [];
          }),
        });
      }}>
        <div className={columns + " t-label text-[var(--ink-2)]"} aria-hidden="true"><span>Kapsam</span><span>Hedef puan</span><span>Tarih</span></div>
        {field("overall", "Genel puan", overall, setOverall)}
        <div className="space-y-3 border-t border-[var(--line)] pt-4">
          {view.categories.map(category => field(category.id, category.name, categories[category.id] ?? { percentage: "", targetDate: "" },
            row => setCategories(current => ({ ...current, [category.id]: row }))))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Vazgeç</Button>
          <Button type="submit" loading={saving}>Kaydet</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
