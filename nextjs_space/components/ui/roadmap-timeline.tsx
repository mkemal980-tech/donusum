"use client";

import { motion } from "framer-motion";
import { X, Calendar, TrendingUp } from "lucide-react";

interface RoadmapItem {
  id: string;
  recommendationId: string;
  plannedQuarter?: number | null;
  plannedYear?: number | null;
  recommendation: {
    id: string;
    title: string;
    timeframe: string;
    strategicType: string;
    estimatedImpact: number;
  };
}

interface RoadmapTimelineProps {
  items: RoadmapItem[];
  onRemove: (recommendationId: string) => void;
  onUpdateTiming: (recommendationId: string, quarter: number, year: number) => void;
}

const currentYear = 2026;
const quarters = [
  { q: 1, year: currentYear, label: "Ç1 2026" },
  { q: 2, year: currentYear, label: "Ç2 2026" },
  { q: 3, year: currentYear, label: "Ç3 2026" },
  { q: 4, year: currentYear, label: "Ç4 2026" },
  { q: 1, year: currentYear + 1, label: "Ç1 2027" },
  { q: 2, year: currentYear + 1, label: "Ç2 2027" },
];

const strategicColors: Record<string, string> = {
  QUICK_WIN: "bg-green-500",
  BIG_BET: "bg-purple-500",
  PROJECT: "bg-[#1e3a8a]"
};

export default function RoadmapTimeline({ items, onRemove, onUpdateTiming }: RoadmapTimelineProps) {
  const getItemsForQuarter = (q: number, year: number) => {
    return (items ?? []).filter(item => 
      item?.plannedQuarter === q && item?.plannedYear === year
    );
  };

  const unassignedItems = (items ?? []).filter(item => 
    !item?.plannedQuarter || !item?.plannedYear
  );

  return (
    <div className="space-y-8">
      {/* Unassigned Items */}
      {(unassignedItems?.length ?? 0) > 0 && (
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Planlanmamış Öğeler ({unassignedItems?.length ?? 0})
          </h3>
          <div className="grid gap-3">
            {unassignedItems?.map((item) => (
              <motion.div
                key={item?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${strategicColors[item?.recommendation?.strategicType ?? ''] ?? 'bg-gray-400'}`} />
                  <span className="font-medium text-gray-800">{item?.recommendation?.title ?? 'Başlıksız'}</span>
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <TrendingUp size={14} /> +{item?.recommendation?.estimatedImpact ?? 0}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border rounded-lg px-3 py-2 bg-white"
                    defaultValue=""
                    onChange={(e) => {
                      const [q, y] = (e.target.value ?? '').split('-').map(Number);
                      if (q && y) onUpdateTiming?.(item?.recommendationId, q, y);
                    }}
                  >
                    <option value="">Çeyreğe ata...</option>
                    {quarters?.map((quarter) => (
                      <option key={`${quarter?.q}-${quarter?.year}`} value={`${quarter?.q}-${quarter?.year}`}>
                        {quarter?.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemove?.(item?.recommendationId)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#1e3a8a] to-[#a78bfa]" />
        
        <div className="space-y-8">
          {quarters?.map((quarter, index) => {
            const quarterItems = getItemsForQuarter(quarter?.q, quarter?.year);
            return (
              <motion.div
                key={`${quarter?.q}-${quarter?.year}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative pl-20"
              >
                <div className="absolute left-6 w-5 h-5 rounded-full bg-white border-4 border-[#1e3a8a] z-10" />
                <div className="absolute left-0 top-0 text-sm font-semibold text-[#1e3a8a] w-16 text-right pr-2">
                  {quarter?.label}
                </div>
                
                <div className="bg-white rounded-xl shadow-md p-4 min-h-[60px] border border-gray-100">
                  {(quarterItems?.length ?? 0) === 0 ? (
                    <p className="text-gray-400 text-sm">Planlanmış öğe yok</p>
                  ) : (
                    <div className="space-y-2">
                      {quarterItems?.map((item) => (
                        <div
                          key={item?.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${strategicColors[item?.recommendation?.strategicType ?? ''] ?? 'bg-gray-400'}`} />
                            <span className="font-medium text-gray-800">{item?.recommendation?.title ?? 'Başlıksız'}</span>
                            <span className="text-sm text-green-600">+{item?.recommendation?.estimatedImpact ?? 0}%</span>
                          </div>
                          <button
                            onClick={() => onRemove?.(item?.recommendationId)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}        </div>
      </div>
    </div>
  );
}
