"use client";

import { motion } from "framer-motion";
import { X, Calendar, TrendingUp, GripVertical } from "lucide-react";
import { useState } from "react";

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
  QUICK_WIN: "var(--success)",
  BIG_BET: "#a855f7",
  PROJECT: "var(--blue-main)"
};

export default function RoadmapTimeline({ items, onRemove, onUpdateTiming }: RoadmapTimelineProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const getItemsForQuarter = (q: number, year: number) => {
    return (items ?? []).filter(item => 
      item?.plannedQuarter === q && item?.plannedYear === year
    );
  };

  const unassignedItems = (items ?? []).filter(item => 
    !item?.plannedQuarter || !item?.plannedYear
  );

  const handleDragStart = (e: React.DragEvent, recommendationId: string) => {
    setDraggedItem(recommendationId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, quarter: number, year: number) => {
    e.preventDefault();
    if (draggedItem) {
      onUpdateTiming(draggedItem, quarter, year);
      setDraggedItem(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const getBorderColor = (strategicType: string) => {
    return strategicColors[strategicType] || 'var(--ui-passive)';
  };

  return (
    <div className="space-y-8">
      {/* Unassigned Items */}
      {(unassignedItems?.length ?? 0) > 0 && (
        <div 
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--bg-card-2)' }}
        >
          <h3 
            className="text-lg font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--text-main)' }}
          >
            <Calendar size={20} style={{ color: 'var(--accent)' }} />
            Planlanmamış Öğeler ({unassignedItems?.length ?? 0})
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-dim)' }}>Öğeleri sürükleyip çeyreklere bırakabilirsiniz</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {unassignedItems?.map((item) => (
              <motion.div
                key={item?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                draggable
                onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, item?.recommendationId)}
                onDragEnd={handleDragEnd}
                className="rounded-lg p-4 shadow-sm cursor-grab active:cursor-grabbing"
                style={{ 
                  backgroundColor: 'var(--bg-card)', 
                  borderLeft: `4px solid ${getBorderColor(item?.recommendation?.strategicType ?? '')}`
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <GripVertical size={16} style={{ color: 'var(--ui-passive)' }} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm block truncate" style={{ color: 'var(--text-main)' }}>{item?.recommendation?.title ?? 'Başlıksız'}</span>
                      <span className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--success)' }}>
                        <TrendingUp size={12} /> +{item?.recommendation?.estimatedImpact ?? 0}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove?.(item?.recommendationId)}
                    className="p-1 rounded transition-colors flex-shrink-0 hover:bg-[var(--error-bg)]"
                    style={{ color: 'var(--ui-passive)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Timeline */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[900px]">
          {/* Timeline Header */}
          <div className="flex items-center mb-2">
            {quarters?.map((quarter, index) => (
              <div key={`${quarter?.q}-${quarter?.year}`} className="flex-1 relative">
                {/* Connecting line */}
                {index < quarters.length - 1 && (
                  <div 
                    className="absolute top-1/2 left-1/2 right-0 h-1 -translate-y-1/2 z-0"
                    style={{ background: 'linear-gradient(90deg, var(--blue-main), var(--accent))' }}
                  />
                )}
                {index > 0 && (
                  <div 
                    className="absolute top-1/2 left-0 right-1/2 h-1 -translate-y-1/2 z-0"
                    style={{ background: 'linear-gradient(90deg, var(--accent), var(--blue-main))' }}
                  />
                )}
                {/* Quarter circle */}
                <div className="relative z-10 flex justify-center">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-md border-4"
                    style={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--blue-main)' 
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: 'var(--blue-main)' }}>Ç{quarter?.q}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Year labels */}
          <div className="flex items-center mb-4">
            {quarters?.map((quarter) => (
              <div key={`label-${quarter?.q}-${quarter?.year}`} className="flex-1 text-center">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{quarter?.label}</span>
              </div>
            ))}
          </div>

          {/* Quarter columns */}
          <div className="flex gap-2">
            {quarters?.map((quarter) => {
              const quarterItems = getItemsForQuarter(quarter?.q, quarter?.year);
              const isDropTarget = draggedItem !== null;
              
              return (
                <motion.div
                  key={`col-${quarter?.q}-${quarter?.year}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, quarter?.q, quarter?.year)}
                  className="flex-1 min-h-[200px] rounded-xl p-3 border-2 border-dashed transition-all"
                  style={{ 
                    borderColor: isDropTarget ? 'var(--accent)' : 'var(--border-soft)',
                    backgroundColor: isDropTarget ? 'var(--accent-tint)' : 'var(--bg-card-2)'
                  }}
                >
                  {(quarterItems?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {quarterItems?.map((item) => (
                        <motion.div
                          key={item?.id}
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, item?.recommendationId)}
                          onDragEnd={handleDragEnd}
                          className="rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing"
                          style={{ 
                            backgroundColor: 'var(--bg-card)', 
                            borderLeft: `4px solid ${getBorderColor(item?.recommendation?.strategicType ?? '')}`
                          }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-start gap-1 flex-1 min-w-0">
                              <GripVertical size={14} style={{ color: 'var(--ui-passive)' }} className="mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-xs block leading-tight" style={{ color: 'var(--text-main)' }}>{item?.recommendation?.title ?? 'Başlıksız'}</span>
                                <span className="text-xs flex items-center gap-0.5 mt-1" style={{ color: 'var(--success)' }}>
                                  <TrendingUp size={10} /> +{item?.recommendation?.estimatedImpact ?? 0}%
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => onRemove?.(item?.recommendationId)}
                              className="p-0.5 rounded transition-colors flex-shrink-0 hover:bg-[var(--error-bg)]"
                              style={{ color: 'var(--ui-passive)' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-dim)' }}>
                      {isDropTarget ? 'Buraya bırakın' : 'Boş'}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--success)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Hızlı Kazanım</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#a855f7' }} />
              <span style={{ color: 'var(--text-muted)' }}>Büyük Bahis</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--blue-main)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Proje</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
