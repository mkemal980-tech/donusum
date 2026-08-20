"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import EmptyState from "@/components/ui/empty-state";
import Panel from "@/components/ui/panel";
import StatCard from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import RoadmapTimeline from "@/components/ui/roadmap-timeline";
import { Map, TrendingUp, Calendar, Info, CheckCircle, Clock, PlayCircle, XCircle } from "lucide-react";

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
}

const statusConfig = {
  NOT_STARTED: { label: 'Başlanmadı', color: 'var(--ui-passive)', bgColor: 'var(--bg-card-2)', icon: Clock, contribution: 0 },
  IN_PROGRESS: { label: 'Devam Ediyor', color: 'var(--blue-main)', bgColor: 'var(--info-bg)', icon: PlayCircle, contribution: 50 },
  COMPLETED: { label: 'Tamamlandı', color: 'var(--success)', bgColor: 'var(--success-bg)', icon: CheckCircle, contribution: 100 },
  CANCELLED: { label: 'İptal', color: 'var(--error)', bgColor: 'var(--error-bg)', icon: XCircle, contribution: 0 },
};

export default function RoadmapClient() {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoadmap = async () => {
    try {
      const res = await fetch("/api/roadmap");
      if (res.ok) {
        const data = await res.json();
        setRoadmapItems(data ?? []);
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
        setRoadmapItems(prev => 
          (prev ?? []).map(item => 
            item?.recommendationId === recommendationId ? updated : item
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
        const updated = await res.json();
        setRoadmapItems(prev => 
          (prev ?? []).map(item => 
            item?.recommendationId === recommendationId ? updated : item
          )
        );
        const statusLabel = statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus;
        toast.success(`Durum güncellendi: ${statusLabel}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Durum güncellenemedi");
    }
  };

  const totalImpact = (roadmapItems ?? []).reduce((sum, item) => 
    sum + (item?.recommendation?.estimatedImpact ?? 0), 0
  );

  const calculateProgressContribution = () => {
    let totalContribution = 0;
    (roadmapItems ?? []).forEach(item => {
      const config = statusConfig[item?.status as keyof typeof statusConfig];
      const multiplier = config?.contribution ?? 0;
      const points = item?.recommendation?.points ?? 0;
      totalContribution += (points * multiplier / 100);
    });
    return totalContribution.toFixed(2);
  };

  const completedCount = (roadmapItems ?? []).filter(item => item?.status === 'COMPLETED').length;
  const inProgressCount = (roadmapItems ?? []).filter(item => item?.status === 'IN_PROGRESS').length;
  const scheduledItems = (roadmapItems ?? []).filter(item => item?.plannedQuarter && item?.plannedYear);

  if (loading) {
    return (
      <>
        <AppShell />
        <main>
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

      <main>
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
            note="puana tam katkı"
            tone={completedCount > 0 ? "success" : "neutral"}
          />
          <StatCard
            label="Devam eden"
            value={inProgressCount}
            note="puana yarım katkı"
            tone={inProgressCount > 0 ? "accent" : "neutral"}
          />
          <StatCard
            label="Gelişim katkısı"
            value={`+${calculateProgressContribution()}`}
            note="anket puanına eklenen"
          />
        </div>

        {/* Status Update Info */}
        {(roadmapItems?.length ?? 0) > 0 && (
          <p className="mb-6 t-sm" style={{ color: "var(--ink-2)" }}>
            Durum değiştikçe gelişim puanı kendiliğinden güncellenir:{" "}
            <span style={{ color: "var(--ink)" }}>devam ediyor</span> %50,{" "}
            <span style={{ color: "var(--ink)" }}>tamamlandı</span> %100 katkı sağlar.
          </p>
        )}

        {/* Items List with Status */}
        {(roadmapItems?.length ?? 0) > 0 && (
          <Panel title="Öneri durumları" className="mb-6">
            <div className="flex flex-col">
              {(roadmapItems ?? []).map((item) => {
                const currentStatus = statusConfig[item?.status as keyof typeof statusConfig] || statusConfig.NOT_STARTED;
                const StatusIcon = currentStatus.icon;
                
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
                          Tam katkı +{item?.recommendation?.points?.toFixed(1) || '0.5'}
                          {item?.status === 'IN_PROGRESS' && (
                            <span style={{ color: 'var(--accent)' }}>
                              {" "}· şu an +{((item?.recommendation?.points || 0.5) * 0.5).toFixed(2)}
                            </span>
                          )}
                          {item?.status === 'COMPLETED' && (
                            <span style={{ color: 'var(--success)' }}>
                              {" "}· şu an +{(item?.recommendation?.points || 0.5).toFixed(2)}
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
                      <option value="NOT_STARTED">Başlanmadı</option>
                      <option value="IN_PROGRESS">Devam ediyor</option>
                      <option value="COMPLETED">Tamamlandı</option>
                      <option value="CANCELLED">İptal</option>
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
