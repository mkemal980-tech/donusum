"use client";

import { motion } from "framer-motion";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
  showOverallLevel?: boolean;
}

const levels = [
  { value: 5, label: "Lider", color: "#22c55e" },
  { value: 4, label: "Olgun", color: "#6366f1" },
  { value: 3, label: "Gelişen", color: "#8b5cf6" },
  { value: 2, label: "Farkındalık", color: "#f59e0b" },
  { value: 1, label: "Başlangıç", color: "#ef4444" },
];

export const getScoreLevel = (score: number): { label: string; color: string } => {
  if (score >= 4.5) return { label: "Lider", color: "#22c55e" };
  if (score >= 3.5) return { label: "Olgun", color: "#6366f1" };
  if (score >= 2.5) return { label: "Gelişen", color: "#8b5cf6" };
  if (score >= 1.5) return { label: "Farkındalık", color: "#f59e0b" };
  return { label: "Başlangıç", color: "#ef4444" };
};

export function MaturityGauge({ score, title = "Seviyelendirme", showOverallLevel = false }: MaturityGaugeProps) {
  // Calculate position (0 = bottom, 100 = top)
  const position = Math.max(0, Math.min(100, ((score - 1) / 4) * 100));
  const currentLevel = getScoreLevel(score);
  
  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 h-full">
      <h3 className="text-lg font-semibold text-primary-900 mb-4">{title}</h3>
      
      {showOverallLevel && (
        <div className="mb-6 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-block px-6 py-3 rounded-2xl text-white font-bold text-lg shadow-lg"
            style={{ backgroundColor: currentLevel.color }}
          >
            {currentLevel.label}
          </motion.div>
        </div>
      )}
      
      <div className="flex items-stretch gap-6 h-[280px]">
        {/* Labels */}
        <div className="flex flex-col justify-between py-2">
          {levels.map((level) => (
            <div key={level.value} className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-lg shadow-sm"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-gray-700 text-sm font-medium w-24">{level.label}</span>
              <span className="text-primary-400 text-sm font-semibold">{level.value}</span>
            </div>
          ))}
        </div>
        
        {/* Gauge Bar */}
        <div className="relative flex-1 max-w-[50px]">
          {/* Background track */}
          <div className="absolute inset-0 bg-gradient-to-t from-error-100 via-secondary-100 to-success-100 rounded-2xl" />
          
          {/* Level lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-dashed border-white/50 w-full" />
            ))}
          </div>
          
          {/* Progress bar */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 rounded-2xl"
            style={{ 
              background: `linear-gradient(to top, #ef4444, #f59e0b, #8b5cf6, #6366f1, #22c55e)`,
              minHeight: score > 0 ? "20px" : "0px"
            }}
          />
          
          {/* Score indicator circle */}
          <motion.div
            initial={{ bottom: 0 }}
            animate={{ bottom: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border-4 border-white"
              style={{ backgroundColor: currentLevel.color }}
            >
              <span className="text-lg font-bold text-white">{score.toFixed(1)}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
