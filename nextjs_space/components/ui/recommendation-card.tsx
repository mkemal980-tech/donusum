"use client";

import { motion } from "framer-motion";
import { Clock, DollarSign, Target, Plus, Check, TrendingUp, Play, CheckCircle2, Circle, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type CompletionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface RecommendationCardProps {
  recommendation: {
    id: string;
    title: string;
    description: string;
    costType: string;
    timeframe: string;
    strategicType: string;
    estimatedImpact: number;
    isInRoadmap?: boolean;
    completionStatus?: CompletionStatus;
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
  QUICK_WIN: "bg-green-100 text-green-700",
  BIG_BET: "bg-purple-100 text-purple-700",
  PROJECT: "bg-blue-100 text-blue-700"
};

const strategicLabels: Record<string, string> = {
  QUICK_WIN: "Hızlı Kazanım",
  BIG_BET: "Büyük Yatırım",
  PROJECT: "Proje"
};

const statusConfig: Record<CompletionStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  NOT_STARTED: { 
    label: "Başlanmadı", 
    color: "text-gray-500", 
    bgColor: "bg-gray-100",
    icon: Circle 
  },
  IN_PROGRESS: { 
    label: "Devam Ediyor", 
    color: "text-amber-600", 
    bgColor: "bg-amber-100",
    icon: Play 
  },
  COMPLETED: { 
    label: "Tamamlandı", 
    color: "text-green-600", 
    bgColor: "bg-green-100",
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
    if (onStatusChange && rec?.id) {
      onStatusChange(rec.id, status);
    }
    setShowStatusMenu(false);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-xl shadow-md p-6 card-hover border-2 transition-colors ${
        currentStatus === 'COMPLETED' 
          ? 'border-green-200 bg-green-50/30' 
          : currentStatus === 'IN_PROGRESS' 
            ? 'border-amber-200 bg-amber-50/30' 
            : 'border-gray-100'
      }`}
    >
      {/* Header with Strategic Type and Status */}
      <div className="flex justify-between items-start mb-3">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${strategicColors[rec?.strategicType ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
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
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-50 min-w-[160px]">
              {(Object.keys(statusConfig) as CompletionStatus[]).map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusClick(status)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      currentStatus === status ? 'bg-gray-50 font-medium' : ''
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

      <h3 className={`text-lg font-semibold mb-3 ${currentStatus === 'COMPLETED' ? 'text-green-800' : 'text-gray-900'}`}>
        {rec?.title ?? 'Başlıksız'}
      </h3>
      
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{rec?.description ?? ''}</p>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock size={14} className="text-[#a78bfa]" />
          <span>{timeframeLabels[rec?.timeframe ?? ''] ?? rec?.timeframe ?? 'Belirsiz'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <DollarSign size={14} className="text-[#1e3a8a]" />
          <span>{rec?.costType ?? 'Belirsiz'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <TrendingUp size={14} className="text-green-500" />
          <span>+{rec?.estimatedImpact ?? 0}% etki</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Target size={14} className="text-orange-500" />
          <span>Puan artışı</span>
        </div>
      </div>
      
      <button
        onClick={() => onAddToRoadmap?.(rec?.id)}
        disabled={rec?.isInRoadmap}
        className={`w-full py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
          rec?.isInRoadmap
            ? "bg-green-100 text-green-700 cursor-default"
            : "bg-[#1e3a8a] text-white hover:bg-[#3b5998]"
        }`}
      >
        {rec?.isInRoadmap ? (
          <><Check size={16} /> Yol Haritasında</>
        ) : (
          <><Plus size={16} /> Yol Haritasına Ekle</>
        )}
      </button>
    </motion.div>
  );
}
