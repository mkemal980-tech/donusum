"use client";

import { motion } from "framer-motion";

interface BenchmarkItem {
  id?: string;
  name: string;
  userScore: number;
  bestScore: number;
  averageScore: number;
}

interface BenchmarkChartProps {
  title?: string;
  overall: BenchmarkItem;
  categories: BenchmarkItem[];
  companyName?: string;
  maxScore?: number;
}

export function BenchmarkChart({ 
  title = "Benchmark", 
  overall, 
  categories, 
  companyName = "Sizin Puanınız",
  maxScore = 5
}: BenchmarkChartProps) {
  const scaleToPercent = (score: number) => Math.min((score / maxScore) * 100, 100);

  const renderRow = (item: BenchmarkItem, isOverall: boolean = false) => {
    const avgPercent = scaleToPercent(item.averageScore);
    const userPercent = scaleToPercent(item.userScore);
    const bestPercent = scaleToPercent(item.bestScore);

    return (
      <div 
        key={item.name} 
        className={`flex items-center gap-4 py-3 ${isOverall ? 'border-b-2 border-[var(--border-soft)] pb-4 mb-2' : 'border-b border-[var(--border-soft)]'}`}
      >
        <div className={`w-28 text-sm ${isOverall ? 'font-bold text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
          {item.name}
        </div>
        <div className="flex-1 relative h-8">
          {/* Background track */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div className="w-full h-1 bg-[var(--border-soft)] rounded-full relative">
              {/* Grid lines */}
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-[var(--ui-passive)]"
                  style={{ left: `${(n / maxScore) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {/* Connector line from average to best */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${bestPercent - avgPercent}%` }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-gray-300 via-blue-300 to-purple-400 rounded-full"
            style={{ left: `${avgPercent}%` }}
          />

          {/* Average marker */}
          <motion.div
            initial={{ scale: 0, left: 0 }}
            animate={{ scale: 1, left: `${avgPercent}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--ui-passive)] flex items-center justify-center text-white text-xs font-bold shadow-md">
              {item.averageScore.toFixed(1)}
            </div>
          </motion.div>

          {/* User score marker */}
          <motion.div
            initial={{ scale: 0, left: 0 }}
            animate={{ scale: 1, left: `${userPercent}%` }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--blue-main)] flex items-center justify-center text-white text-xs font-bold shadow-lg border-2 border-white">
              {item.userScore.toFixed(1)}
            </div>
          </motion.div>

          {/* Best score marker */}
          <motion.div
            initial={{ scale: 0, left: 0 }}
            animate={{ scale: 1, left: `${bestPercent}%` }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <div className="w-7 h-7 rounded-full bg-[#8b5cf6] flex items-center justify-center text-white text-xs font-bold shadow-md">
              {item.bestScore.toFixed(1)}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-main)]">{title}</h3>
        <div className="text-sm text-[var(--text-dim)]">
          1≡
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-1">
        {/* Overall row */}
        {renderRow({ ...overall, name: "Genel" }, true)}

        {/* Category rows */}
        {categories.map((cat) => renderRow(cat))}
      </div>

      {/* Scale */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
        <div className="w-28" />
        <div className="flex-1 flex justify-between text-xs text-[var(--text-dim)] px-2">
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0</span>
          <span>4.0</span>
          <span>5.0</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[var(--ui-passive)]" />
          <span className="text-sm text-[var(--text-muted)]">Ortalama</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[var(--blue-main)]" />
          <span className="text-sm text-[var(--text-muted)]">{companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#8b5cf6]" />
          <span className="text-sm text-[var(--text-muted)]">En İyi</span>
        </div>
      </div>
    </div>
  );
}
