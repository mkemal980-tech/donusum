"use client";

import { motion } from "framer-motion";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
  showOverallLevel?: boolean;
}

const levels = [
  { value: 5, label: "Lider", color: "#22c55e" },
  { value: 4, label: "Olgun", color: "#3b82f6" },
  { value: 3, label: "Gelişen", color: "#a78bfa" },
  { value: 2, label: "Farkındalık", color: "#f59e0b" },
  { value: 1, label: "Başlangıç", color: "#ef4444" },
];

export const getScoreLevel = (score: number): { label: string; color: string } => {
  if (score >= 4.5) return { label: "Lider", color: "#22c55e" };
  if (score >= 3.5) return { label: "Olgun", color: "#3b82f6" };
  if (score >= 2.5) return { label: "Gelişen", color: "#a78bfa" };
  if (score >= 1.5) return { label: "Farkındalık", color: "#f59e0b" };
  return { label: "Başlangıç", color: "#ef4444" };
};

export function MaturityGauge({ score, title = "Seviyelendirme", showOverallLevel = false }: MaturityGaugeProps) {
  // Calculate position (0 = bottom, 100 = top)
  const position = Math.max(0, Math.min(100, ((score - 1) / 4) * 100));
  const currentLevel = getScoreLevel(score);
  
  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      
      {showOverallLevel && (
        <div className="mb-6 text-center">
          <div 
            className="inline-block px-4 py-2 rounded-full text-white font-semibold text-lg"
            style={{ backgroundColor: currentLevel.color }}
          >
            {currentLevel.label}
          </div>
        </div>
      )}
      
      <div className="flex items-stretch gap-6 h-[280px]">
        {/* Labels */}
        <div className="flex flex-col justify-between py-2">
          {levels.map((level) => (
            <div key={level.value} className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-gray-600 text-sm font-medium w-20">{level.label}</span>
              <span className="text-gray-400 text-sm">{level.value}</span>
            </div>
          ))}
        </div>
        
        {/* Gauge Bar */}
        <div className="relative flex-1 max-w-[50px]">
          {/* Background track */}
          <div className="absolute inset-0 bg-gradient-to-t from-red-200 via-purple-200 to-green-200 rounded-full opacity-40" />
          
          {/* Level lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-dashed border-gray-300 w-full" />
            ))}
          </div>
          
          {/* Progress bar */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 rounded-full"
            style={{ 
              background: `linear-gradient(to top, #ef4444, #f59e0b, #a78bfa, #3b82f6, #22c55e)`,
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
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-4 border-white"
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
