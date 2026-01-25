"use client";

import { motion } from "framer-motion";

interface MaturityLevelBarProps {
  score: number; // 0-100 percentage or 1-5 score
  isPercentage?: boolean; // if true, converts from percentage to 1-5
}

const levels = [
  { label: "Lider", value: 5, minPercent: 80, color: "#22d3ee" },
  { label: "Olgun", value: 4, minPercent: 60, color: "#2dd4bf" },
  { label: "Gelişen", value: 3, minPercent: 40, color: "#38bdf8" },
  { label: "Farkındalık", value: 2, minPercent: 20, color: "#5eead4" },
  { label: "Başlangıç", value: 1, minPercent: 0, color: "#67e8f9" },
];

export function MaturityLevelBar({ score, isPercentage = true }: MaturityLevelBarProps) {
  // Convert percentage to 1-5 score if needed
  const scoreOn5 = isPercentage ? (score / 100) * 4 + 1 : score;
  const percentage = isPercentage ? score : ((score - 1) / 4) * 100;
  
  // Determine current level
  const getCurrentLevel = () => {
    if (percentage >= 80) return levels[0]; // Lider
    if (percentage >= 60) return levels[1]; // Olgun
    if (percentage >= 40) return levels[2]; // Gelişen
    if (percentage >= 20) return levels[3]; // Farkındalık
    return levels[4]; // Başlangıç
  };
  
  const currentLevel = getCurrentLevel();
  
  // Calculate position (0-100% from bottom)
  const barPosition = Math.min(100, Math.max(0, percentage));
  
  return (
    <div className="flex flex-col items-center h-full">
      <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Seviyelendirme</h4>
      
      {/* Current Level Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 px-6 py-2 rounded-full text-white font-semibold text-lg"
        style={{ backgroundColor: currentLevel.color }}
      >
        {currentLevel.label}
      </motion.div>
      
      <div className="flex items-stretch gap-4 flex-1">
        {/* Levels Labels */}
        <div className="flex flex-col justify-between py-2">
          {levels.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: level.color }}
              />
              <span className="text-sm font-medium text-[var(--text-secondary)] w-24">
                {level.label}
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)] w-4">
                {level.value}
              </span>
            </div>
          ))}
        </div>
        
        {/* Vertical Bar */}
        <div className="relative w-16 h-64 bg-[var(--border-light)] rounded-full overflow-hidden">
          {/* Gradient Background */}
          <div 
            className="absolute inset-x-0 bottom-0 rounded-full"
            style={{
              background: "linear-gradient(to top, #67e8f9, #5eead4, #38bdf8, #2dd4bf, #22d3ee)",
              height: "100%",
              opacity: 0.3
            }}
          />
          
          {/* Filled Progress */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${barPosition}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 rounded-full"
            style={{
              background: "linear-gradient(to top, #67e8f9, #5eead4, #38bdf8, #2dd4bf, #22d3ee)",
            }}
          />
          
          {/* Score Indicator */}
          <motion.div
            initial={{ bottom: 0 }}
            animate={{ bottom: `${barPosition}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-[var(--bg-card)]  shadow-lg flex items-center justify-center border-4"
            style={{ borderColor: currentLevel.color }}
          >
            <span className="text-base font-bold" style={{ color: currentLevel.color }}>
              {scoreOn5.toFixed(1)}
            </span>
          </motion.div>
          
          {/* Level Markers */}
          <div className="absolute inset-0 flex flex-col justify-between py-3">
            {[5, 4, 3, 2, 1].map((val, i) => (
              <div key={val} className="w-full flex items-center justify-center">
                <div className="w-2 h-0.5 bg-[var(--bg-card)]/40" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaturityLevelBar;
