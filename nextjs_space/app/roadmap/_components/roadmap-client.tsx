"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Header from "@/components/ui/header";
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
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-main)' }}>
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div 
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" 
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-main)' }}>
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 
            className="text-3xl font-bold mb-2 flex items-center gap-3"
            style={{ color: 'var(--text-main)' }}
          >
            <Map style={{ color: 'var(--accent)' }} />
            Dönüşüm Yol Haritası
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Dönüşüm yolculuğunuzu planlayın ve ilerleyişinizi takip edin</p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl shadow-lg p-5 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-soft)' }}
              >
                <Calendar style={{ color: 'var(--accent)' }} size={20} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Toplam</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{roadmapItems?.length ?? 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl shadow-lg p-5 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--success-bg)' }}
              >
                <CheckCircle style={{ color: 'var(--success)' }} size={20} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Tamamlanan</p>
                <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>{completedCount}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl shadow-lg p-5 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--info-bg)' }}
              >
                <PlayCircle style={{ color: 'var(--blue-main)' }} size={20} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Devam Eden</p>
                <p className="text-xl font-bold" style={{ color: 'var(--blue-main)' }}>{inProgressCount}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl shadow-lg p-5 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-soft)' }}
              >
                <TrendingUp style={{ color: 'var(--accent)' }} size={20} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>Gelişim Katkısı</p>
                <p className="text-xl font-bold" style={{ color: 'var(--accent)' }}>+{calculateProgressContribution()}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Status Update Info */}
        {(roadmapItems?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl p-4 mb-8 flex items-start gap-3 border"
            style={{ 
              backgroundColor: 'var(--accent-soft)', 
              borderColor: 'var(--accent-glow)' 
            }}
          >
            <Info style={{ color: 'var(--accent)' }} className="mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="font-medium" style={{ color: 'var(--accent)' }}>İlerleme Takibi</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Önerilerin durumunu değiştirdikçe gelişim skorunuz otomatik güncellenir. 
                <span className="font-semibold" style={{ color: 'var(--warning)' }}> "Devam Ediyor" %50</span>, 
                <span className="font-semibold" style={{ color: 'var(--success)' }}> "Tamamlandı" %100</span> katkı sağlar.
              </p>
            </div>
          </motion.div>
        )}

        {/* Items List with Status */}
        {(roadmapItems?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl shadow-lg p-6 mb-8 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Öneri Durumları</h3>
            <div className="space-y-3">
              {(roadmapItems ?? []).map((item) => {
                const currentStatus = statusConfig[item?.status as keyof typeof statusConfig] || statusConfig.NOT_STARTED;
                const StatusIcon = currentStatus.icon;
                
                return (
                  <div 
                    key={item?.id} 
                    className="flex items-center justify-between p-4 rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--bg-card-2)' }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <StatusIcon size={20} style={{ color: currentStatus.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate" style={{ color: 'var(--text-main)' }}>{item?.recommendation?.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          Puan: <span className="font-semibold" style={{ color: 'var(--accent)' }}>+{item?.recommendation?.points?.toFixed(1) || '0.5'}</span>
                          {item?.status === 'IN_PROGRESS' && <span className="ml-2" style={{ color: 'var(--blue-main)' }}>(şu an +{((item?.recommendation?.points || 0.5) * 0.5).toFixed(2)})</span>}
                          {item?.status === 'COMPLETED' && <span className="ml-2" style={{ color: 'var(--success)' }}>(şu an +{(item?.recommendation?.points || 0.5).toFixed(2)})</span>}
                        </p>
                      </div>
                    </div>
                    
                    <select
                      value={item?.status || 'NOT_STARTED'}
                      onChange={(e) => handleUpdateStatus(item?.recommendationId, e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm font-medium border-0 cursor-pointer"
                      style={{ 
                        backgroundColor: currentStatus.bgColor, 
                        color: currentStatus.color 
                      }}
                    >
                      <option value="NOT_STARTED">Başlanmadı</option>
                      <option value="IN_PROGRESS">Devam Ediyor</option>
                      <option value="COMPLETED">Tamamlandı</option>
                      <option value="CANCELLED">İptal</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Timeline */}
        {(roadmapItems?.length ?? 0) > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl shadow-lg p-8 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Zaman Çizelgesi</h3>
            <RoadmapTimeline
              items={roadmapItems}
              onRemove={handleRemove}
              onUpdateTiming={handleUpdateTiming}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl shadow-lg p-16 text-center border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)' }}
          >
            <Map size={64} className="mx-auto mb-4" style={{ color: 'var(--ui-passive)' }} />
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-main)' }}>Henüz Yol Haritası Öğesi Yok</h2>
            <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Öneriler sayfasından yol haritanıza öneri ekleyin</p>
            <a
              href="/recommendations"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors"
              style={{ 
                backgroundColor: 'var(--accent)', 
                color: 'var(--bg-deep)',
                boxShadow: '0 0 20px var(--accent-glow)'
              }}
            >
              Önerilere Göz At
            </a>
          </motion.div>
        )}
      </main>
    </div>
  );
}
