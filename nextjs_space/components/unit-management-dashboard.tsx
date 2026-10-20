"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AppShell from "./ui/app-shell";
import PageHeader from "./ui/page-header";
import EmptyState from "./ui/empty-state";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { UnitDashboardLoading } from "./unit-manager-dashboard";
import { UnitManagementPanels } from "./unit-management-panels";
import type { MemberHref } from "./unit-management-shared";
import { unitDashboardHref, unitDate } from "@/lib/unit-dashboard-display";
import type { UnitManagementResult } from "@/lib/unit-management";

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
  const [data, setData] = useState<UnitManagementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
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
  // Karşılaştırılacak üyesi olmayan birim seçildiyse o birimin kendi panosu açılır.
  useEffect(() => {
    if (data?.kind === "member") router.replace(unitDashboardHref(role, { unitId: data.unitId, surveyId: params.get("surveyId") }));
  }, [data, role, router, params]);

  const memberHref: MemberHref = useCallback((row, tab) => unitDashboardHref(role, {
    unitId: row.unitId, surveyId: row.surveyId ?? (data?.kind === "group" ? data.selection.surveyId : null), assessmentId: row.assessmentId, tab: tab && tab !== "results" ? tab : null,
  }), [role, data]);
  const group = data?.kind === "group" ? data : null;
  const select = (key: "unitId" | "surveyId" | "periodId", value: string) => {
    if (!group) return;
    const next = new URLSearchParams({ unitId: group.selection.unitId });
    if (key !== "unitId" && group.selection.surveyId) next.set("surveyId", group.selection.surveyId);
    if (key === "periodId" && group.selection.periodId) next.set("periodId", group.selection.periodId);
    next.set(key, value);
    setLoading(true);
    startNavigation(() => router.replace(pathname + "?" + next.toString(), { scroll: false }));
  };
  const openProfile = () => {
    if (!group) return;
    const first = group.options.members[0];
    setProfileUnitId(first?.id ?? ""); setEmployeeCount(first?.employeeCount?.toString() ?? ""); setProfileOpen(true);
  };
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = employeeCount.trim() === "" ? null : Number(employeeCount);
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 2147483647)) { toast.error("Çalışan sayısı negatif olmayan bir tam sayı olmalı."); return; }
    setSaving(true);
    try {
      await read(await fetch("/api/unit-manager/management", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: profileUnitId, employeeCount: value }) }));
      setProfileOpen(false); setRevision(value => value + 1); toast.success("Çalışan sayısı güncellendi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Çalışan sayısı kaydedilemedi."); }
    finally { setSaving(false); }
  };
  const remind = async () => {
    if (!group?.selection.campaignId) return;
    setReminding(true);
    try {
      const result = await read(await fetch("/api/organization/campaigns/" + encodeURIComponent(group.selection.campaignId) + "/remind", { method: "POST" }));
      toast.success(result.message ?? "Hatırlatma gönderildi.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Hatırlatma gönderilemedi."); }
    finally { setReminding(false); }
  };
  const exportReport = async (format: "xlsx" | "pdf") => {
    if (!group) return;
    setExporting(format);
    try {
      const query = new URLSearchParams({ unitId: group.selection.unitId, format: format === "pdf" ? "html" : "xlsx" });
      if (group.selection.surveyId) query.set("surveyId", group.selection.surveyId);
      if (group.selection.periodId) query.set("periodId", group.selection.periodId);
      let response = await fetch("/api/unit-manager/management/export?" + query);
      if (!response.ok) throw new Error((await response.json()).error ?? "Rapor hazırlanamadı.");
      if (format === "pdf") response = await fetch("/api/html2pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: await response.text(), filename: "birim-yonetimi-raporu.pdf" }) });
      if (!response.ok) throw new Error("PDF hazırlanamadı.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "birim-yonetimi-raporu." + format; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rapor hazırlanamadı."); }
    finally { setExporting(null); }
  };
  if (status !== "authenticated" || role !== "ADMIN" && role !== "UNIT_MANAGER" || !data && loading || data?.kind === "member") return <UnitDashboardLoading />;
  const s = group?.selection;
  const busy = loading || navigating;
  return <><AppShell /><main id="icerik" tabIndex={-1}>
    <PageHeader title="Birim yönetimi" subtitle="Üyelerin sonuçlarını, katılımı ve öneri uygulamasını karşılaştırın." actions={group && <>
      <Button variant="ghost" aria-label="Verileri yenile" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Yenile</Button>
      <Button variant="outline" disabled={busy || exporting !== null} loading={exporting === "pdf"} onClick={() => void exportReport("pdf")}><FileText size={16} aria-hidden="true" />PDF raporu</Button>
      <Button variant="outline" disabled={busy || exporting !== null} loading={exporting === "xlsx"} onClick={() => void exportReport("xlsx")}><Download size={16} aria-hidden="true" />Excel</Button>
    </>} />
    {error ? <EmptyState title="Birim yönetimi yüklenemedi" description={error} action={<Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button>} />
      : !group || !s ? <EmptyState title="Yönettiğiniz birim yok" description="Bir birime yönetici olarak atandığınızda üyelerin karşılaştırması burada açılır." /> : <>
      <div className="mb-4 grid gap-4 md:grid-cols-3" aria-busy={busy}>
        <Select id="management-unit" label="Birim" value={s.unitId} disabled={busy || group.options.groups.length < 2} onChange={value => select("unitId", value)}>{group.options.groups.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</Select>
        <Select id="management-survey" label="Anket" value={s.surveyId ?? ""} disabled={busy || !group.options.surveys.length} onChange={value => select("surveyId", value)}>{!group.options.surveys.length && <option value="">Atanmış anket yok</option>}{group.options.surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.name}</option>)}</Select>
        <Select id="management-period" label="Dönem" value={s.periodId ?? ""} disabled={busy || !group.options.periods.length} onChange={value => select("periodId", value)}>{!group.options.periods.length && <option value="">Dönem yok</option>}{group.options.periods.map(period => <option key={period.id} value={period.id}>{period.name}</option>)}</Select>
      </div>
      <p className="mb-6 t-sm text-[var(--ink-2)]">{group.analytics.scope.memberCount} üye · {group.analytics.scope.activeUserCount} kayıtlı kullanıcı · son işlem {unitDate(group.analytics.scope.lastActivityAt)} · Sonuçlar yalnızca gönderilmiş değerlendirmelerden hesaplanır.</p>
      {group.hasAnonymousCampaigns && <p className="mb-5 t-sm text-[var(--ink-2)]">Anonim kampanyaların tekil sonuçları bu görünüme girmez; toplu sonuçları <Link href="/organization" className="underline">Üye sonuçları</Link> ekranındadır.</p>}
      {loading ? <div className="skeleton h-96" aria-label="Birim analizi yükleniyor" /> :
        <UnitManagementPanels key={[s.unitId, s.surveyId, s.periodId].join(":")} data={group} memberHref={memberHref} onEditProfile={openProfile} onRemind={s.campaignId ? () => void remind() : undefined} reminding={reminding} />}
      <Dialog open={profileOpen} onOpenChange={value => { if (!saving) setProfileOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Çalışan sayısını düzenle</DialogTitle><DialogDescription>Ölçeğe göre gruplama için üyenin gerçek çalışan sayısını girin. Bilinmiyorsa alanı boş bırakın.</DialogDescription></DialogHeader><form className="space-y-5" onSubmit={event => void saveProfile(event)}><Select id="profile-unit" label="Üye" value={profileUnitId} disabled={saving} onChange={value => { setProfileUnitId(value); setEmployeeCount(group.options.members.find(member => member.id === value)?.employeeCount?.toString() ?? ""); }}>{group.options.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</Select><div><label htmlFor="employee-count" className="t-label mb-1 block">Çalışan sayısı</label><input id="employee-count" type="number" min="0" max="2147483647" step="1" className="theme-input w-full" value={employeeCount} disabled={saving} onChange={event => setEmployeeCount(event.target.value)} /></div><div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={saving} onClick={() => setProfileOpen(false)}>Vazgeç</Button><Button type="submit" loading={saving}>Kaydet</Button></div></form></DialogContent></Dialog>
    </>}
  </main></>;
}
function Select({ id, label, value, disabled, onChange, children }: { id: string; label: string; value: string; disabled: boolean; onChange: (value: string) => void; children: React.ReactNode }) {
  return <div><label htmlFor={id} className="t-label mb-1 block">{label}</label><select id={id} className="theme-select w-full" value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>{children}</select></div>;
}
