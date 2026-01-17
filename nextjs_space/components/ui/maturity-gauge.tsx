"use client";

import { motion } from "framer-motion";

interface MaturityGaugeProps {
  score: number; // 1-5 scale
  title?: string;
}

const levels = [
  { value: 5, label: "Başlangıç", color: "#6b7280" },
  { value: 4, label: "Farkındalık", color: "#6b7280" },
  { value: 3, label: "Gelişen", color: "#6b7280" },
  { value: 2, label: "Olgun", color: "#6b7280" },
  { value: 1, label: "Lider", color: "#6b7280" },
];

export function MaturityGauge({ score, title = "Seviyelendirme" }: MaturityGaugeProps) {
  // Calculate position (0 = bottom, 100 = top)
  const position = ((score - 1) / 4) * 100;
  
  return (
    <div className="bg-[#1e1e2f] rounded-xl p-6 h-full">
      <h3 className="text-lg font-semibold text-white mb-8">{title}</h3>
      
      <div className="flex items-stretch gap-8 h-[320px]">
        {/* Labels */}
        <div className="flex flex-col justify-between py-2">
          {levels.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <span className="text-gray-400 text-sm w-20">{level.label}</span>
              <span className="text-gray-500 text-sm">{level.value}</span>
            </div>
          ))}
        </div>
        
        {/* Gauge Bar */}
        <div className="relative flex-1 max-w-[60px]">
          {/* Background track */}
          <div className="absolute inset-0 bg-gradient-to-b from-gray-600 via-gray-500 to-gray-600 rounded-full opacity-60" />
          
          {/* Dotted lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-dashed border-gray-500 w-full" />
            ))}
          </div>
          
          {/* Yellow indicator bar */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-yellow-400 via-yellow-300 to-yellow-400 rounded-full"
            style={{ minHeight: "40px" }}
          />
          
          {/* Score indicator circle */}
          <motion.div
            initial={{ bottom: 0 }}
            animate={{ bottom: `${position}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-14 h-14 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg border-4 border-yellow-300">
              <span className="text-2xl font-bold text-gray-800">{score.toFixed(1)}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
