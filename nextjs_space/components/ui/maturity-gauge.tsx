"use client";

import { motion } from "framer-motion";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
  showOverallLevel?: boolean;
}

// Template-matching cyan/teal colors
const levels = [
  { value: 5, label: "Lider", lightColor: "#0891b2", darkColor: "#22d3ee", minPercent: 80 },
  { value: 4, label: "Olgun", lightColor: "#0d9488", darkColor: "#2dd4bf", minPercent: 60 },
  { value: 3, label: "Gelişen", lightColor: "#0ea5e9", darkColor: "#38bdf8", minPercent: 40 },
  { value: 2, label: "Farkındalık", lightColor: "#14b8a6", darkColor: "#5eead4", minPercent: 20 },
  { value: 1, label: "Başlangıç", lightColor: "#06b6d4", darkColor: "#67e8f9", minPercent: 0 },
];

/**
 * Yeni Puanlama Sistemi:
 * - Puan = (Yüzde / 100) × 4 + 1
 * - %0 → 1.0 puan
 * - %100 → 5.0 puan
 */
export const getScoreLevel = (score: number): { label: string; color: string; darkColor: string } => {
  const percentage = ((score - 1) / 4) * 100;
  
  if (percentage >= 80) return { label: "Lider", color: "#0891b2", darkColor: "#22d3ee" };
  if (percentage >= 60) return { label: "Olgun", color: "#0d9488", darkColor: "#2dd4bf" };
  if (percentage >= 40) return { label: "Gelişen", color: "#0ea5e9", darkColor: "#38bdf8" };
  if (percentage >= 20) return { label: "Farkındalık", color: "#14b8a6", darkColor: "#5eead4" };
  return { label: "Başlangıç", color: "#06b6d4", darkColor: "#67e8f9" };
};

export const percentageToScore = (percentage: number): number => {
  return (percentage / 100) * 4 + 1;
};

export const scoreToPercentage = (score: number): number => {
  return ((score - 1) / 4) * 100;
};

export function MaturityGauge({ score, title = "Seviyelendirme", showOverallLevel = false }: MaturityGaugeProps) {
  const position = Math.max(0, Math.min(100, ((score - 1) / 4) * 100));
  const currentLevel = getScoreLevel(score);
  
  return (
    <div className="bg-[var(--bg-card)]  rounded-2xl shadow-soft  p-6 h-full border border-[var(--border-soft)]  transition-colors duration-300">
      <h3 className="text-lg font-semibold text-[var(--text-main)]  mb-4">{title}</h3>
      
      {showOverallLevel && (
        <div className="mb-6 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-block px-6 py-3 rounded-2xl text-white font-bold text-lg shadow-lg "
            style={{ backgroundColor: currentLevel.color }}
          >
            <span className="">{currentLevel.label}</span>
            <span className="hidden " style={{ color: 'white' }}>{currentLevel.label}</span>
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
                style={{ backgroundColor: level.lightColor }}
              />
              <span className="text-[var(--text-muted)]  text-sm font-medium w-24">{level.label}</span>
              <span className="text-primary-500  text-sm font-semibold">{level.value}</span>
            </div>
          ))}
        </div>
        
        {/* Gauge Bar */}
        <div className="relative flex-1 max-w-[50px]">
          {/* Background track */}
          <div 
            className="absolute inset-0 rounded-2xl bg-gradient-to-t from-gray-100 to-gray-200  " 
          />
          
          {/* Level lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-dashed border-white/30  w-full" />
            ))}
          </div>
          
          {/* Progress bar */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 rounded-2xl bg-gradient-to-t from-cyan-300 via-cyan-400 to-cyan-500   "
            style={{ minHeight: score > 1 ? "20px" : "0px" }}
          />
          
          {/* Score indicator circle */}
          <motion.div
            initial={{ bottom: 0 }}
            animate={{ bottom: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg  border-4 border-white "
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
