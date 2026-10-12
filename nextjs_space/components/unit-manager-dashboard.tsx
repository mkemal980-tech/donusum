"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CategoryResults, TeamProgress, UnitHistory, UnitRecommendations, type RoadmapPatch } from "./unit-dashboard-panels";
import { UNIT_RESULT_LABELS, unitDate, unitScore } from "@/lib/unit-dashboard-display";
import type { UnitAssessmentDetail, UnitAssessmentRow, UnitDashboardIndex } from "@/lib/unit-dashboard";

const TABS = [
  { id: "results", label: "Kategori sonuçları" }, { id: "team", label: "Ekip ve görevler" },
  { id: "recommendations", label: "Birim önerileri" }, { id: "roadmap", label: "Yol haritası" },
  { id: "documents", label: "Yüklenen dosyalar" }, { id: "history", label: "Geçmiş ve dönemler" },
];
const ALL = "all";
type Document = { id: string; fileName: string; fileType: string; createdAt: string; downloadUrl: string | null; user: { firstName: string | null; lastName: string | null; email: string } };

export function UnitDashboardLoading() {
  return <><AppShell /><main id="icerik" tabIndex={-1} aria-busy="true"><span className="sr-only">Birim panosu yükleniyor</span><div className="skeleton mb-6 h-8 w-72" /><div className="skeleton h-64" /></main></>;
}

function preferred(rows: UnitAssessmentRow[]) {
  return rows.find(row => !row.locked && row.responseCount > 0) ?? rows.find(row => !row.locked) ?? rows[0];
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Veriler yüklenemedi. Tekrar deneyin.");
  return data;
}

export default function UnitManagerDashboard({ title = "Birim takibi" }: { title?: string }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [index, setIndex] = useState<UnitDashboardIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detail, setDetail] = useState<UnitAssessmentDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const role = (session?.user as { role?: string })?.role;
  const actorKey = (session?.user as { id?: string })?.id ?? session?.user?.email ?? "";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "authenticated" && role !== "ADMIN" && role !== "UNIT_MANAGER") router.replace("/dashboard");
  }, [status, role, router]);

  useEffect(() => {
    if (status !== "authenticated" || (role !== "ADMIN" && role !== "UNIT_MANAGER")) return;
    const abort = new AbortController();
    setIndexLoading(true);
    fetch("/api/unit-manager/team", { cache: "no-store", signal: abort.signal }).then(readJson).then(data => {
      if (!abort.signal.aborted) { setIndex(data); setIndexError(null); }
    }).catch(error => { if (!abort.signal.aborted) setIndexError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setIndexLoading(false); });
    return () => abort.abort();
  }, [status, role, revision]);

  const units = index?.units ?? [];
  const requestedId = searchParams.get("assessmentId") ?? searchParams.get("selection");
  const unitId = searchParams.get("unitId") ?? index?.assessments.find(row => row.id === requestedId)?.unitId ?? (units.length > 1 ? ALL : units[0]?.id ?? "");
  const isOverview = unitId === ALL;
  const unit = units.find(row => row.id === unitId);
  const unitRows = index?.assessments.filter(row => isOverview || row.unitId === unitId) ?? [];
  const selectedSurveyId = searchParams.get("surveyId") ?? (isOverview ? ALL : preferred(unitRows)?.surveyId ?? "");
  const surveyRows = unitRows.filter(row => selectedSurveyId === ALL || row.surveyId === selectedSurveyId);
  const selectedPeriodId = searchParams.get("periodId") ?? ALL;
  const overviewRows = surveyRows.filter(row => selectedPeriodId === ALL || row.periodId === selectedPeriodId);
  const selected = isOverview ? undefined : requestedId ? surveyRows.find(row => row.id === requestedId) : preferred(surveyRows);
  const assessmentId = selected?.assessmentId ?? null;
  const activeTab = TABS.some(tab => tab.id === searchParams.get("tab")) ? searchParams.get("tab")! : "results";
  const current = detail?.assessment.id === assessmentId ? detail : null;
  const context = { unitId, surveyId: selectedSurveyId === ALL ? "" : selectedSurveyId, periodId: isOverview && selectedPeriodId !== ALL ? selectedPeriodId : undefined, assessmentId, selection: assessmentId ? null : selected?.id ?? null, tab: activeTab };
  const contextParams = new URLSearchParams();
  if (unitId) contextParams.set("unitId", unitId);
  if (context.surveyId) contextParams.set("surveyId", context.surveyId);
  if (context.periodId) contextParams.set("periodId", context.periodId);
  if (assessmentId) contextParams.set("assessmentId", assessmentId);
  else if (selected) contextParams.set("selection", selected.id);
  if (activeTab !== "results") contextParams.set("tab", activeTab);
  const contextQuery = contextParams.toString();

  useEffect(() => {
    if (actorKey && contextQuery && (selected || isOverview)) window.sessionStorage.setItem("unit-dashboard:" + actorKey, contextQuery);
  }, [actorKey, contextQuery, selected, isOverview]);

  // Seçim açık URL ile taşınır; kullanıcı panoya boş URL ile dönerse son seçimi geri alınır.
  useEffect(() => {
    if (!actorKey || searchParams.has("unitId") || searchParams.has("assessmentId") || searchParams.has("selection")) return;
    const saved = window.sessionStorage.getItem("unit-dashboard:" + actorKey);
    if (saved) {
      const params = new URLSearchParams(saved);
      if (searchParams.has("tab")) params.set("tab", searchParams.get("tab")!);
      router.replace(pathname + "?" + params.toString(), { scroll: false });
    }
  }, [actorKey, pathname, router, searchParams]);

  const navigate = useCallback((row: UnitAssessmentRow | undefined, nextUnitId?: string, tab?: string) => {
    const params = new URLSearchParams();
    const chosenUnit = row?.unitId ?? nextUnitId ?? unitId;
    if (chosenUnit) params.set("unitId", chosenUnit);
    if (row) {
      params.set("surveyId", row.surveyId);
      params.set(row.assessmentId ? "assessmentId" : "selection", row.id);
    }
    const nextTab = tab ?? activeTab;
    if (nextTab !== "results") params.set("tab", nextTab);
    startNavigation(() => router.replace(pathname + "?" + params.toString(), { scroll: false }));
  }, [unitId, activeTab, pathname, router, startNavigation]);

  const showOverview = (surveyId = ALL, periodId = ALL) => {
    const params = new URLSearchParams({ unitId: ALL });
    if (surveyId !== ALL) params.set("surveyId", surveyId);
    if (periodId !== ALL) params.set("periodId", periodId);
    startNavigation(() => router.replace(pathname + "?" + params.toString(), { scroll: false }));
  };

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    if (!assessmentId) { setDetailLoading(false); return; }
    const abort = new AbortController();
    setDetailLoading(true);
    fetch("/api/unit-manager/dashboard?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
      .then(readJson).then(data => { if (!abort.signal.aborted) setDetail(data); })
      .catch(error => { if (!abort.signal.aborted) setDetailError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [assessmentId, revision]);

  useEffect(() => {
    setDocuments([]);
    setDocumentsError(null);
    if (activeTab !== "documents" || !assessmentId) return;
    const abort = new AbortController();
    setDocumentsLoading(true);
    fetch("/api/unit-manager/documents?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
      .then(readJson).then(data => { if (!abort.signal.aborted) setDocuments(data); })
      .catch(error => { if (!abort.signal.aborted) setDocumentsError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setDocumentsLoading(false); });
    return () => abort.abort();
  }, [assessmentId, activeTab, revision]);

  const start = async () => {
    if (!selected) return;
    setStarting(true);
    try {
      const response = await fetch("/api/unit-manager/dashboard", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId: selected.unitId, surveyId: selected.surveyId, campaignRecipientId: selected.campaignRecipientId }) });
      const data = await readJson(response);
      const params = new URLSearchParams({ unitId: selected.unitId, surveyId: selected.surveyId, assessmentId: data.assessmentId });
      router.replace(pathname + "?" + params.toString(), { scroll: false });
      setRevision(value => value + 1);
      toast.success("Birim değerlendirmesi hazır.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Değerlendirme başlatılamadı."); }
    finally { setStarting(false); }
  };

  const saveRoadmap = async (patch: RoadmapPatch) => {
    if (!assessmentId) return;
    setBusyId(patch.recommendationId);
    try {
      const result = await readJson(await fetch("/api/unit-manager/roadmap", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, assessmentId }) }));
      toast.success(result.earned > 0 ? "Öneri tamamlandı · puan +" + result.earned.toLocaleString("tr-TR") : "Yol haritası kaydedildi.");
      setRevision(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Yol haritası kaydedilemedi."); }
    finally { setBusyId(null); }
  };

  const exportReport = async (format: "pdf" | "xlsx") => {
    if (!assessmentId) return;
    setExporting(format);
    try {
      const report = await fetch("/api/unit-manager/export?assessmentId=" + encodeURIComponent(assessmentId) + "&format=" + (format === "pdf" ? "html" : "xlsx"));
      if (!report.ok) await readJson(report);
      let blob: Blob;
      if (format === "pdf") {
        const html = await report.text();
        const response = await fetch("/api/html2pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html }) });
        if (!response.ok) await readJson(response);
        blob = await response.blob();
      } else blob = await report.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "birim-raporu-" + assessmentId + "." + format;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rapor hazırlanamadı."); }
    finally { setExporting(null); }
  };

  if (status !== "authenticated" || (!index && indexLoading)) return <UnitDashboardLoading />;
  const surveys = [...new Map(unitRows.map(row => [row.surveyId, { id: row.surveyId, name: row.surveyName }])).values()];
  const periods = [...new Map(surveyRows.map(row => [row.periodId, { id: row.periodId, name: row.periodName }])).values()];
  const filteredRows = (isOverview ? overviewRows : unitRows).filter(row => statusFilter === "ALL" || (statusFilter === "OVERDUE" ? row.overdue : row.status === statusFilter));
  const startedCount = overviewRows.filter(row => row.assessmentId).length;
  const submittedCount = overviewRows.filter(row => row.status === "SUBMITTED").length;
  const assessedUnitCount = new Set(overviewRows.map(row => row.unitId)).size;
  const taskHref = assessmentId ? "/unit-manager/assignments?assessmentId=" + encodeURIComponent(assessmentId) + "&surveyId=" + encodeURIComponent(selectedSurveyId) + "&unitId=" + encodeURIComponent(unitId) : null;

  return (
    <>
      <AppShell unitContext={context} />
      <main id="icerik" tabIndex={-1}>
        <PageHeader title={title} subtitle="Birim sonuçlarını inceleyin, eksikleri ve sonraki adımları takip edin."
          actions={<>
            {units.length > 1 && !isOverview && <Button variant="outline" onClick={() => showOverview()}>Tüm birimler</Button>}
            <Button asChild variant="outline"><Link href={"/dashboard?view=assessment&" + contextQuery}>Kendi değerlendirmem</Link></Button>
            <Button variant="ghost" aria-label="Birim verilerini yenile" disabled={indexLoading || detailLoading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Yenile</Button>
          </>} />
        {indexError ? <EmptyState title="Veriler yüklenemedi" description={indexError} action={<Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button>} /> :
          !units.length ? <EmptyState title="Yönettiğiniz birim yok" description="Birime yönetici olarak atandığınızda o birimin değerlendirmeleri burada görünür." /> :
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3" aria-busy={navigating}>
              <div><label htmlFor="unit-select" className="t-label block mb-1">Birim</label><select id="unit-select" className="theme-select w-full" value={unitId} disabled={navigating}
                onChange={event => event.target.value === ALL ? showOverview() : navigate(preferred(index?.assessments.filter(row => row.unitId === event.target.value) ?? []), event.target.value)}>
                {(units.length > 1 || isOverview) && <option value={ALL}>Tüm yönetilen birimler</option>}
                {units.map(row => <option key={row.id} value={row.id}>{row.name}{row.assessmentCount ? " · " + row.assessmentCount + " değerlendirme" : " · Değerlendirme yok"}</option>)}
              </select></div>
              <div><label htmlFor="unit-survey-select" className="t-label block mb-1">Anket</label><select id="unit-survey-select" className="theme-select w-full" value={selectedSurveyId} disabled={navigating || !surveys.length}
                onChange={event => isOverview ? showOverview(event.target.value) : navigate(preferred(unitRows.filter(row => row.surveyId === event.target.value)))}>
                {isOverview && <option value={ALL}>Tüm anketler</option>}
                {!surveys.length && <option value="">Atanmış anket yok</option>}
                {surveys.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select></div>
              <div><label htmlFor="unit-period-select" className="t-label block mb-1">Dönem</label><select id="unit-period-select" className="theme-select w-full" value={isOverview ? selectedPeriodId : selected?.id ?? ""} disabled={navigating || !surveyRows.length}
                onChange={event => isOverview ? showOverview(selectedSurveyId, event.target.value) : navigate(surveyRows.find(row => row.id === event.target.value))}>
                {isOverview && <option value={ALL}>Tüm dönemler</option>}
                {!surveyRows.length && <option value="">Dönem yok</option>}
                {isOverview ? periods.map(row => <option key={row.id} value={row.id}>{row.name}</option>) : surveyRows.map(row => <option key={row.id} value={row.id}>{row.periodName} · {UNIT_RESULT_LABELS[row.status]}</option>)}
              </select></div>
            </div>
            {index?.hasAnonymousCampaigns && <p className="mb-4 t-sm text-[var(--ink-2)]">Anonim kampanyaların toplu sonuçları <Link href="/organization" className="underline">Üye sonuçları</Link> ekranında gösterilir.</p>}
            {(!unit && !isOverview) || (requestedId && !selected && !indexLoading) ? <EmptyState title="Bu değerlendirmeye erişilemiyor" description="Seçili birim, anket veya dönem yönetim kapsamınızda olmayabilir." action={<Button onClick={() => units.length > 1 ? showOverview() : navigate(preferred(unitRows))}>Birim seçimine dön</Button>} /> :
              indexLoading && requestedId && !selected ? <div className="skeleton h-64" /> : isOverview ? <section aria-label="Yönetim kapsamı özeti">
                <h2 className="t-subhead mb-2">Tüm yönetilen birimler</h2>
                <p className="t-sm mb-5 text-[var(--ink-2)]">Yönettiğiniz birimler ve alt birimlerin değerlendirmeleri birlikte listelenir. Bir satırı açarak sonuçları, görevleri ve yol haritasını inceleyebilirsiniz.</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Yönetilen birim" value={units.length} note="Alt birimler dahil" />
                  <StatCard label="Anketi bulunan birim" value={assessedUnitCount} note="Seçili anket ve dönemde" />
                  <StatCard label="Başlanan değerlendirme" value={startedCount} note={submittedCount + " gönderilmiş · " + (startedCount - submittedCount) + " taslak"} />
                  <StatCard label="Başlanmamış anket" value={overviewRows.length - startedCount} note="Atanmış, henüz cevap girilmemiş" />
                </div>
                {!unitRows.length && <p className="mt-5 t-sm text-[var(--ink-2)]">Yönettiğiniz birimlerde henüz değerlendirme başlatılmadı ve aktif anket ataması yok.</p>}
              </section> : !selected ? <EmptyState title={unit!.name} description="Bu birimde henüz değerlendirme başlatılmadı ve aktif anket ataması yok." action={units.length > 1 && index!.assessments.length ? <Button variant="outline" onClick={() => showOverview()}>Diğer birimlerin değerlendirmelerini göster</Button> : <Button asChild variant="outline"><Link href="/admin/surveys">Anketleri incele</Link></Button>} /> :
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div><h2 className="t-subhead">{selected.unitName}</h2><p className="t-sm text-[var(--ink-2)]">{selected.surveyName} · {selected.periodName}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"badge " + (selected.status === "SUBMITTED" ? "badge-success" : selected.overdue ? "badge-warning" : "badge-neutral")}>{UNIT_RESULT_LABELS[selected.status]}</span>
                    {selected.deadline && <span className="t-sm text-[var(--ink-2)]">{selected.deadlineLabel}: {unitDate(selected.deadline)}{selected.overdue ? " · Süre geçti" : ""}</span>}
                    {taskHref && <Button asChild><Link href={taskHref}><ListChecks size={16} aria-hidden="true" />{current?.assessment.locked ? "Görevleri görüntüle" : "Görev dağılımı"}</Link></Button>}
                    <Button variant="outline" disabled={!current || exporting !== null} loading={exporting === "pdf"} onClick={() => void exportReport("pdf")}><FileText size={16} aria-hidden="true" />PDF raporu</Button>
                    <Button variant="outline" disabled={!current || exporting !== null} loading={exporting === "xlsx"} onClick={() => void exportReport("xlsx")}><Download size={16} aria-hidden="true" />Excel</Button>
                  </div>
                </div>
                {!assessmentId ? <EmptyState title="Anket birime atanmış, henüz başlanmamış" description="Birim değerlendirmesini başlatarak bölümleri ekibe dağıtabilirsiniz." action={<Button loading={starting} onClick={() => void start()}>Değerlendirmeyi başlat</Button>} /> :
                  detailError ? <EmptyState title="Sonuçlar yüklenemedi" description={detailError} action={<Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button>} /> :
                  !current || detailLoading ? <div className="skeleton h-64" aria-label="Sonuçlar yükleniyor" /> :
                  <>
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="Mevcut puan" value={current.answeredQuestions ? unitScore(current.scores.overallScore) + "/5" : "—"} note={current.answeredQuestions ? "%" + current.scores.overallPercentage + " · taban " + unitScore(current.scores.baselineOverallScore) + " · gelişim +" + current.scores.delta.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "Henüz cevap yok"} />
                      <StatCard label="Tamamlanma" value={"%" + current.completionPercentage} note={current.answeredQuestions + "/" + current.totalQuestions + " soru · " + (current.assessment.status === "SUBMITTED" ? "gönderilmiş" : "taslak değerlendirme")} />
                      <StatCard label="Bekleyen bölüm" value={current.summary.incompleteCount} note={current.summary.unassignedCount + " atanmamış · " + current.summary.missingEvidenceCount + " belge eksik"} />
                      <StatCard label="Yol haritası" value={current.summary.activeRoadmapCount + " açık iş"} note={current.summary.completedRoadmapCount + " tamamlandı · " + current.summary.overdueRoadmapCount + " hedef tarihi geçti"} />
                    </div>
                    <section className="theme-card mb-6 p-5" aria-label="Bekleyen işler">
                      <div className="mb-3 flex flex-wrap justify-between gap-3"><h2 className="t-subhead">Bekleyen işler</h2><Button asChild variant="link"><Link href={taskHref!}>{current.assessment.locked ? "Görevleri görüntüle" : "Görevleri aç"}</Link></Button></div>
                      {current.assessment.locked && <p className="mb-3 t-sm text-[var(--ink-2)]">Cevaplar ve görev dağılımı kilitli. Eksiklerle gönderilmiş bir değerlendirmeyi düzeltmek için önce gönderimi geri alın.</p>}
                      {current.work.length ? <ul className="divide-y divide-[var(--line)]">{current.work.slice(0, 5).map((item, i) => <li key={item.kind + ":" + item.sectionId + ":" + i} className="flex flex-wrap justify-between gap-2 py-3 t-sm"><span>{item.title}</span><span className="text-[var(--ink-2)]">{item.assigneeName} · {item.count} {item.kind === "EVIDENCE" ? "belge" : "soru"}</span></li>)}</ul> : <p className="t-sm text-[var(--ink-2)]">{current.assessment.status === "READY_TO_SUBMIT" ? "Bütün sorular tamamlandı. Görev dağılımından değerlendirmeyi gönderebilirsiniz." : "Eksik cevap veya belge yok."}</p>}
                      {current.summary.overdueRoadmapCount > 0 && <Button variant="link" onClick={() => navigate(selected, undefined, "roadmap")}>{current.summary.overdueRoadmapCount} geciken yol haritası işini incele</Button>}
                    </section>
                    <div className="theme-tabs mb-6 overflow-x-auto" role="tablist" aria-label="Birim görünümü">
                      {TABS.map(tab => <button type="button" key={tab.id} id={"tab-" + tab.id} role="tab" aria-selected={activeTab === tab.id} aria-controls="unit-panel" tabIndex={activeTab === tab.id ? 0 : -1} className={"theme-tab whitespace-nowrap " + (activeTab === tab.id ? "active" : "")} onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const index = TABS.findIndex(item => item.id === tab.id);
                        const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
                        navigate(selected, undefined, TABS[next].id);
                        document.getElementById("tab-" + TABS[next].id)?.focus();
                      }} onClick={() => navigate(selected, undefined, tab.id)}>{tab.label}</button>)}
                    </div>
                    <div id="unit-panel" role="tabpanel" aria-labelledby={"tab-" + activeTab}>
                      {activeTab === "results" && <><CategoryResults data={current} /><div className="mt-6 mb-3 flex justify-between gap-3"><h2 className="t-subhead">Öncelikli adımlar</h2><Button variant="link" onClick={() => navigate(selected, undefined, "recommendations")}>Tüm birim önerileri</Button></div><UnitRecommendations data={current} limit={3} busyId={busyId} save={saveRoadmap} /></>}
                      {activeTab === "team" && <TeamProgress data={current} />}
                      {activeTab === "recommendations" && <UnitRecommendations data={current} busyId={busyId} save={saveRoadmap} />}
                      {activeTab === "roadmap" && <UnitRecommendations data={current} roadmapOnly busyId={busyId} save={saveRoadmap} />}
                      {activeTab === "history" && <UnitHistory data={current} />}
                      {activeTab === "documents" && (documentsLoading ? <div className="skeleton h-48" /> : documentsError ? <EmptyState title="Belgeler yüklenemedi" description={documentsError} /> :
                        !documents.length ? <EmptyState title="Yüklenmiş dosya yok" description="Seçili değerlendirmeye bağlı belgeler burada listelenir." /> :
                        <div className="theme-card p-0 overflow-x-auto"><table className="theme-table"><thead><tr><th>Belge</th><th>Yükleyen</th><th>Tarih</th><th>İndir</th></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td>{doc.fileName}</td><td>{[doc.user.firstName, doc.user.lastName].filter(Boolean).join(" ") || doc.user.email}</td><td>{unitDate(doc.createdAt)}</td><td>{doc.downloadUrl && <Button asChild variant="link"><a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">İndir</a></Button>}</td></tr>)}</tbody></table></div>)}
                    </div>
                  </>}
              </>}
            <section className="mt-8" aria-label="Birim değerlendirmeleri">
              <div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="t-subhead">Birim değerlendirmeleri</h2><div><label htmlFor="assessment-status" className="sr-only">Değerlendirme durumuna göre filtrele</label><select id="assessment-status" className="theme-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">Bütün durumlar</option>{Object.entries(UNIT_RESULT_LABELS).filter(([key]) => key !== "AWAITING_SUBMISSION").map(([key, text]) => <option key={key} value={key}>{text}</option>)}<option value="OVERDUE">Süresi geçenler</option></select></div></div>
              <div className="theme-card p-0 overflow-x-auto"><table className="theme-table"><thead><tr><th>Birim</th><th>Değerlendirme</th><th>Dönem</th><th>Durum</th><th>Tamamlanma</th><th>Puan</th><th>İşlem</th></tr></thead><tbody>
                {filteredRows.map(row => <tr key={row.id}><td>{row.unitName}</td><td>{row.surveyName}</td><td>{row.periodName}</td><td>{UNIT_RESULT_LABELS[row.status]}{row.overdue ? " · Süre geçti" : ""}</td><td className="tabular">{row.assessmentId ? row.responseCount + "/" + row.totalQuestions + " · %" + row.completionPercentage : "Henüz başlamadı"}</td><td className="tabular">{row.score == null ? "—" : "%" + row.score + " · " + unitScore(row.maturityScore) + "/5"}</td><td><Button variant="link" onClick={() => navigate(row, undefined, "results")}>{row.assessmentId ? "Sonucu görüntüle" : "Değerlendirmeyi aç"}</Button>{row.assessmentId && <Button asChild variant="link"><Link href={"/unit-manager/assignments?assessmentId=" + encodeURIComponent(row.assessmentId) + "&surveyId=" + encodeURIComponent(row.surveyId) + "&unitId=" + encodeURIComponent(row.unitId)}>Görevleri aç</Link></Button>}</td></tr>)}
                {!filteredRows.length && <tr><td colSpan={7}>Bu filtreye uygun değerlendirme yok.</td></tr>}
              </tbody></table></div>
            </section>
          </>}
      </main>
    </>
  );
}
