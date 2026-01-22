"use client";

import { motion } from "framer-motion";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
  showOverallLevel?: boolean;
}

// Tema uyumlu renkler
const levels = [
  { value: 5, label: "Lider", lightColor: "#2563eb", darkColor: "#22d3ee", minPercent: 80 },
  { value: 4, label: "Olgun", lightColor: "#3b82f6", darkColor: "#38bdf8", minPercent: 60 },
  { value: 3, label: "Gelişen", lightColor: "#06b6d4", darkColor: "#818cf8", minPercent: 40 },
  { value: 2, label: "Farkındalık", lightColor: "#10b981", darkColor: "#a78bfa", minPercent: 20 },
  { value: 1, label: "Başlangıç", lightColor: "#6ee7b7", darkColor: "#c4b5fd", minPercent: 0 },
];

/**
 * Yeni Puanlama Sistemi:
 * - Puan = (Yüzde / 100) × 4 + 1
 * - %0 → 1.0 puan
 * - %100 → 5.0 puan
 */
export const getScoreLevel = (score: number): { label: string; color: string; darkColor: string } => {
  const percentage = ((score - 1) / 4) * 100;
  
  if (percentage >= 80) return { label: "Lider", color: "#2563eb", darkColor: "#22d3ee" };
  if (percentage >= 60) return { label: "Olgun", color: "#3b82f6", darkColor: "#38bdf8" };
  if (percentage >= 40) return { label: "Gelişen", color: "#06b6d4", darkColor: "#818cf8" };
  if (percentage >= 20) return { label: "Farkındalık", color: "#10b981", darkColor: "#a78bfa" };
  return { label: "Başlangıç", color: "#6ee7b7", darkColor: "#c4b5fd" };
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
    <div className="bg-white dark:bg-dark-card rounded-2xl shadow-soft dark:shadow-glow-cyan/10 p-6 h-full border border-gray-100 dark:border-dark-border transition-colors duration-300">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">{title}</h3>
      
      {showOverallLevel && (
        <div className="mb-6 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="inline-block px-6 py-3 rounded-2xl text-white font-bold text-lg shadow-lg dark:shadow-glow"
            style={{ backgroundColor: currentLevel.color }}
          >
            <span className="dark:hidden">{currentLevel.label}</span>
            <span className="hidden dark:inline" style={{ color: 'white' }}>{currentLevel.label}</span>
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
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium w-24">{level.label}</span>
              <span className="text-primary-500 dark:text-cyan-400 text-sm font-semibold">{level.value}</span>
            </div>
          ))}
        </div>
        
        {/* Gauge Bar */}
        <div className="relative flex-1 max-w-[50px]">
          {/* Background track */}
          <div 
            className="absolute inset-0 rounded-2xl bg-gradient-to-t from-gray-100 to-gray-200 dark:from-dark-border dark:to-dark-bg" 
          />
          
          {/* Level lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-dashed border-white/30 dark:border-gray-600/30 w-full" />
            ))}
          </div>
          
          {/* Progress bar */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 rounded-2xl bg-gradient-to-t from-emerald-400 via-cyan-500 to-blue-600 dark:from-violet-400 dark:via-cyan-400 dark:to-blue-500"
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
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg dark:shadow-glow border-4 border-white dark:border-dark-card"
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
