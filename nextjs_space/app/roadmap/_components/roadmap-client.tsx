"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import Panel from "@/components/ui/panel";
import StatCard from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import RoadmapTimeline from "@/components/ui/roadmap-timeline";
import { CheckCircle, Clock, PlayCircle, XCircle, CalendarClock } from "lucide-react";

/**
 * Yol haritası.
 *
 * Katkı ve özet sunucudan gelir (docs/GELISIM-PUANI.md); bu sayfa hesap
 * yapmaz. Eskiden puan × durum yüzdesi tarayıcıda toplanıyordu ve kademeli
 * önerilerde (puanı tasarım gereği 0) 13 tamamlanmış öneri +0.00 gösteriyordu.
 */

interface Contribution {
  recommendationId: string;
  kind: "cascade" | "points";
  /** Tamamlanınca genel puana eklediği fark. */
  full: number;
  /** Bugünkü durumuyla eklediği fark. */
  current: number;
  rung: { index: number; total: number } | null;
}

interface RoadmapItem {
  id: string;
  recommendationId: string;
  plannedQuarter?: number | null;
  plannedYear?: number | null;
  status: string;
  recommendation: {
    id: string;
    title: string;
    timeframe: string;
    strategicType: string;
    estimatedImpact: number;
    points: number;
  };
  contribution?: Contribution | null;
}

interface RoadmapSummary {
  total: number;
  completed: number;
  inProgress: number;
  baselineScore: number;
  baselinePercentage: number;
  currentScore: number;
  currentPercentage: number;
  delta: number;
  deltaPercentage: number;
}

/** Durum kümesi sunucuyla aynı (lib/roadmap-status.ts). */
const statusConfig = {
  NOT_STARTED: { label: 'Başlanmadı', color: 'var(--ui-passive)', icon: Clock },
  PLANNED: { label: 'Planlandı', color: 'var(--ui-passive)', icon: CalendarClock },
  IN_PROGRESS: { label: 'Devam ediyor', color: 'var(--blue-main)', icon: PlayCircle },
  COMPLETED: { label: 'Tamamlandı', color: 'var(--success)', icon: CheckCircle },
  CANCELLED: { label: 'İptal', color: 'var(--error)', icon: XCircle },
} as const;

type StatusKey = keyof typeof statusConfig;

const signed = (value: number, digits = 2) =>
  `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(digits)}`;

/** Satır altındaki katkı metni — sözleşmedeki gösterim. */
function contributionLine(item: RoadmapItem): { text: string; now: string | null } {
  const c = item.contribution;
  if (!c) return { text: "Katkı hesaplanıyor", now: null };
  const completed = item.status === "COMPLETED";
  const now = completed ? `şu an ${signed(c.current)}` : null;
  if (c.kind === "cascade") {
    const rung = c.rung ? `Basamak ${c.rung.index}/${c.rung.total} · ` : "";
    return { text: `${rung}tamamlanınca ${signed(c.full)}`, now };
  }
  return { text: `Tamamlanınca ${signed(c.full)}`, now };
}

export default function RoadmapClient() {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [summary, setSummary] = useState<RoadmapSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoadmap = async () => {
    try {
      const res = await fetch("/api/roadmap");
      if (res.ok) {
        const data = await res.json();
        setRoadmapItems(data?.items ?? []);
        setSummary(data?.summary ?? null);
      }
    } catch (error) {
      console.error("Error fetching roadmap:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

  const handleRemove = async (recommendationId: string) => {
    try {
      const res = await fetch(`/api/roadmap?recommendationId=${recommendationId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setRoadmapItems(prev => (prev ?? []).filter(item => item?.recommendationId !== recommendationId));
        toast.success("Öneri yol haritasından kaldırıldı");
        // Özet ve diğer kalemlerin katkısı sunucuda değişmiş olabilir.
        await fetchRoadmap();
      }
    } catch (error) {
      console.error("Error removing from roadmap:", error);
      toast.error("Öneri kaldırılamadı");
    }
  };

  const handleUpdateTiming = async (recommendationId: string, quarter: number, year: number) => {
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, plannedQuarter: quarter, plannedYear: year })
      });

      if (res.ok) {
        const updated = await res.json();
        // Zamanlama katkıyı değiştirmez; hesaplanmış katkı korunur.
        setRoadmapItems(prev =>
          (prev ?? []).map(item =>
            item?.recommendationId === recommendationId
              ? { ...item, ...updated, contribution: item.contribution }
              : item
          )
        );
        toast.success(`Ç${quarter} ${year} çeyreğine atandı`);
      }
    } catch (error) {
      console.error("Error updating timing:", error);
      toast.error("Çeyrek atanamadı");
    }
  };

  const handleUpdateStatus = async (recommendationId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/roadmap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, status: newStatus })
      });

      if (res.ok) {
        const data = await res.json();
        const statusLabel = statusConfig[newStatus as StatusKey]?.label || newStatus;
        const earned = typeof data?.earned === "number" ? data.earned : 0;
        toast.success(
          earned !== 0
            ? `Durum güncellendi: ${statusLabel} · puan ${signed(earned)}`
            : `Durum güncellendi: ${statusLabel}`
        );
        // Katkı ve özet sunucuda yeniden hesaplandı; tek kaynaktan okunur.
        await fetchRoadmap();
      } else {
        const payload = await res.json().catch(() => ({}));
        toast.error(payload?.error || "Durum güncellenemedi");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Durum güncellenemedi");
    }
  };

  const completedCount = summary?.completed ?? (roadmapItems ?? []).filter(item => item?.status === 'COMPLETED').length;
  const inProgressCount = summary?.inProgress ?? (roadmapItems ?? []).filter(item => item?.status === 'IN_PROGRESS').length;
  const delta = summary?.delta ?? 0;

  if (loading) {
    return (
      <>
        <AppShell />
        <main id="icerik" tabIndex={-1}>
          <div className="skeleton mb-6 h-8 w-64" />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <div className="skeleton h-[360px]" />
        </main>
      </>
    );
  }

  return (
    <>
      <AppShell />

      <main id="icerik" tabIndex={-1}>
        <PageHeader
          title="Yol haritası"
          subtitle="Önerileri takvime bağlayın, ilerlemeyi buradan izleyin."
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Yol haritasındaki öneri" value={roadmapItems?.length ?? 0} />
          {/* Sıfırken renk yok: pasif değer doygun renk almaz (DESIGN.md). */}
          <StatCard
            label="Tamamlanan"
            value={completedCount}
            note="puana katkı yapar"
            tone={completedCount > 0 ? "success" : "neutral"}
          />
          <StatCard
            label="Devam eden"
            value={inProgressCount}
            note="henüz katkı yapmaz"
            tone="neutral"
          />
          <StatCard
            label="Gelişim katkısı"
            value={signed(delta)}
            note={
              summary && delta !== 0
                ? `anket puanına eklenen · ${signed(summary.deltaPercentage, 1)} yüzde puanı`
                : "anket puanına eklenen"
            }
            tone={delta > 0 ? "success" : "neutral"}
          />
        </div>

        {(roadmapItems?.length ?? 0) > 0 && (
          <p className="mb-6 t-sm" style={{ color: "var(--ink-2)" }}>
            Katkı yalnızca <span style={{ color: "var(--ink)" }}>Tamamlandı</span> durumunda hesaplanır.
            Kademeli öneri, bağlı olduğu sorunun basamağını bir üst şıkka çıkarır; kademesiz öneri
            puanını doğrudan ekler.
            {summary && (
              <>
                {" "}Puan <span className="tabular" style={{ color: "var(--ink)" }}>{summary.currentScore.toFixed(1)}/5</span>,
                taban <span className="tabular" style={{ color: "var(--ink)" }}>{summary.baselineScore.toFixed(1)}/5</span>.
              </>
            )}
          </p>
        )}

        {/* Items List with Status */}
        {(roadmapItems?.length ?? 0) > 0 && (
          <Panel title="Öneri durumları" className="mb-6">
            <div className="flex flex-col">
              {(roadmapItems ?? []).map((item) => {
                const currentStatus = statusConfig[item?.status as StatusKey] || statusConfig.NOT_STARTED;
                const StatusIcon = currentStatus.icon;
                const line = contributionLine(item);

                return (
                  <div
                    key={item?.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2.5">
                      <StatusIcon size={16} className="mt-0.5 shrink-0" style={{ color: currentStatus.color }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate t-body" style={{ color: 'var(--ink)' }}>
                          {item?.recommendation?.title}
                        </p>
                        <p className="t-sm tabular" style={{ color: 'var(--ink-3)' }}>
                          {line.text}
                          {line.now && (
                            <span style={{ color: item.contribution && item.contribution.current > 0 ? 'var(--success)' : 'var(--ink-3)' }}>
                              {" "}· {line.now}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <label className="sr-only" htmlFor={`status-${item?.id}`}>
                      {item?.recommendation?.title} durumu
                    </label>
                    <select
                      id={`status-${item?.id}`}
                      value={item?.status || 'NOT_STARTED'}
                      onChange={(e) => handleUpdateStatus(item?.recommendationId, e.target.value)}
                      className="theme-select w-auto"
                    >
                      {(Object.keys(statusConfig) as StatusKey[]).map((key) => (
                        <option key={key} value={key}>{statusConfig[key].label}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* Timeline */}
        {(roadmapItems?.length ?? 0) > 0 ? (
          <Panel title="Zaman çizelgesi">
            <RoadmapTimeline
              items={roadmapItems}
              onRemove={handleRemove}
              onUpdateTiming={handleUpdateTiming}
            />
          </Panel>
        ) : (
          <EmptyState
            title="Yol haritası boş"
            description="Öneriler sayfasında bir öneriyi yol haritasına ekleyin; çeyrek ve sorumlu ataması burada yapılır."
            action={
              <Button asChild>
                <a href="/recommendations">Önerilere git</a>
              </Button>
            }
          />
        )}
      </main>
    </>
  );
}
