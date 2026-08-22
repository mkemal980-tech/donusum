"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Plus,
  Printer,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

type MemberUnit = { id: string; name: string; activeUserCount: number };
type RootUnit = {
  id: string;
  name: string;
  description: string | null;
  members: MemberUnit[];
};
type Survey = { id: string; name: string; description: string | null };
type CampaignListItem = {
  id: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  privacyMode: "IDENTIFIED" | "ANONYMOUS";
  deadline: string | null;
  recipientCount: number;
  tenantUnit: { id: string; name: string };
  survey: { id: string; name: string };
};
type DashboardData = {
  campaign: {
    id: string;
    name: string;
    status: string;
    privacyMode: "IDENTIFIED" | "ANONYMOUS";
    minimumCohortSize: number;
    deadline: string | null;
    launchedAt: string | null;
    tenantUnit: { id: string; name: string };
    survey: { id: string; name: string };
  };
  participation: {
    total: number;
    submitted: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
    completionRate: number;
    lastActivityAt: string | null;
  };
  results: {
    visible: boolean;
    requiredCohortSize: number;
    submittedCount: number;
    averagePercentage: number | null;
    medianPercentage: number | null;
    maturityLevel: string | null;
    averageVelocity: number | null;
    averageEndurance: number | null;
    distribution: { label: string; count: number }[];
    categories: {
      id: string;
      name: string;
      average: number | null;
      best: number | null;
      lowest: number | null;
      assessmentCount: number;
    }[];
  };
  members: {
    id: string;
    memberUnitId: string;
    memberName: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED";
    answeredQuestions: number;
    totalQuestions: number;
    completionPercentage: number;
    resultPercentage: number | null;
    maturityScore: number | null;
    maturityLevel: string | null;
    submittedAt: string | null;
    lastActivityAt: string | null;
  }[];
};

const STATUS_LABEL = {
  NOT_STARTED: "Başlamadı",
  IN_PROGRESS: "Devam ediyor",
  SUBMITTED: "Gönderildi",
} as const;

const STATUS_BADGE = {
  NOT_STARTED: "badge badge-neutral",
  IN_PROGRESS: "badge badge-warning",
  SUBMITTED: "badge badge-success",
} as const;

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function OrganizationDashboardPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession() || {};
  const [roots, setRoots] = useState<RootUnit[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | keyof typeof STATUS_LABEL>("ALL");
  const [form, setForm] = useState({
    name: "",
    tenantUnitId: "",
    surveyId: "",
    privacyMode: "IDENTIFIED" as "IDENTIFIED" | "ANONYMOUS",
    minimumCohortSize: 5,
    deadline: "",
    memberUnitIds: [] as string[],
  });

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/login");
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (sessionStatus === "authenticated" && role !== "UNIT_MANAGER" && role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [router, session, sessionStatus]);

  const loadConfig = useCallback(async (preferredCampaignId?: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/organization/campaigns", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kampanyalar yüklenemedi");
      setRoots(data.roots ?? []);
      setSurveys(data.surveys ?? []);
      setCampaigns(data.campaigns ?? []);
      const nextCampaignId = preferredCampaignId || data.campaigns?.[0]?.id || "";
      setSelectedCampaignId(nextCampaignId);
      setForm((current) => ({
        ...current,
        tenantUnitId: current.tenantUnitId || data.roots?.[0]?.id || "",
        surveyId: current.surveyId || data.surveys?.[0]?.id || "",
      }));
      if (!nextCampaignId && (data.campaigns?.length ?? 0) === 0) setShowCreate(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kampanyalar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") loadConfig();
  }, [loadConfig, sessionStatus]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setDashboard(null);
      return;
    }
    const load = async () => {
      setDashboardLoading(true);
      try {
        const response = await fetch(
          `/api/organization/dashboard?campaignId=${encodeURIComponent(selectedCampaignId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Sonuçlar yüklenemedi");
        setDashboard(data);
      } catch (error) {
        setDashboard(null);
        toast.error(error instanceof Error ? error.message : "Sonuçlar yüklenemedi");
      } finally {
        setDashboardLoading(false);
      }
    };
    load();
  }, [selectedCampaignId]);

  const selectedRoot = roots.find((root) => root.id === form.tenantUnitId);
  const selectableMembers = selectedRoot?.members ?? [];

  useEffect(() => {
    setForm((current) => ({ ...current, memberUnitIds: [] }));
  }, [form.tenantUnitId]);

  const toggleMember = (memberId: string) => {
    setForm((current) => ({
      ...current,
      memberUnitIds: current.memberUnitIds.includes(memberId)
        ? current.memberUnitIds.filter((id) => id !== memberId)
        : [...current.memberUnitIds, memberId],
    }));
  };

  const selectAllMembers = () => {
    const eligible = selectableMembers.filter((member) => member.activeUserCount > 0).map((member) => member.id);
    setForm((current) => ({
      ...current,
      memberUnitIds: current.memberUnitIds.length === eligible.length ? [] : eligible,
    }));
  };

  const createCampaign = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/organization/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kampanya oluşturulamadı");
      toast.success("Kampanya açıldı ve anket üyelere atandı");
      setShowCreate(false);
      setForm((current) => ({ ...current, name: "", deadline: "", memberUnitIds: [] }));
      await loadConfig(data.campaign.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kampanya oluşturulamadı");
    } finally {
      setCreating(false);
    }
  };

  const closeCampaign = async () => {
    if (!dashboard || !window.confirm("Kampanya kapatılsın mı? Üyeler artık ankete cevap veremez.")) return;
    setClosing(true);
    try {
      const response = await fetch(`/api/organization/campaigns/${dashboard.campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kampanya kapatılamadı");
      setDashboard((current) => current ? {
        ...current,
        campaign: { ...current.campaign, status: "CLOSED" },
      } : current);
      setCampaigns((current) => current.map((campaign) =>
        campaign.id === dashboard.campaign.id ? { ...campaign, status: "CLOSED" } : campaign
      ));
      toast.success("Kampanya kapatıldı");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kampanya kapatılamadı");
    } finally {
      setClosing(false);
    }
  };

  const remindPendingMembers = async () => {
    if (!dashboard) return;
    setReminding(true);
    try {
      const response = await fetch(`/api/organization/campaigns/${dashboard.campaign.id}/remind`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hatırlatma gönderilemedi");
      toast.success(data.message || "Hatırlatma gönderildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Hatırlatma gönderilemedi");
    } finally {
      setReminding(false);
    }
  };

  const filteredMembers = useMemo(
    () =>
      dashboard?.members.filter(
        (member) => statusFilter === "ALL" || member.status === statusFilter
      ) ?? [],
    [dashboard?.members, statusFilter]
  );

  if (loading || sessionStatus === "loading") {
    return (
      <>
        <AppShell />
        <main>
          <div className="skeleton mb-6 h-10 w-80" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-28" />)}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppShell />
      <main>
        <PageHeader
          title="Üye anketleri"
          subtitle="Oda/STK kampanyalarının katılımını ve kesinleşmiş üye sonuçlarını izleyin."
          actions={
            <Button onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? <X size={16} /> : <Plus size={16} />}
              {showCreate ? "Kapat" : "Yeni kampanya"}
            </Button>
          }
        />

        {showCreate && (
          <form
            onSubmit={createCampaign}
            className="mb-6 rounded-[var(--radius-lg)] p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <div className="mb-5">
              <h2 className="t-subhead" style={{ color: "var(--ink)" }}>Kampanya oluştur</h2>
              <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
                Her seçili üye kuruluş ayrı değerlendirme üretir. Aynı üyedeki çalışanlar tek kurumsal sonuca katkı verir.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                Kampanya adı
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="theme-input mt-1.5 w-full"
                  placeholder="2026 Üye Olgunluk Araştırması"
                />
              </label>
              <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                Oda / STK
                <select
                  required
                  value={form.tenantUnitId}
                  onChange={(event) => setForm((current) => ({ ...current, tenantUnitId: event.target.value }))}
                  className="theme-select mt-1.5 w-full"
                >
                  {roots.map((root) => <option key={root.id} value={root.id}>{root.name}</option>)}
                </select>
              </label>
              <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                Anket
                <select
                  required
                  value={form.surveyId}
                  onChange={(event) => setForm((current) => ({ ...current, surveyId: event.target.value }))}
                  className="theme-select mt-1.5 w-full"
                >
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.name}</option>)}
                </select>
              </label>
              <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                Son tarih
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))}
                  className="theme-input mt-1.5 w-full"
                />
              </label>
              <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                Sonuç görünürlüğü
                <select
                  value={form.privacyMode}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    privacyMode: event.target.value as "IDENTIFIED" | "ANONYMOUS",
                  }))}
                  className="theme-select mt-1.5 w-full"
                >
                  <option value="IDENTIFIED">İsimli — üye bazlı sonuç</option>
                  <option value="ANONYMOUS">Anonim — yalnızca toplu sonuç</option>
                </select>
              </label>
              {form.privacyMode === "ANONYMOUS" && (
                <label className="t-sm" style={{ color: "var(--ink-2)" }}>
                  Sonuçların açılacağı en az gönderim
                  <input
                    type="number"
                    min={3}
                    max={100}
                    value={form.minimumCohortSize}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      minimumCohortSize: Number(event.target.value),
                    }))}
                    className="theme-input mt-1.5 w-full"
                  />
                </label>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="t-label" style={{ color: "var(--ink-2)" }}>Üye kuruluşlar</p>
                <button type="button" className="btn-ghost text-xs" onClick={selectAllMembers}>
                  Tüm uygun üyeleri seç
                </button>
              </div>
              {selectableMembers.length > 0 ? (
                <div className="grid max-h-64 gap-2 overflow-y-auto rounded-[var(--radius-md)] p-3 md:grid-cols-2" style={{ background: "var(--surface-2)" }}>
                  {selectableMembers.map((member) => {
                    const disabled = member.activeUserCount === 0;
                    return (
                      <label
                        key={member.id}
                        className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-[var(--surface-3)]"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={form.memberUnitIds.includes(member.id)}
                          onChange={() => toggleMember(member.id)}
                        />
                        <span className="min-w-0">
                          <span className="block truncate t-sm" style={{ color: "var(--ink)" }}>{member.name}</span>
                          <span className="block t-caption" style={{ color: "var(--ink-3)" }}>
                            {disabled ? "Aktif kullanıcı yok" : `${member.activeUserCount} aktif kullanıcı`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-[var(--radius-md)] p-4 t-sm" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                  Bu kök kuruluşun altında üye birim bulunmuyor. Önce Yönetim → Birimler ekranında üyeleri alt birim olarak ekleyin.
                </p>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" loading={creating} disabled={!form.memberUnitIds.length || !surveys.length}>
                {!creating && <Plus size={16} />}
                Kampanyayı başlat
              </Button>
            </div>
          </form>
        )}

        {campaigns.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
            <label className="flex min-w-0 flex-1 items-center gap-3 t-sm" style={{ color: "var(--ink-2)" }}>
              Kampanya
              <select
                value={selectedCampaignId}
                onChange={(event) => setSelectedCampaignId(event.target.value)}
                className="theme-select min-w-0 flex-1 md:max-w-lg"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} · {campaign.survey.name} · {campaign.recipientCount} üye{campaign.status === "CLOSED" ? " · kapalı" : ""}
                  </option>
                ))}
              </select>
            </label>
            {dashboard && (
              <div className="flex items-center gap-2 print:hidden">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/organization/campaigns/${dashboard.campaign.id}/export`, "_blank")}
                >
                  <Download size={16} /> CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer size={16} /> PDF / Yazdır
                </Button>
              </div>
            )}
          </div>
        )}

        {dashboardLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : !dashboard ? (
          !showCreate && (
            <EmptyState
              title="Henüz üye kampanyası yok"
              description="İlk kampanyayı oluşturduğunuzda katılım ve sonuçlar burada görünür."
              action={<Button onClick={() => setShowCreate(true)}>Kampanya oluştur</Button>}
            />
          )
        ) : (
          <CampaignDashboard
            data={dashboard}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            members={filteredMembers}
            closing={closing}
            onClose={closeCampaign}
            reminding={reminding}
            onRemind={remindPendingMembers}
          />
        )}
      </main>
    </>
  );
}

function CampaignDashboard({
  data,
  statusFilter,
  setStatusFilter,
  members,
  closing,
  onClose,
  reminding,
  onRemind,
}: {
  data: DashboardData;
  statusFilter: "ALL" | keyof typeof STATUS_LABEL;
  setStatusFilter: (value: "ALL" | keyof typeof STATUS_LABEL) => void;
  members: DashboardData["members"];
  closing: boolean;
  onClose: () => void;
  reminding: boolean;
  onRemind: () => void;
}) {
  const maxDistribution = Math.max(1, ...data.results.distribution.map((item) => item.count));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-title" style={{ color: "var(--ink)" }}>{data.campaign.name}</h2>
            <span className={data.campaign.status === "ACTIVE" ? "badge badge-success" : "badge badge-neutral"}>
              {data.campaign.status === "ACTIVE" ? "Aktif" : "Kapalı"}
            </span>
            <span className="badge badge-neutral">
              {data.campaign.privacyMode === "ANONYMOUS" ? "Anonim" : "İsimli"}
            </span>
          </div>
          <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
            {data.campaign.tenantUnit.name} · {data.campaign.survey.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 t-sm" style={{ color: "var(--ink-2)" }}>
            <CalendarDays size={16} /> Son tarih {formatDate(data.campaign.deadline)}
          </div>
          {data.campaign.status === "ACTIVE" && (
            <>
              <Button variant="outline" onClick={onRemind} loading={reminding} className="print:hidden">
                {!reminding && <Mail size={15} />}
                Eksiklere hatırlat
              </Button>
              <Button variant="outline" onClick={onClose} loading={closing} className="print:hidden">
                {!closing && <Lock size={15} />}
                Kampanyayı kapat
              </Button>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Hedef üye" value={data.participation.total} note="kampanyaya dahil kuruluş" />
        <StatCard label="Gönderilen" value={data.participation.submitted} note={`${data.participation.completionRate}% katılım`} />
        <StatCard label="Devam eden" value={data.participation.inProgress} note="cevap girişi başlamış" />
        <StatCard
          label="Başlamayan"
          value={data.participation.notStarted}
          note={data.participation.overdue > 0 ? `${data.participation.overdue} üye gecikmiş` : "bekleyen üye"}
        />
      </div>

      <section className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="t-subhead" style={{ color: "var(--ink)" }}>Katılım durumu</h3>
            <p className="mt-1 t-sm" style={{ color: "var(--ink-3)" }}>
              Son hareket {formatDate(data.participation.lastActivityAt)}
            </p>
          </div>
          <span className="t-metric tabular" style={{ color: "var(--ink)" }}>%{data.participation.completionRate}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
          <div className="h-full rounded-full" style={{ width: `${data.participation.completionRate}%`, background: "var(--accent)" }} />
        </div>
      </section>

      {!data.results.visible ? (
        <section className="rounded-[var(--radius-lg)] p-7" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="flex max-w-2xl items-start gap-4">
            <ShieldCheck size={24} className="shrink-0" style={{ color: "var(--accent)" }} />
            <div>
              <h3 className="t-subhead" style={{ color: "var(--ink)" }}>Anonim sonuçlar korunuyor</h3>
              <p className="mt-2 t-body" style={{ color: "var(--ink-2)" }}>
                Sonuçlar en az {data.results.requiredCohortSize} üye gönderim yaptığında açılır.
                Şu anda {data.results.submittedCount} gönderim var. Üye adları ve tekil puanlar hiçbir zaman paylaşılmaz.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Ortalama olgunluk"
              value={data.results.averagePercentage === null ? "—" : `%${data.results.averagePercentage}`}
              note={data.results.maturityLevel ?? "sonuç yok"}
            />
            <StatCard
              label="Medyan puan"
              value={data.results.medianPercentage === null ? "—" : `%${data.results.medianPercentage}`}
              note="uç değerlerden daha az etkilenir"
            />
            <StatCard
              label="Hız"
              value={data.results.averageVelocity === null ? "—" : `${data.results.averageVelocity}/5`}
              note="aksiyon alma ortalaması"
            />
            <StatCard
              label="Dayanıklılık"
              value={data.results.averageEndurance === null ? "—" : `${data.results.averageEndurance}/5`}
              note="süreklilik ortalaması"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-[var(--radius-lg)] p-6 lg:col-span-2" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <div className="mb-5 flex items-center gap-2">
                <BarChart3 size={18} style={{ color: "var(--accent)" }} />
                <h3 className="t-subhead" style={{ color: "var(--ink)" }}>Kategori sonuçları</h3>
              </div>
              {data.results.categories.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="theme-table">
                    <thead><tr><th>Kategori</th><th>Ortalama</th><th>En iyi</th><th>En düşük</th><th>Sonuç</th></tr></thead>
                    <tbody>
                      {data.results.categories.map((category) => (
                        <tr key={category.id}>
                          <td className="font-medium">{category.name}</td>
                          <td className="tabular">{category.average === null ? "—" : `%${category.average}`}</td>
                          <td className="tabular">{category.best === null ? "—" : `%${category.best}`}</td>
                          <td className="tabular">{category.lowest === null ? "—" : `%${category.lowest}`}</td>
                          <td className="tabular">{category.assessmentCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="t-sm" style={{ color: "var(--ink-3)" }}>Henüz kesinleşmiş kategori sonucu yok.</p>}
            </section>

            <section className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <h3 className="t-subhead" style={{ color: "var(--ink)" }}>Olgunluk dağılımı</h3>
              <div className="mt-5 space-y-4">
                {data.results.distribution.map((item) => (
                  <div key={item.label}>
                    <div className="mb-1 flex justify-between gap-3 t-sm">
                      <span style={{ color: "var(--ink-2)" }}>{item.label}</span>
                      <span className="tabular" style={{ color: "var(--ink)" }}>{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(item.count / maxDistribution) * 100}%`, background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {data.campaign.privacyMode === "IDENTIFIED" && (
        <section className="rounded-[var(--radius-lg)] p-6" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} style={{ color: "var(--accent)" }} />
              <div>
                <h3 className="t-subhead" style={{ color: "var(--ink)" }}>Üye kuruluşlar</h3>
                <p className="mt-0.5 t-sm" style={{ color: "var(--ink-3)" }}>Taslak puanlar gösterilmez; sonuç yalnızca gönderimden sonra açılır.</p>
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="theme-select w-auto"
            >
              <option value="ALL">Tüm durumlar</option>
              <option value="NOT_STARTED">Başlamadı</option>
              <option value="IN_PROGRESS">Devam ediyor</option>
              <option value="SUBMITTED">Gönderildi</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="theme-table">
              <thead><tr><th>Üye kuruluş</th><th>Durum</th><th>İlerleme</th><th>Sonuç</th><th>Olgunluk</th><th>Son hareket</th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td className="font-medium">{member.memberName}</td>
                    <td><span className={STATUS_BADGE[member.status]}>{STATUS_LABEL[member.status]}</span></td>
                    <td className="tabular">{member.answeredQuestions}/{member.totalQuestions} · %{member.completionPercentage}</td>
                    <td className="tabular font-medium">{member.resultPercentage === null ? "Taslak" : `%${member.resultPercentage}`}</td>
                    <td>{member.maturityLevel ?? "—"}</td>
                    <td>{formatDate(member.lastActivityAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 && <p className="py-8 text-center t-sm" style={{ color: "var(--ink-3)" }}>Bu filtrede üye bulunmuyor.</p>}
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] p-4 t-sm" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
        {data.campaign.privacyMode === "ANONYMOUS" ? <EyeOff size={18} /> : <CheckCircle2 size={18} />}
        {data.campaign.privacyMode === "ANONYMOUS"
          ? "Anonim mod: üye adları, tekil puanlar ve cevaplar rapora dahil edilmez."
          : "İsimli mod: yalnızca bu oda/STK kapsamındaki üye kuruluşların kesinleşmiş sonuçları gösterilir."}
      </section>
    </div>
  );
}
