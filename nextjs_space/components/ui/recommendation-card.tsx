"use client";

import { motion } from "framer-motion";
import { Clock, DollarSign, Target, Plus, Check, TrendingUp } from "lucide-react";

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
  };
  onAddToRoadmap?: (id: string) => void;
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

export default function RecommendationCard({ recommendation, onAddToRoadmap }: RecommendationCardProps) {
  const rec = recommendation ?? {};
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl shadow-md p-6 card-hover border border-gray-100"
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-4">{rec?.title ?? 'Başlıksız'}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${strategicColors[rec?.strategicType ?? ''] ?? 'bg-gray-100 text-gray-700'}`}>
          {strategicLabels[rec?.strategicType ?? ''] ?? rec?.strategicType ?? 'Bilinmiyor'}
        </span>
      </div>
      
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
