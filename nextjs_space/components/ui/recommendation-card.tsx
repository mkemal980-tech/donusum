"use client";

import { motion } from "framer-motion";
import { Clock, DollarSign, Target, Plus, Check, TrendingUp, Play, CheckCircle2, Circle, MoreHorizontal, Video, ExternalLink, Lock } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type CompletionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface RecommendationCardProps {
  recommendation: {
    id: string;
    title: string;
    description: string;
    videoUrl?: string | null;
    costType: string;
    timeframe: string;
    strategicType: string;
    estimatedImpact: number;
    isInRoadmap?: boolean;
    completionStatus?: CompletionStatus;
    /** 0 = sıradaki adım, >0 = henüz kilitli, <0 = geçilmiş basamak. */
    stepDistance?: number;
    /** Yumuşak kilit: sırası gelmemiş basamak ilerletilemez. */
    isActionable?: boolean;
  };
  onAddToRoadmap?: (id: string) => void;
  onStatusChange?: (id: string, status: CompletionStatus) => void;
}

const timeframeLabels: Record<string, string> = {
  SHORT_TERM: "Kısa Vade (0-6 ay)",
  MEDIUM_TERM: "Orta Vade (6-18 ay)",
  LONG_TERM: "Uzun Vade (18+ ay)"
};

const strategicColors: Record<string, string> = {
  QUICK_WIN: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  BIG_BET: "bg-[var(--accent-quiet)] text-[var(--accent-ink)]",
  PROJECT: "bg-[var(--info-bg)] text-[var(--accent-ink)]"
};

const strategicLabels: Record<string, string> = {
  QUICK_WIN: "Hızlı Kazanım",
  BIG_BET: "Büyük Yatırım",
  PROJECT: "Proje"
};

const statusConfig: Record<CompletionStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  NOT_STARTED: { 
    label: "Başlanmadı", 
    color: "text-[var(--text-dim)]", 
    bgColor: "bg-[var(--bg-card-2)]",
    icon: Circle 
  },
  IN_PROGRESS: { 
    label: "Devam Ediyor", 
    color: "text-[var(--warning)]", 
    bgColor: "bg-[var(--warning-bg)]",
    icon: Play 
  },
  COMPLETED: { 
    label: "Tamamlandı", 
    color: "text-[var(--accent)]", 
    bgColor: "bg-[var(--accent-soft)]",
    icon: CheckCircle2 
  }
};

export default function RecommendationCard({ recommendation, onAddToRoadmap, onStatusChange }: RecommendationCardProps) {
  const rec = recommendation ?? {};
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentStatus = rec?.completionStatus || 'NOT_STARTED';
  const statusInfo = statusConfig[currentStatus];
  const StatusIcon = statusInfo.icon;
  // Sunucu `isActionable` göndermezse (kademesiz öneri) kilit uygulanmaz.
  const locked = rec?.isActionable === false;
  const stepDistance = rec?.stepDistance ?? 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusClick = (status: CompletionStatus) => {
    // Kilitliyken yalnızca başa alma serbest — sunucu da aynı kuralı uygular.
    if (locked && status !== 'NOT_STARTED') {
      setShowStatusMenu(false);
      return;
    }
    if (onStatusChange && rec?.id) {
      onStatusChange(rec.id, status);
    }
    setShowStatusMenu(false);
  };
  
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`theme-card p-6 border-2 transition-colors ${
        locked ? 'opacity-60 ' : ''
      }${
        currentStatus === 'COMPLETED' 
          ? 'border-[var(--accent)] bg-[var(--accent-tint)]' 
          : currentStatus === 'IN_PROGRESS' 
            ? 'border-[var(--warning)]/50 bg-[rgba(245,158,11,0.05)]' 
            : 'border-[var(--border-soft)]'
      }`}
    >
      {/* Kademe durumu — sıradaki adım vurgulanır, üst basamaklar kilitli */}
      {locked ? (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--text-dim)]">
          <Lock size={13} />
          <span>
            {stepDistance === 1
              ? 'Bir sonraki basamak — önce mevcut adımı tamamlayın'
              : `${stepDistance} basamak sonra`}
          </span>
        </div>
      ) : stepDistance === 0 && rec?.stepDistance !== undefined ? (
        <div className="inline-flex items-center gap-1.5 mb-3 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-soft)] text-[var(--accent-ink)]">
          <Target size={13} />
          Sıradaki adım
        </div>
      ) : null}

      {/* Header with Strategic Type and Status */}
      <div className="flex justify-between items-start mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${strategicColors[rec?.strategicType ?? ''] ?? 'bg-[var(--bg-card-2)] text-[var(--text-muted)]'}`}>
          {strategicLabels[rec?.strategicType ?? ''] ?? rec?.strategicType ?? 'Bilinmiyor'}
        </span>
        
        {/* Status Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusInfo.bgColor} ${statusInfo.color} hover:opacity-80`}
          >
            <StatusIcon size={14} />
            <span>{statusInfo.label}</span>
            <MoreHorizontal size={12} className="ml-1" />
          </button>
          
          {showStatusMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] rounded-lg shadow-lg border border-[var(--border-soft)] z-50 min-w-[160px]">
              {(Object.keys(statusConfig) as CompletionStatus[]).map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusClick(status)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-card-2)] transition-colors ${
                      currentStatus === status ? 'bg-[var(--bg-card-2)] font-medium' : ''
                    } ${config.color}`}
                  >
                    <Icon size={16} />
                    <span>{config.label}</span>
                    {currentStatus === status && <Check size={14} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <h3 className={`text-lg font-semibold mb-3 ${currentStatus === 'COMPLETED' ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'}`}>
        {rec?.title ?? 'Başlıksız'}
      </h3>
      
      <p className="text-[var(--text-muted)] text-sm mb-4 line-clamp-2">{rec?.description ?? ''}</p>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
          <Clock size={14} className="text-[var(--accent)]" />
          <span>{timeframeLabels[rec?.timeframe ?? ''] ?? rec?.timeframe ?? 'Belirsiz'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
          <DollarSign size={14} className="text-[var(--blue-main)]" />
          <span>{rec?.costType ?? 'Belirsiz'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
          <TrendingUp size={14} className="text-[var(--accent)]" />
          <span>+{rec?.estimatedImpact ?? 0}% etki</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
          <Target size={14} className="text-[var(--warning)]" />
          <span>Puan artışı</span>
        </div>
      </div>

      {/* Nasıl Yapılır Öğrenin - Video Linki */}
      {rec?.videoUrl && (
        <a
          href={rec.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 mb-3 rounded-lg font-medium bg-gradient-to-r from-[var(--error)] to-[var(--accent-bright)] text-white hover:from-[var(--error)] hover:to-[var(--accent)] transition-all shadow-sm hover:shadow-md"
        >
          <Video size={18} />
          <span>Nasıl Yapılır Öğrenin!</span>
          <ExternalLink size={14} />
        </a>
      )}
      
      <button
        onClick={() => onAddToRoadmap?.(rec?.id)}
        disabled={rec?.isInRoadmap || locked}
        title={locked ? "Önce bir önceki basamağı tamamlayın" : undefined}
        className={`w-full py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          rec?.isInRoadmap
            ? "bg-[var(--accent-soft)] text-[var(--accent-ink)] cursor-default"
            : locked
              ? "bg-[var(--bg-card-2)] text-[var(--text-dim)] cursor-not-allowed"
              : "bg-[var(--accent)] text-[var(--bg-deep)] hover:bg-[var(--accent-bright)]"
        }`}
      >
        {rec?.isInRoadmap ? (
          <><Check size={16} /> Yol Haritasında</>
        ) : locked ? (
          <><Lock size={16} /> Sırası Gelmedi</>
        ) : (
          <><Plus size={16} /> Yol Haritasına Ekle</>
        )}
      </button>
    </motion.div>
  );
}
