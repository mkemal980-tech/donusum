"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, ListChecks, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CategoryResults, TeamProgress, UnitHistory, UnitRecommendations, type RoadmapPatch } from "./unit-dashboard-panels";
import { AnswerStrip, CategoryAnalysis, CategoryTable, LowestQuestions, RoadmapSummary, ScoreTrend, UnitIronman } from "./assessment-results";
import { TargetsDialog } from "./assessment-targets";
import { SELF_UNIT_ID, UNIT_RESULT_LABELS, unitDate, unitScore } from "@/lib/unit-dashboard-display";
import { decimal } from "@/lib/unit-management-display";
import type { UnitAssessmentRow, UnitDashboardIndex } from "@/lib/unit-dashboard";
import type { AssessmentView, ViewerRole } from "@/lib/assessment-view";
import type { UnitGroupComparison } from "@/lib/unit-group-comparison";

const TABS = [
  { id: "results", label: "Sonuçlar" }, { id: "answers", label: "Cevaplar" }, { id: "team", label: "Ekip ve görevler" },
  { id: "recommendations", label: "Öneriler" }, { id: "roadmap", label: "Yol haritası" },
  { id: "documents", label: "Belgeler" }, { id: "history", label: "Geçmiş ve dönemler" },
];
const ALL = "all";
type Index = UnitDashboardIndex & { role: ViewerRole };
type Document = { id: string; fileName: string; fileType: string; createdAt: string; downloadUrl: string | null; user: { firstName: string | null; lastName: string | null; email: string } };

export function AssessmentDashboardLoading() {
  return <><AppShell /><main id="icerik" tabIndex={-1} aria-busy="true"><span className="sr-only">Pano yükleniyor</span><div className="skeleton mb-6 h-8 w-72" /><div className="skeleton h-64" /></main></>;
}

function preferred(rows: UnitAssessmentRow[]) {
  return rows.find(row => !row.locked && row.responseCount > 0) ?? rows.find(row => !row.locked) ?? rows[0];
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Veriler yüklenemedi. Tekrar deneyin.");
  return data;
}

function ComparisonNote({ data }: { data: UnitGroupComparison | null }) {
  if (!data) return null;
  if (data.available) return <p className="mt-3 t-sm text-[var(--ink-3)]">{data.groupName} ortalaması aynı anket ve dönemde gönderen {data.count} üyeden hesaplanır; diğer üyelerin tekil puanı gösterilmez. Yüzdelik dilim (ilk %{data.band.value}) en az %{data.band.width} genişliğindedir ve sırayı göstermez.</p>;
  if (data.reason === "NO_GROUP") return null;
  return <p className="mt-3 t-sm text-[var(--ink-3)]">{data.reason === "NOT_SUBMITTED"
    ? `${data.groupName} ortalamasıyla kıyas, değerlendirme gönderildiğinde görünür.`
    : `${data.groupName} ortalaması en az ${data.required} üye gönderdiğinde görünür; şu an ${data.count} üye gönderdi.`}</p>;
}

/**
 * Tek pano: bir değerlendirmenin sonucu, yönetici ve çalışan için aynı
 * sayılarla. Rol yalnızca neyin görüneceğini ve neyin yapılabileceğini
 * değiştirir; ayıklama ve yetki sunucudadır (lib/assessment-view).
 */
export default function AssessmentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [index, setIndex] = useState<Index | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssessmentView | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [comparison, setComparison] = useState<{ id: string; data: UnitGroupComparison | null } | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const actorKey = (session?.user as { id?: string })?.id ?? session?.user?.email ?? "";

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const abort = new AbortController();
    setIndexLoading(true);
    fetch("/api/dashboard/assessments", { cache: "no-store", signal: abort.signal }).then(readJson).then(data => {
      if (!abort.signal.aborted) { setIndex(data); setIndexError(null); }
    }).catch(error => { if (!abort.signal.aborted) setIndexError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setIndexLoading(false); });
    return () => abort.abort();
  }, [status, revision]);

  const isManager = index?.role === "manager";
  const isOwner = index?.role === "owner";
  const units = index?.units ?? [];
  // Kişisel değerlendirmeler "kişisel" sahte birimin altındadır; yönetim özeti ve karşılaştırma yalnızca gerçek birimleri sayar.
  const managedUnits = units.filter(row => row.id !== SELF_UNIT_ID);
  const requestedId = searchParams.get("assessmentId") ?? searchParams.get("selection");
  const unitId = searchParams.get("unitId") ?? index?.assessments.find(row => row.id === requestedId)?.unitId ?? (managedUnits.length > 1 ? ALL : managedUnits[0]?.id ?? units[0]?.id ?? "");
  const isOverview = unitId === ALL;
  const unit = units.find(row => row.id === unitId);
  const unitRows = index?.assessments.filter(row => isOverview ? row.unitId !== SELF_UNIT_ID : row.unitId === unitId) ?? [];
  const selectedSurveyId = searchParams.get("surveyId") ?? (isOverview ? ALL : preferred(unitRows)?.surveyId ?? "");
  const surveyRows = unitRows.filter(row => selectedSurveyId === ALL || row.surveyId === selectedSurveyId);
  const selectedPeriodId = searchParams.get("periodId") ?? ALL;
  const overviewRows = surveyRows.filter(row => selectedPeriodId === ALL || row.periodId === selectedPeriodId);
  // "Başlanmamış" satırın kimliği (pending:birim:anket:dönem) değerlendirme açılınca değişir; adreste
  // ya da oturumda kalan eski kimlik aynı birim, anket ve dönemin değerlendirmesini açar.
  const pendingKey = requestedId?.startsWith("pending:") ? requestedId.slice("pending:".length) : null;
  const selected = isOverview ? undefined : requestedId
    ? surveyRows.find(row => row.id === requestedId) ?? (pendingKey ? surveyRows.find(row => [row.unitId, row.surveyId, row.periodId].join(":") === pendingKey) : undefined)
    : preferred(surveyRows);
  const assessmentId = selected?.assessmentId ?? null;
  const personal = selected?.unitId === SELF_UNIT_ID;
  const activeTab = TABS.some(tab => tab.id === searchParams.get("tab")) ? searchParams.get("tab")! : "results";
  const current = detail?.assessment.id === assessmentId ? detail : null;
  const canManage = current?.viewer.canManageRoadmap ?? false;
  const groupComparison = comparison?.id === assessmentId ? comparison.data : null;
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
  const openTab = (tab: string) => navigate(selected, undefined, tab);

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
    fetch("/api/dashboard/assessment?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
      .then(readJson).then(data => { if (!abort.signal.aborted) setDetail(data); })
      .catch(error => { if (!abort.signal.aborted) setDetailError(error.message); })
      .finally(() => { if (!abort.signal.aborted) setDetailLoading(false); });
    return () => abort.abort();
  }, [assessmentId, revision]);

  // Birim ortalaması yalnızca toplu sayı döner; yüklenemezse pano kıyassız açılır.
  useEffect(() => {
    if (!assessmentId) return;
    const abort = new AbortController();
    fetch("/api/dashboard/assessment/group-comparison?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
      .then(readJson).then(data => { if (!abort.signal.aborted) setComparison({ id: assessmentId, data }); })
      .catch(() => { if (!abort.signal.aborted) setComparison({ id: assessmentId, data: null }); });
    return () => abort.abort();
  }, [assessmentId, revision]);

  useEffect(() => {
    setDocuments([]);
    setDocumentsError(null);
    if (activeTab !== "documents" || !assessmentId) return;
    const abort = new AbortController();
    setDocumentsLoading(true);
    fetch("/api/dashboard/assessment/documents?assessmentId=" + encodeURIComponent(assessmentId), { cache: "no-store", signal: abort.signal })
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
      const result = await readJson(await fetch("/api/dashboard/assessment/roadmap", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, assessmentId }) }));
      toast.success(result.earned > 0 ? "Öneri tamamlandı · +" + decimal(result.earned * 25) + " puan" : "Yol haritası kaydedildi.");
      setRevision(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Yol haritası kaydedilemedi."); }
    finally { setBusyId(null); }
  };

  /** Yapay zekâ planı açık olan değerlendirmeye yazılır; mevcut tarihler korunur. */
  const generatePlan = async () => {
    if (!assessmentId) return;
    setPlanning(true);
    try {
      const result = await readJson(await fetch("/api/roadmap/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId }) }));
      toast.success(`${result.addedCount} öneri yol haritasına eklendi, ${result.scheduledCount} iş zamanlandı.`);
      setRevision(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Yol haritası oluşturulamadı."); }
    finally { setPlanning(false); }
  };

  const saveTargets = async (targets: object) => {
    if (!assessmentId) return;
    setSavingTargets(true);
    try {
      await readJson(await fetch("/api/dashboard/assessment/targets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...targets, assessmentId }) }));
      setTargetsOpen(false);
      toast.success("Hedefler kaydedildi.");
      setRevision(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Hedef kaydedilemedi."); }
    finally { setSavingTargets(false); }
  };

  /** Kişisel değerlendirmenin gönderimi: sahibi koordinatördür. Birimde gönderim görev dağılımı ekranındadır. */
  const submitAssessment = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await readJson(await fetch("/api/assessment/submission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ surveyId: selected.surveyId, action: "submit" }) }));
      setConfirmingSubmit(false);
      toast.success("Değerlendirme gönderildi ve puan kesinleşti.");
      setRevision(value => value + 1);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Değerlendirme gönderilemedi."); }
    finally { setSubmitting(false); }
  };

  const exportReport = async (format: "pdf" | "xlsx") => {
    if (!assessmentId) return;
    setExporting(format);
    try {
      const report = await fetch("/api/dashboard/assessment/export?assessmentId=" + encodeURIComponent(assessmentId) + "&format=" + (format === "pdf" ? "html" : "xlsx"));
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
      anchor.download = "degerlendirme-raporu-" + assessmentId + "." + format;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Rapor hazırlanamadı."); }
    finally { setExporting(null); }
  };

  if (status !== "authenticated" || (!index && indexLoading)) return <AssessmentDashboardLoading />;
  // Kişisel değerlendirmede ekip yoktur; çalışan yalnızca kendi görevlerini görür.
  const tabs = TABS.filter(tab => tab.id !== "team" || current?.viewer.role !== "owner").map(tab => tab.id === "team" && !isManager ? { ...tab, label: "Görevlerim" } : tab);
  const surveys = [...new Map(unitRows.map(row => [row.surveyId, { id: row.surveyId, name: row.surveyName }])).values()];
  const periods = [...new Map(surveyRows.map(row => [row.periodId, { id: row.periodId, name: row.periodName }])).values()];
  const filteredRows = (isOverview ? overviewRows : unitRows).filter(row => statusFilter === "ALL" || (statusFilter === "OVERDUE" ? row.overdue : row.status === statusFilter));
  const startedCount = overviewRows.filter(row => row.assessmentId).length;
  const submittedCount = overviewRows.filter(row => row.status === "SUBMITTED").length;
  const assessedUnitCount = new Set(overviewRows.map(row => row.unitId)).size;
  const taskHref = isManager && assessmentId && !personal ? "/unit-manager/assignments?assessmentId=" + encodeURIComponent(assessmentId) + "&surveyId=" + encodeURIComponent(selectedSurveyId) + "&unitId=" + encodeURIComponent(unitId) : null;
  // Birim yönetimi bir birimi hemen altındaki üyelerle karşılaştırır: seçili birimin üyesi yoksa üst birimi açılır.
  const hasMembers = (id: string) => managedUnits.some(row => row.parentId === id);
  const canCompare = isManager && (managedUnits.some(row => hasMembers(row.id)) || managedUnits.filter(row => !row.parentId || !managedUnits.some(parent => parent.id === row.parentId)).length > 1);
  const managementUnit = unit && hasMembers(unit.id) ? unit.id : unit?.parentId && units.some(row => row.id === unit.parentId) ? unit.parentId : null;
  const managementParams = new URLSearchParams();
  if (managementUnit) managementParams.set("unitId", managementUnit);
  if (selectedSurveyId && selectedSurveyId !== ALL) managementParams.set("surveyId", selectedSurveyId);
  const managementPeriod = selected?.periodId ?? (isOverview && selectedPeriodId !== ALL ? selectedPeriodId : null);
  if (managementPeriod) managementParams.set("periodId", managementPeriod);
  const showWork = current && (current.work.length > 0 || current.assessment.status !== "SUBMITTED");
  const ownView = !isManager || personal;
  const selfUnit = units.find(row => row.id === SELF_UNIT_ID);

  return (
    <>
      <AppShell unitContext={context} />
      <main id="icerik" tabIndex={-1}>
        <PageHeader title={isManager ? "Birim panosu" : "Değerlendirme sonucu"}
          subtitle={isManager ? "Birim sonuçlarını inceleyin, eksikleri ve sonraki adımları takip edin." : isOwner ? "Sonucunuz, eksikler ve sonraki adımlar." : "Biriminizin sonucu, size düşen işler ve sonraki adımlar."}
          actions={<>
            {canCompare && <Button asChild variant="outline"><Link href={"/unit-manager/management" + (managementParams.toString() ? "?" + managementParams.toString() : "")}>Birim yönetimi</Link></Button>}
            {isManager && managedUnits.length > 1 && !isOverview && <Button variant="outline" onClick={() => showOverview()}>Tüm birimler</Button>}
            {isManager && selfUnit && !personal && <Button variant="outline" onClick={() => navigate(preferred(index!.assessments.filter(row => row.unitId === SELF_UNIT_ID)), SELF_UNIT_ID)}>Kendi değerlendirmem</Button>}
            <Button variant="ghost" aria-label="Pano verilerini yenile" disabled={indexLoading || detailLoading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Yenile</Button>
          </>} />
        {indexError ? <EmptyState title="Veriler yüklenemedi" description={indexError} action={<Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button>} /> :
          !units.length ? <EmptyState title={isManager ? "Yönettiğiniz birim yok" : "Size henüz anket atanmadı"} description={isManager ? "Birime yönetici olarak atandığınızda o birimin değerlendirmeleri burada görünür." : "Bir anket atandığında veya bir birime eklendiğinizde sonuçlarınız burada görünür."} /> :
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3" aria-busy={navigating}>
              <div><label htmlFor="unit-select" className="t-label block mb-1">{isOwner ? "Kuruluş" : "Birim"}</label><select id="unit-select" className="theme-select w-full" value={unitId} disabled={navigating || units.length < 2}
                onChange={event => event.target.value === ALL ? showOverview() : navigate(preferred(index?.assessments.filter(row => row.unitId === event.target.value) ?? []), event.target.value)}>
                {(managedUnits.length > 1 || isOverview) && <option value={ALL}>Tüm yönetilen birimler</option>}
                {units.map(row => <option key={row.id} value={row.id}>{row.id === SELF_UNIT_ID && isManager ? "Kendi değerlendirmem · " + row.name : row.name}{row.assessmentCount ? " · " + row.assessmentCount + " değerlendirme" : " · Değerlendirme yok"}</option>)}
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
            {isManager && index?.hasAnonymousCampaigns && <p className="mb-4 t-sm text-[var(--ink-2)]">Anonim kampanyaların toplu sonuçları <Link href="/organization" className="underline">Üye sonuçları</Link> ekranında gösterilir.</p>}
            {(!unit && !isOverview) || (requestedId && !selected && !indexLoading) ? <EmptyState title="Bu değerlendirmeye erişilemiyor" description={isManager ? "Seçili birim, anket veya dönem yönetim kapsamınızda olmayabilir." : "Seçili değerlendirme biriminize ait olmayabilir."} action={<Button onClick={() => units.length > 1 ? showOverview() : navigate(preferred(unitRows))}>Değerlendirme seçimine dön</Button>} /> :
              indexLoading && requestedId && !selected ? <div className="skeleton h-64" /> : isOverview ? <section aria-label="Yönetim kapsamı özeti">
                <h2 className="t-subhead mb-2">Tüm yönetilen birimler</h2>
                <p className="t-sm mb-5 text-[var(--ink-2)]">Yönettiğiniz birimler ve alt birimlerin değerlendirmeleri birlikte listelenir. Bir satırı açarak sonuçları, görevleri ve yol haritasını inceleyebilirsiniz.</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Yönetilen birim" value={managedUnits.length} note="Alt birimler dahil" />
                  <StatCard label="Anketi bulunan birim" value={assessedUnitCount} note="Seçili anket ve dönemde" />
                  <StatCard label="Başlanan değerlendirme" value={startedCount} note={submittedCount + " gönderilmiş · " + (startedCount - submittedCount) + " taslak"} />
                  <StatCard label="Başlanmamış anket" value={overviewRows.length - startedCount} note="Atanmış, henüz cevap girilmemiş" />
                </div>
                {!unitRows.length && <p className="mt-5 t-sm text-[var(--ink-2)]">Yönettiğiniz birimlerde henüz değerlendirme başlatılmadı ve aktif anket ataması yok.</p>}
              </section> : !selected ? <EmptyState title={unit!.name} description="Bu birimde henüz değerlendirme başlatılmadı ve aktif anket ataması yok." action={isManager ? managedUnits.length > 1 && index!.assessments.length ? <Button variant="outline" onClick={() => showOverview()}>Diğer birimlerin değerlendirmelerini göster</Button> : <Button asChild variant="outline"><Link href="/admin/surveys">Anketleri incele</Link></Button> : undefined} /> :
              <>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div><h2 className="t-subhead">{selected.unitName}</h2><p className="t-sm text-[var(--ink-2)]">{selected.surveyName} · {selected.periodName}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"badge " + (selected.status === "SUBMITTED" ? "badge-success" : selected.overdue ? "badge-warning" : "badge-neutral")}>{UNIT_RESULT_LABELS[selected.status]}</span>
                    {selected.deadline && <span className="t-sm text-[var(--ink-2)]">{selected.deadlineLabel}: {unitDate(selected.deadline)}{selected.overdue ? " · Süre geçti" : ""}</span>}
                    {taskHref ? <Button asChild><Link href={taskHref}><ListChecks size={16} aria-hidden="true" />{current?.assessment.locked ? "Görevleri görüntüle" : "Görev dağılımı"}</Link></Button>
                      : ownView && assessmentId && !current?.assessment.locked && <Button asChild variant={current?.work.length ? "default" : "outline"}><Link href="/survey"><ListChecks size={16} aria-hidden="true" />Ankete git</Link></Button>}
                    <Button variant="outline" disabled={!current || exporting !== null} loading={exporting === "pdf"} onClick={() => void exportReport("pdf")}><FileText size={16} aria-hidden="true" />PDF raporu</Button>
                    {current?.viewer.canExportTeam && <Button variant="outline" disabled={exporting !== null} loading={exporting === "xlsx"} onClick={() => void exportReport("xlsx")}><Download size={16} aria-hidden="true" />Excel</Button>}
                  </div>
                </div>
                {!assessmentId ? personal
                  ? <EmptyState title="Anket size atanmış, henüz başlanmamış" description="İlk cevabınızla değerlendirme açılır; sonuçlar burada görünür." action={<Button asChild><Link href="/survey">Ankete başla</Link></Button>} />
                  : isManager
                  ? <EmptyState title="Anket birime atanmış, henüz başlanmamış" description="Birim değerlendirmesini başlatarak bölümleri ekibe dağıtabilirsiniz." action={<Button loading={starting} onClick={() => void start()}>Değerlendirmeyi başlat</Button>} />
                  : <EmptyState title="Değerlendirme henüz başlatılmadı" description="Birim yöneticisi değerlendirmeyi başlatıp bölümleri dağıttığında size düşen sorular ankette görünür." /> :
                  detailError ? <EmptyState title="Sonuçlar yüklenemedi" description={detailError} action={<Button onClick={() => setRevision(value => value + 1)}>Tekrar dene</Button>} /> :
                  !current || detailLoading ? <div className="skeleton h-64" aria-label="Sonuçlar yükleniyor" /> :
                  <>
                    <div className="mb-6"><AnswerStrip view={current} comparison={groupComparison?.available ? groupComparison : null} /></div>
                    {showWork && <section className="theme-card mb-6 p-5" aria-label={ownView && !personal ? "Size düşen işler" : "Bekleyen işler"}>
                      <div className="mb-3 flex flex-wrap justify-between gap-3"><h2 className="t-subhead">{ownView && !personal ? "Size düşen işler" : "Bekleyen işler"}</h2>
                        {taskHref ? <Button asChild variant="link"><Link href={taskHref}>{current.assessment.locked ? "Görevleri görüntüle" : "Görevleri aç"}</Link></Button>
                          : !current.assessment.locked && current.work.length > 0 && <Button asChild variant="link"><Link href="/survey">Ankete git</Link></Button>}</div>
                      {current.assessment.locked && <p className="mb-3 t-sm text-[var(--ink-2)]">Cevaplar ve görev dağılımı kilitli.{isManager && !personal ? " Eksiklerle gönderilmiş bir değerlendirmeyi düzeltmek için önce gönderimi geri alın." : ""}</p>}
                      {current.work.length ? <ul className="divide-y divide-[var(--line)]">{current.work.slice(0, 5).map((item, i) => <li key={item.kind + ":" + item.sectionId + ":" + i} className="flex flex-wrap justify-between gap-2 py-3 t-sm"><span>{item.title}</span><span className="text-[var(--ink-2)]">{item.assigneeName} · {item.count} {item.kind === "EVIDENCE" ? "belge" : "soru"}</span></li>)}</ul>
                        : <p className="t-sm text-[var(--ink-2)]">{current.assessment.status === "READY_TO_SUBMIT" ? personal ? "Bütün sorular tamamlandı. Gönderdiğinizde cevaplar kilitlenir ve puan kesinleşir." : isManager ? "Bütün sorular tamamlandı. Görev dağılımından değerlendirmeyi gönderebilirsiniz." : "Bütün sorular tamamlandı; gönderimi birim yöneticisi yapar." : ownView && !personal ? "Size düşen eksik cevap veya belge yok." : "Eksik cevap veya belge yok."}</p>}
                      {personal && current.assessment.status === "READY_TO_SUBMIT" && <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
                        {confirmingSubmit ? <>
                          <p className="t-sm font-medium text-[var(--warning)]">Gönderimden sonra cevapları değiştirmek için değerlendirmeyi yeniden açmanız gerekir.</p>
                          <Button variant="outline" disabled={submitting} onClick={() => setConfirmingSubmit(false)}>Vazgeç</Button>
                          <Button loading={submitting} onClick={() => void submitAssessment()}>{!submitting && <Send size={16} aria-hidden="true" />}Gönder ve kesinleştir</Button>
                        </> : <Button onClick={() => setConfirmingSubmit(true)}><Send size={16} aria-hidden="true" />Değerlendirmeyi gönder</Button>}
                      </div>}
                    </section>}
                    <div className="theme-tabs mb-6 overflow-x-auto" role="tablist" aria-label="Pano görünümü">
                      {tabs.map(tab => <button type="button" key={tab.id} id={"tab-" + tab.id} role="tab" aria-selected={activeTab === tab.id} aria-controls="unit-panel" tabIndex={activeTab === tab.id ? 0 : -1} className={"theme-tab whitespace-nowrap " + (activeTab === tab.id ? "active" : "")} onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const index = tabs.findIndex(item => item.id === tab.id);
                        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                        openTab(tabs[next].id);
                        document.getElementById("tab-" + tabs[next].id)?.focus();
                      }} onClick={() => openTab(tab.id)}>{tab.label}</button>)}
                    </div>
                    <div id="unit-panel" role="tabpanel" aria-labelledby={"tab-" + activeTab}>
                      {activeTab === "results" && <div className="space-y-6">
                        <div><CategoryTable view={current} comparison={groupComparison?.available ? groupComparison : null} onEditTargets={current.viewer.canSetTargets ? () => setTargetsOpen(true) : undefined} /><ComparisonNote data={groupComparison} /></div>
                        <div className="grid gap-6 xl:grid-cols-2"><LowestQuestions view={current} onOpen={openTab} /><RoadmapSummary view={current} onOpen={openTab} /></div>
                        <CategoryAnalysis key={current.assessment.id} view={current} canManage={canManage} busyId={busyId} onAdd={recommendationId => void saveRoadmap({ recommendationId, status: "PLANNED" })} />
                        <UnitIronman view={current} />
                        <ScoreTrend view={current} />
                      </div>}
                      {activeTab === "answers" && <CategoryResults data={current} />}
                      {activeTab === "team" && <TeamProgress data={current} />}
                      {activeTab === "recommendations" && <UnitRecommendations data={current} busyId={busyId} save={saveRoadmap} canManage={canManage} />}
                      {activeTab === "roadmap" && <>
                        {canManage && !current.assessment.roadmapLocked && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)] p-4">
                          <p className="t-sm text-[var(--ink-2)]">Yapay zekâ, her alt kategoriden en fazla üç uygun öneriyi seçip çeyreklere yerleştirir; tarihi olan işlere dokunmaz.</p>
                          <Button variant="outline" loading={planning} onClick={() => void generatePlan()}>{!planning && <Sparkles size={16} aria-hidden="true" />}Yapay zekâ ile plan oluştur</Button>
                        </div>}
                        <UnitRecommendations data={current} roadmapOnly busyId={busyId} save={saveRoadmap} canManage={canManage} />
                      </>}
                      {activeTab === "history" && <UnitHistory data={current} />}
                      {current.viewer.canSetTargets && <TargetsDialog view={current} open={targetsOpen} saving={savingTargets} onOpenChange={setTargetsOpen} onSave={targets => void saveTargets(targets)} />}
                      {activeTab === "documents" && (documentsLoading ? <div className="skeleton h-48" /> : documentsError ? <EmptyState title="Belgeler yüklenemedi" description={documentsError} /> :
                        !documents.length ? <EmptyState title="Yüklenmiş dosya yok" description={isManager ? "Seçili değerlendirmeye bağlı belgeler burada listelenir." : "Görebildiğiniz bölümlere yüklenen belgeler burada listelenir."} /> :
                        <div className="theme-card p-0 overflow-x-auto"><table className="theme-table"><thead><tr><th>Belge</th><th>Yükleyen</th><th>Tarih</th><th>İndir</th></tr></thead><tbody>{documents.map(doc => <tr key={doc.id}><td>{doc.fileName}</td><td>{[doc.user.firstName, doc.user.lastName].filter(Boolean).join(" ") || doc.user.email}</td><td>{unitDate(doc.createdAt)}</td><td>{doc.downloadUrl && <Button asChild variant="link"><a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">İndir</a></Button>}</td></tr>)}</tbody></table></div>)}
                    </div>
                  </>}
              </>}
            {isManager && <section className="mt-8" aria-label="Birim değerlendirmeleri">
              <div className="mb-4 flex flex-wrap justify-between gap-3"><h2 className="t-subhead">Birim değerlendirmeleri</h2><div><label htmlFor="assessment-status" className="sr-only">Değerlendirme durumuna göre filtrele</label><select id="assessment-status" className="theme-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="ALL">Bütün durumlar</option>{Object.entries(UNIT_RESULT_LABELS).filter(([key]) => key !== "AWAITING_SUBMISSION").map(([key, text]) => <option key={key} value={key}>{text}</option>)}<option value="OVERDUE">Süresi geçenler</option></select></div></div>
              <div className="theme-card p-0 overflow-x-auto"><table className="theme-table"><thead><tr><th>Birim</th><th>Değerlendirme</th><th>Dönem</th><th>Durum</th><th>Tamamlanma</th><th>Puan</th><th>İşlem</th></tr></thead><tbody>
                {filteredRows.map(row => <tr key={row.id}><td>{row.unitName}</td><td>{row.surveyName}</td><td>{row.periodName}</td><td>{UNIT_RESULT_LABELS[row.status]}{row.overdue ? " · Süre geçti" : ""}</td><td className="tabular">{row.assessmentId ? row.responseCount + "/" + row.totalQuestions + " · %" + row.completionPercentage : "Henüz başlamadı"}</td><td className="tabular">{row.score == null ? "—" : "%" + row.score + " · " + unitScore(row.maturityScore) + "/5"}</td><td><Button variant="link" onClick={() => navigate(row, undefined, "results")}>{row.assessmentId ? "Sonucu görüntüle" : "Değerlendirmeyi aç"}</Button>{row.assessmentId && row.unitId !== SELF_UNIT_ID && <Button asChild variant="link"><Link href={"/unit-manager/assignments?assessmentId=" + encodeURIComponent(row.assessmentId) + "&surveyId=" + encodeURIComponent(row.surveyId) + "&unitId=" + encodeURIComponent(row.unitId)}>Görevleri aç</Link></Button>}</td></tr>)}
                {!filteredRows.length && <tr><td colSpan={7}>Bu filtreye uygun değerlendirme yok.</td></tr>}
              </tbody></table></div>
            </section>}
          </>}
      </main>
    </>
  );
}
