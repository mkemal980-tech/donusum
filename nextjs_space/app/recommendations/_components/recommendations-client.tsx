"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import Panel from "@/components/ui/panel";
import RecommendationCard from "@/components/ui/recommendation-card";
import { BubbleChart } from "@/components/ui/bubble-chart";
import { 
  Search,
  Lightbulb,
  Clock,
  DollarSign,
  Zap,
  LayoutGrid,
  ScatterChart,
  CheckCircle2,
  Play,
  Circle,
  BarChart3,
  Video,
  ExternalLink,
  X,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Button } from "@/components/ui/button";

type CompletionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  videoUrl?: string | null;
  costType: string;
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  strategicType: 'QUICK_WIN' | 'PROJECT' | 'BIG_BET';
  estimatedImpact: number;
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
  order: number;
  isInRoadmap?: boolean;
  completionStatus?: CompletionStatus;
  /** 0 = sıradaki adım, >0 = henüz kilitli, <0 = geçilmiş basamak. */
  stepDistance?: number;
  /** Yumuşak kilit: sırası gelmemiş basamak ilerletilemez. */
  isActionable?: boolean;
}

interface AssignedSurvey {
  id: string;
  name: string;
}

interface CompletionRecord {
  id: string;
  recommendationId: string;
  status: CompletionStatus;
}

export default function RecommendationsClient() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  /**
   * Öneriler tek bir anketin sonucudur; birden fazla ankete erişimi olan
   * kullanıcıda (özellikle adminde) hepsini tek listede toplamak kavramsal
   * olarak yanlış — hangi önerinin hangi ankete ait olduğu ayırt edilemez ve
   * "sıradaki adım" rozetli öneri sayısı katlanır.
   */
  const [surveys, setSurveys] = useState<AssignedSurvey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [completions, setCompletions] = useState<Record<string, CompletionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'bubble' | 'list'>('bubble');
  const [statusFilter, setStatusFilter] = useState<'all' | CompletionStatus>('all');
  const [filters, setFilters] = useState({
    timeframe: "all",
    costType: "all",
    strategicType: "all"
  });

  // Video oynatıcı state'leri
  const [activeVideo, setActiveVideo] = useState<{ url: string; title: string } | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 800, height: 450 });

  const fetchRecommendations = async (surveyId: string) => {
    if (!surveyId) return;
    try {
      const res = await fetch(`/api/recommendations?surveyId=${encodeURIComponent(surveyId)}`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data ?? []);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  };

  const fetchCompletions = async () => {
    try {
      const res = await fetch("/api/recommendations/completion");
      if (res.ok) {
        const data = await res.json();
        // API artık { completions, scores } formatında döndürüyor
        const completionList = data.completions || data || [];
        const completionMap: Record<string, CompletionStatus> = {};
        if (Array.isArray(completionList)) {
          completionList.forEach((c: CompletionRecord) => {
            completionMap[c.recommendationId] = c.status;
          });
        }
        setCompletions(completionMap);
      }
    } catch (error) {
      console.error("Error fetching completions:", error);
    }
  };

  // Erişilebilir anketler — kullanıcıda atananlar, adminde tüm aktif anketler.
  useEffect(() => {
    const loadSurveys = async () => {
      try {
        const res = await fetch("/api/survey/assigned");
        const data = res.ok ? await res.json() : [];
        const list: AssignedSurvey[] = Array.isArray(data)
          ? data.map((survey: AssignedSurvey) => ({ id: survey.id, name: survey.name }))
          : [];
        setSurveys(list);
        setSelectedSurveyId((current) => current || list[0]?.id || "");
        if (list.length === 0) setLoading(false);
      } catch (error) {
        console.error("Error fetching surveys:", error);
        setLoading(false);
      }
    };
    loadSurveys();
  }, []);

  // Anket değişince öneriler ve tamamlama durumları yeniden okunur.
  useEffect(() => {
    if (!selectedSurveyId) return;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRecommendations(selectedSurveyId), fetchCompletions()]);
      setLoading(false);
    };
    loadData();
  }, [selectedSurveyId]);

  const selectedSurveyName =
    surveys.find((survey) => survey.id === selectedSurveyId)?.name ?? "";

  const handleAddToRoadmap = async (recommendationId: string) => {
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId })
      });

      if (res.ok) {
        setRecommendations(prev => 
          (prev ?? []).map(rec => 
            rec?.id === recommendationId 
              ? { ...(rec ?? {}), isInRoadmap: true } 
              : rec
          )
        );
        toast.success("Öneri yol haritasına eklendi", {
          description: "Yol Haritası sayfasından planlayabilirsiniz"
        });
      } else {
        // Kademe kilidi gibi sunucu tarafı kuralların mesajını göster.
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || "Öneri eklenemedi");
      }
    } catch (error) {
      console.error("Error adding to roadmap:", error);
      toast.error("Öneri eklenemedi");
    }
  };

  const handleStatusChange = async (recommendationId: string, status: CompletionStatus) => {
    try {
      const res = await fetch("/api/recommendations/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, status })
      });

      if (res.ok) {
        const data = await res.json();
        
        setCompletions(prev => ({
          ...prev,
          [recommendationId]: status
        }));
        
        const statusLabels: Record<CompletionStatus, string> = {
          NOT_STARTED: "Başlanmadı",
          IN_PROGRESS: "Devam Ediyor",
          COMPLETED: "Tamamlandı"
        };
        
        // Tamamlandıysa kazanılan puanı göster
        if (status === 'COMPLETED' && data.pointsEarned > 0) {
          toast.success(`🎉 Öneri tamamlandı! +${data.pointsEarned} puan kazandınız`, {
            description: data.updatedScores 
              ? `Yeni skor: ${data.updatedScores.overallScore}/5 (${data.updatedScores.overallPercentage}%)`
              : undefined,
            duration: 5000,
          });
        } else {
          toast.success(`Durum güncellendi: ${statusLabels[status]}`);
        }

        // Kademe ilerledi: kilit ve sıralama sunucudan yeniden okunur.
        await fetchRecommendations(selectedSurveyId);
      } else {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload.error || "Durum güncellenemedi");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Durum güncellenemedi");
    }
  };

  // Tamamlanma durumu önerilere iliştirilir; sıra sunucudan geldiği gibi
  // kalır — merdiven basamağı, etki, maliyet ve vade zaten sırayı belirler.
  const recommendationsWithStatus = (recommendations ?? []).map(rec => ({
    ...rec,
    completionStatus: completions[rec.id] || 'NOT_STARTED'
  }));

  const filteredRecommendations = recommendationsWithStatus.filter(rec => {
    const matchesSearch = (rec?.title ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase()) ||
                          (rec?.description ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase());
    const matchesTimeframe = filters?.timeframe === "all" || rec?.timeframe === filters?.timeframe;
    const matchesCost = filters?.costType === "all" || rec?.costType === filters?.costType;
    const matchesStrategic = filters?.strategicType === "all" || rec?.strategicType === filters?.strategicType;
    const matchesStatus = statusFilter === "all" || rec?.completionStatus === statusFilter;
    
    return matchesSearch && matchesTimeframe && matchesCost && matchesStrategic && matchesStatus;
  });

  // Stats
  const stats = {
    total: recommendationsWithStatus.length,
    notStarted: recommendationsWithStatus.filter(r => r.completionStatus === 'NOT_STARTED').length,
    inProgress: recommendationsWithStatus.filter(r => r.completionStatus === 'IN_PROGRESS').length,
    completed: recommendationsWithStatus.filter(r => r.completionStatus === 'COMPLETED').length
  };

  /**
   * Grafik yalnızca şu an yapılabilir önerileri çizer.
   *
   * İki sebep: kademeli merdivende öneriler katlandığı için 100+ baloncuk
   * okunaksız hâle geliyor; ve daha önemlisi, henüz kilitli olan bir öneriyi
   * "önceliklendirmek" anlamsız — kullanıcı ona sıra gelmeden başlayamıyor.
   * Kilitli olanlar liste görünümünde sırasıyla duruyor.
   */
  const chartRecommendations = filteredRecommendations.filter(
    (rec) => rec.isActionable !== false
  );
  const lockedCount = filteredRecommendations.length - chartRecommendations.length;

  const quickWins = filteredRecommendations?.filter(r => r?.strategicType === "QUICK_WIN") ?? [];
  const projects = filteredRecommendations?.filter(r => r?.strategicType === "PROJECT") ?? [];
  const bigBets = filteredRecommendations?.filter(r => r?.strategicType === "BIG_BET") ?? [];

  if (loading) {
    return (
      <>
        <AppShell />
        <main>
          <div className="skeleton mb-6 h-8 w-48" />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <div className="skeleton h-[420px]" />
        </main>
      </>
    );
  }

  const statusCards = [
    { key: 'all' as const, label: 'Toplam öneri', value: stats.total },
    { key: 'NOT_STARTED' as const, label: 'Başlanmadı', value: stats.notStarted },
    { key: 'IN_PROGRESS' as const, label: 'Devam ediyor', value: stats.inProgress },
    { key: 'COMPLETED' as const, label: 'Tamamlandı', value: stats.completed },
  ];

  return (
    <>
      <AppShell />

      <main>
        <PageHeader
          title="Öneriler"
          subtitle={
            surveys.length > 1
              ? `${selectedSurveyName} değerlendirmesine göre hazırlanan iyileştirme adımları`
              : "Değerlendirme sonucunuza göre hazırlanan iyileştirme adımları"
          }
          actions={
            <>
              {/* Birden fazla ankete erişimi olanlar için anket seçici.
                  Tek ankette gösterilmez — gereksiz karar yükü olur. */}
              {surveys.length > 1 && (
                <>
                  <label htmlFor="rec-survey" className="sr-only">
                    Anket
                  </label>
                  <select
                    id="rec-survey"
                    value={selectedSurveyId}
                    onChange={(event) => setSelectedSurveyId(event.target.value)}
                    className="theme-select w-auto"
                    title="Öneriler seçili ankete göre listelenir"
                  >
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <div className="theme-tabs" role="tablist" aria-label="Görünüm">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'bubble'}
                  onClick={() => setViewMode('bubble')}
                  className={`theme-tab ${viewMode === 'bubble' ? 'active' : ''}`}
                >
                  <ScatterChart size={15} className="mr-1.5 inline-block align-[-2px]" aria-hidden="true" />
                  Grafik
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  onClick={() => setViewMode('list')}
                  className={`theme-tab ${viewMode === 'list' ? 'active' : ''}`}
                >
                  <LayoutGrid size={15} className="mr-1.5 inline-block align-[-2px]" aria-hidden="true" />
                  Liste
                </button>
              </div>
            </>
          }
        />

        {/* Sayı kartları aynı zamanda durum filtresi: seçili olan vurgu
            kenarlığıyla işaretlenir, dekoratif ikon kutusu taşımaz. */}
        <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          {statusCards.map((card) => {
            const selected = statusFilter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setStatusFilter(card.key)}
                aria-pressed={selected}
                className="rounded-[var(--radius-lg)] p-5 text-left transition-colors duration-fast ease-out-quart"
                style={{
                  background: selected ? "var(--accent-quiet)" : "var(--surface)",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                <span className="block t-label" style={{ color: "var(--ink-2)" }}>
                  {card.label}
                </span>
                <span className="mt-2 block t-metric" style={{ color: "var(--ink)" }}>
                  {card.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtreler */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              size={16}
              style={{ color: "var(--ink-3)" }}
              aria-hidden="true"
            />
            <label htmlFor="rec-search" className="sr-only">
              Önerilerde ara
            </label>
            <input
              id="rec-search"
              type="search"
              placeholder="Önerilerde ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target?.value ?? '')}
              className="theme-input"
              style={{ paddingLeft: 34 }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <label htmlFor="filter-timeframe" className="sr-only">
              Zaman dilimi
            </label>
            <select
              id="filter-timeframe"
              value={filters?.timeframe ?? 'all'}
              onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), timeframe: e.target?.value ?? 'all' }))}
              className="theme-select w-auto"
            >
              <option value="all">Tüm zaman dilimleri</option>
              <option value="SHORT_TERM">Kısa vade</option>
              <option value="MEDIUM_TERM">Orta vade</option>
              <option value="LONG_TERM">Uzun vade</option>
            </select>

            <label htmlFor="filter-cost" className="sr-only">
              Maliyet tipi
            </label>
            <select
              id="filter-cost"
              value={filters?.costType ?? 'all'}
              onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), costType: e.target?.value ?? 'all' }))}
              className="theme-select w-auto"
            >
              <option value="all">Tüm maliyet tipleri</option>
              <option value="CAPEX">CAPEX (yatırım)</option>
              <option value="OPEX">OPEX (işletme)</option>
            </select>

            <label htmlFor="filter-strategic" className="sr-only">
              Öneri tipi
            </label>
            <select
              id="filter-strategic"
              value={filters?.strategicType ?? 'all'}
              onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), strategicType: e.target?.value ?? 'all' }))}
              className="theme-select w-auto"
            >
              <option value="all">Tüm tipler</option>
              <option value="QUICK_WIN">Hızlı kazanım</option>
              <option value="PROJECT">Proje</option>
              <option value="BIG_BET">Büyük yatırım</option>
            </select>
          </div>
        </div>

        {/* Bubble Chart View */}
        {viewMode === 'bubble' && (filteredRecommendations?.length ?? 0) > 0 && (
          <>
            <div className="mb-6">
              {/* Durum filtresi yüzünden yapılabilir öneri kalmayabilir;
                  boş bir grafik çizmek yerine sebebini söyle. */}
              {chartRecommendations.length === 0 ? (
                <EmptyState
                  title="Seçili filtrelerde yapılabilecek öneri yok"
                  description={`Sırası gelmemiş ${lockedCount} öneri liste görünümünde görülebilir.`}
                  action={
                    <Button variant="outline" onClick={() => setViewMode('list')}>
                      Liste görünümüne geç
                    </Button>
                  }
                />
              ) : (
                <BubbleChart
                  recommendations={chartRecommendations as Recommendation[]}
                  title="Öneri Önceliklendirme Grafiği"
                />
              )}
              {/* Grafikten ne çıkarıldığı sessiz kalmamalı. */}
              {lockedCount > 0 && chartRecommendations.length > 0 && (
                <p className="mt-2 t-sm" style={{ color: "var(--ink-3)" }}>
                  Grafikte şu an yapılabilecek {chartRecommendations.length} öneri gösteriliyor.
                  Sırası gelmemiş {lockedCount} öneri, önceki basamak tamamlandıkça açılır —
                  hepsini{" "}
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className="underline underline-offset-4"
                    style={{ color: "var(--accent)" }}
                  >
                    liste görünümünde
                  </button>{" "}
                  görebilirsiniz.
                </p>
              )}
            </div>

            {/* Eğitim ve Danışmanlık Bölümü */}
            {filteredRecommendations.filter(r => r.videoUrl).length > 0 && (
              <Panel title="Eğitim ve danışmanlık" padding="md" className="mb-6">
                <ul className="flex flex-col">
                  {filteredRecommendations
                    .filter(r => r.videoUrl)
                    .map((rec, index) => (
                      <li
                        key={rec.id}
                        className="flex items-center justify-between gap-4 py-3"
                        style={{ borderTop: index === 0 ? undefined : "1px solid var(--line)" }}
                      >
                        <div className="min-w-0">
                          <p className="truncate t-body" style={{ color: "var(--ink)" }}>
                            {rec.title}
                          </p>
                          <p className="t-sm" style={{ color: "var(--ink-3)" }}>
                            Video eğitim mevcut
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActiveVideo({ url: rec.videoUrl || '', title: rec.title })}
                        >
                          <Play size={14} aria-hidden="true" />
                          İzle
                        </Button>
                      </li>
                    ))}
                </ul>
              </Panel>
            )}
          </>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {/* Quick Wins Section */}
            {(quickWins?.length ?? 0) > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 t-subhead" style={{ color: "var(--ink)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-2)" }} aria-hidden="true" />
                  Hızlı kazanımlar ({quickWins?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {quickWins?.map((rec) => (
                    <RecommendationCard
                      key={rec?.id}
                      recommendation={rec}
                      onAddToRoadmap={handleAddToRoadmap}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Projects Section */}
            {(projects?.length ?? 0) > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 t-subhead" style={{ color: "var(--ink)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
                  Projeler ({projects?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {projects?.map((rec) => (
                    <RecommendationCard
                      key={rec?.id}
                      recommendation={rec}
                      onAddToRoadmap={handleAddToRoadmap}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Big Bets Section */}
            {(bigBets?.length ?? 0) > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 flex items-center gap-2 t-subhead" style={{ color: "var(--ink)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-3)" }} aria-hidden="true" />
                  Büyük yatırımlar ({bigBets?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {bigBets?.map((rec) => (
                    <RecommendationCard
                      key={rec?.id}
                      recommendation={rec}
                      onAddToRoadmap={handleAddToRoadmap}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {(filteredRecommendations?.length ?? 0) === 0 && (
          <EmptyState
            title="Gösterilecek öneri yok"
            description={
              searchTerm || filters?.timeframe !== "all" || filters?.costType !== "all" || filters?.strategicType !== "all" || statusFilter !== "all"
                ? "Seçili filtrelerde eşleşen öneri kalmadı. Filtreleri gevşetin."
                : surveys.length > 1 && selectedSurveyName
                  ? `Öneriler, "${selectedSurveyName}" anketi cevaplandıkça üretilir.`
                  : "Öneriler, anket cevaplandıkça üretilir."
            }
          />
        )}
      </main>

      {/* Video Oynatıcı Modal */}
      {activeVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop fixed inset-0 flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="modal-content relative overflow-hidden"
            style={{ width: videoSize.width, maxWidth: '95vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between gap-4 p-4"
              style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}
            >
              <h3 className="min-w-0 flex-1 truncate t-body font-medium" style={{ color: "var(--ink)" }}>
                {activeVideo.title}
              </h3>
              <div className="flex items-center gap-2">
                {/* Boyut Ayarlama Butonları */}
                <button
                  onClick={() => setVideoSize({ width: 640, height: 360 })}
                  type="button"
                  className="icon-btn"
                  style={
                    videoSize.width === 640
                      ? { background: "var(--accent-quiet)", color: "var(--ink)" }
                      : undefined
                  }
                  aria-pressed={videoSize.width === 640}
                  title="Küçük"
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  onClick={() => setVideoSize({ width: 800, height: 450 })}
                  type="button"
                  className="icon-btn"
                  style={
                    videoSize.width === 800
                      ? { background: "var(--accent-quiet)", color: "var(--ink)" }
                      : undefined
                  }
                  aria-pressed={videoSize.width === 800}
                  title="Orta"
                >
                  <Video size={16} />
                </button>
                <button
                  onClick={() => setVideoSize({ width: 1200, height: 675 })}
                  type="button"
                  className="icon-btn"
                  style={
                    videoSize.width === 1200
                      ? { background: "var(--accent-quiet)", color: "var(--ink)" }
                      : undefined
                  }
                  aria-pressed={videoSize.width === 1200}
                  title="Büyük"
                >
                  <Maximize2 size={16} />
                </button>
                {/* Kapat Butonu */}
                <Button
                  onClick={() => setActiveVideo(null)}
                  variant="ghost"
                  size="icon"
                  aria-label="Videoyu kapat"
                  className="ml-1"
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
            
            {/* Video Container */}
            <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
              {activeVideo.url.includes('youtube.com') || activeVideo.url.includes('youtu.be') ? (
                <iframe
                  src={`https://www.youtube.com/embed/${
                    activeVideo.url.includes('youtu.be') 
                      ? activeVideo.url.split('youtu.be/')[1]?.split('?')[0]
                      : activeVideo.url.split('v=')[1]?.split('&')[0]
                  }?autoplay=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : activeVideo.url.includes('vimeo.com') ? (
                <iframe
                  src={`https://player.vimeo.com/video/${activeVideo.url.split('vimeo.com/')[1]?.split('?')[0]}?autoplay=1`}
                  className="w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={activeVideo.url}
                  className="w-full h-full"
                  controls
                  autoPlay
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
