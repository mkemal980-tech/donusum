"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Download, FileText, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import AppShell from "./ui/app-shell";
import PageHeader from "./ui/page-header";
import EmptyState from "./ui/empty-state";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { UnitDashboardLoading } from "./unit-manager-dashboard";
import { UnitManagementPanels } from "./unit-management-panels";
import { unitDate } from "@/lib/unit-dashboard-display";
import type { UnitManagementDashboard } from "@/lib/unit-management";

async function read(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Veriler yüklenemedi.");
  return body;
}
export default function UnitManagementDashboard() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const [navigating, startNavigation] = useTransition();
  const [data, setData] = useState<UnitManagementDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUnitId, setProfileUnitId] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && role !== "ADMIN" && role !== "UNIT_MANAGER") router.replace("/dashboard");
  }, [status, role, router]);
  useEffect(() => {
    if (status !== "authenticated" || (role !== "ADMIN" && role !== "UNIT_MANAGER")) return;
    const abort = new AbortController();
    setLoading(true); setError(null);
    fetch("/api/unit-manager/management?" + query, { cache: "no-store", signal: abort.signal }).then(read).then(value => {
      if (!abort.signal.aborted) setData(value);
    }).catch(reason => { if (!abort.signal.aborted) setError(reason.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [status, role, query, revision]);

  const select = (key: string, value: string) => {
    if (!data) return;
    const next = new URLSearchParams({ unitId: data.selection.unitId, basis: data.selection.basis, includeDescendants: String(data.selection.includeDescendants) });
    if (data.selection.surveyId) next.set("surveyId", data.selection.surveyId);
    if (data.selection.periodId) next.set("periodId", data.selection.periodId);
    if (key === "unitId" || key === "includeDescendants") { next.delete("surveyId"); next.delete("periodId"); }
    if (key === "surveyId") next.delete("periodId");
    next.set(key, value);
    setLoading(true);
    startNavigation(() => router.replace(pathname + "?" + next.toString(), { scroll: false }));
  };
  const openProfile = () => {
    if (!data) return;
    const unit = data.options.units.find(unit => unit.id === data.selection.unitId) ?? data.options.units[0];
    setProfileUnitId(unit?.id ?? ""); setEmployeeCount(unit?.employeeCount?.toString() ?? ""); setProfileOpen(true);
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = employeeCount.trim() === "" ? null : Number(employeeCount);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 2147483647)) { toast.error("Çalışan sayısı negatif olmayan bir tam sayı olmalı."); return; }
    setSaving(true);
    try {
      await read(await fetch("/api/unit-manager/management", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: profileUnitId, employeeCount: value }) }));
      setProfileOpen(false); setRevision(value => value + 1); toast.success("Kuruluş profili güncellendi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Profil kaydedilemedi."); }
    finally { setSaving(false); }
  };
  const exportReport = async (format: "xlsx" | "pdf") => {
    if (!data) return;
    setExporting(format);
    try {
      const query = new URLSearchParams({ unitId: data.selection.unitId, basis: data.selection.basis, includeDescendants: String(data.selection.includeDescendants), format: format === "pdf" ? "html" : "xlsx" });
      if (data.selection.surveyId) query.set("surveyId", data.selection.surveyId);
      if (data.selection.periodId) query.set("periodId", data.selection.periodId);
      let response = await fetch("/api/unit-manager/management/export?" + query);
      if (!response.ok) throw new Error((await response.json()).error ?? "Rapor hazırlanamadı.");
      if (format === "pdf") response = await fetch("/api/html2pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: await response.text(), filename: "birim-yonetici-raporu.pdf" }) });
      if (!response.ok) throw new Error("PDF hazırlanamadı.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "birim-yonetici-raporu." + format; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rapor hazırlanamadı."); }
    finally { setExporting(null); }
  };
  if (status !== "authenticated" || role !== "ADMIN" && role !== "UNIT_MANAGER" || !data && loading) return <UnitDashboardLoading />;
  const s = data?.selection;
  const busy = loading || navigating;
  return <><AppShell /><main id="icerik" tabIndex={-1}>
    <PageHeader title="Birim yönetici alanı" subtitle="Katılımı, olgunluk sonuçlarını ve birimlerin dönüşüm adımlarını birlikte takip edin." actions={<>
      <Button asChild variant="outline"><Link href={"/dashboard?unitId=" + (data && data.analytics.scope.unitCount === 1 ? s!.unitId : "all")}>Birim panosu</Link></Button>
      <Button variant="ghost" aria-label="Yönetici verilerini yenile" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Yenile</Button>
    </>} />
    {error ? <EmptyState title="Yönetici alanı yüklenemedi" description={error} action={<div className="flex gap-3"><Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button><Button asChild variant="outline"><Link href="/unit-manager/management">Birim seçimine dön</Link></Button></div>} /> : !data?.options.units.length ? <EmptyState title="Yönettiğiniz birim yok" description="Birime yönetici olarak atandığınızda yönetici alanı burada açılır." /> : data && s && <>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy={busy}>
        <Select id="management-unit" label="Birim" value={s.unitId} disabled={busy} onChange={value => select("unitId", value)}><option value="all">Tüm yönetilen birimler</option>{data.options.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select>
        <Select id="management-survey" label="Anket" value={s.surveyId ?? ""} disabled={busy || !data.options.surveys.length} onChange={value => select("surveyId", value)}>{!data.options.surveys.length && <option value="">Atanmış anket yok</option>}{data.options.surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</Select>
        <Select id="management-period" label="Dönem" value={s.periodId ?? ""} disabled={busy || !data.options.periods.length} onChange={value => select("periodId", value)}>{!data.options.periods.length && <option value="">Dönem yok</option>}{data.options.periods.map(period => <option key={period.id} value={period.id}>{period.name}</option>)}</Select>
        <Select id="management-basis" label="Sonuç kapsamı" value={s.basis} disabled={busy} onChange={value => select("basis", value)}><option value="answered">Cevap girilenler (taslak dahil)</option><option value="submitted">Yalnızca gönderilenler</option></Select>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><label className="flex min-h-[40px] items-center gap-2 t-sm"><input key={s.unitId + ":" + s.includeDescendants} type="checkbox" defaultChecked={s.includeDescendants} disabled={busy || s.unitId === "all"} onChange={event => select("includeDescendants", String(event.target.checked))} />Alt birimler dahil</label><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={openProfile}><Users size={16} aria-hidden="true" />Kuruluş profili</Button><Button variant="outline" disabled={busy || exporting !== null} loading={exporting === "pdf"} onClick={() => void exportReport("pdf")}><FileText size={16} aria-hidden="true" />PDF raporu</Button><Button variant="outline" disabled={busy || exporting !== null} loading={exporting === "xlsx"} onClick={() => void exportReport("xlsx")}><Download size={16} aria-hidden="true" />Excel</Button></div></div>
      <section className="theme-card mb-6 p-6" aria-label="Seçili birim bilgisi"><div className="flex flex-wrap justify-between gap-5"><div className="flex gap-4"><Building2 size={24} aria-hidden="true" className="mt-1 text-[var(--accent)]" /><div><div className="flex flex-wrap items-center gap-2"><h2 className="t-subhead">{s.unitName}</h2><span className="badge badge-neutral">{s.basis === "answered" ? "Taslaklar dahil" : "Gönderilmiş sonuçlar"}</span></div><p className="mt-1 t-sm text-[var(--ink-2)]">{s.surveyName ?? "Atanmış anket yok"}{s.periodName ? " · " + s.periodName : ""}</p><p className="mt-2 t-caption text-[var(--ink-3)]">{data.analytics.scope.unitCount} birim · {data.analytics.scope.activeUserCount} kayıtlı kullanıcı · Son işlem {unitDate(data.analytics.scope.lastActivityAt)}</p></div></div></div></section>
      {data.hasAnonymousCampaigns && <p className="mb-5 t-sm text-[var(--ink-2)]">Anonim kampanyaların toplu sonuçları <Link href="/organization" className="underline">Üye sonuçları</Link> alanındadır; bu görünümde tekil sonuçları açılmaz.</p>}
      {loading ? <div className="skeleton h-96" aria-label="Birim analizi yükleniyor" /> : <UnitManagementPanels key={[s.unitId, s.surveyId, s.periodId, s.basis].join(":")} data={data} />}
      <Dialog open={profileOpen} onOpenChange={value => { if (!saving) setProfileOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Kuruluş profili</DialogTitle><DialogDescription>Şirket ölçeği karşılaştırması için gerçek çalışan sayısını girin. Bilinmiyorsa alanı boş bırakın.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={event => void saveProfile(event)}><Select id="profile-unit" label="Profili düzenlenecek birim" value={profileUnitId} disabled={saving} onChange={value => { setProfileUnitId(value); setEmployeeCount(data.options.units.find(unit => unit.id === value)?.employeeCount?.toString() ?? ""); }}>{data.options.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select><div><label htmlFor="employee-count" className="t-label mb-1 block">Çalışan sayısı</label><input id="employee-count" type="number" min="0" max="2147483647" step="1" className="theme-input w-full" value={employeeCount} disabled={saving} onChange={event => setEmployeeCount(event.target.value)} /></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={saving} onClick={() => setProfileOpen(false)}>Vazgeç</Button><Button type="submit" loading={saving}>Profili kaydet</Button></div></form></DialogContent></Dialog>
    </>}
  </main></>;
}
function Select({ id, label, value, disabled, onChange, children }: { id: string; label: string; value: string; disabled: boolean; onChange: (value: string) => void; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="t-label mb-1 block">{label}</label><select id={id} className="theme-select w-full" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select></div>;
}
