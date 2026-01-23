"use client";

import { motion } from "framer-motion";
import { TrendingUp, Target } from "lucide-react";

interface ProgressItem {
  id?: string;
  name: string;
  surveyScore: number;      // Mor - Anket skoru (baz)
  progressScore: number;    // İndigo - Gelişim skoru
  delta: number;            // Fark
}

interface ProgressBenchmarkChartProps {
  title?: string;
  overall: ProgressItem;
  categories: ProgressItem[];
  maxScore?: number;
}

export function ProgressBenchmarkChart({ 
  title = "Benchmark", 
  overall, 
  categories, 
  maxScore = 5
}: ProgressBenchmarkChartProps) {
  const scaleToPercent = (score: number) => Math.min((score / maxScore) * 100, 100);

  const renderRow = (item: ProgressItem, isOverall: boolean = false) => {
    const surveyPercent = scaleToPercent(item.surveyScore);
    const progressPercent = scaleToPercent(item.progressScore);
    const hasProgress = item.delta > 0;

    return (
      <div 
        key={item.name} 
        className={`flex items-center gap-4 py-3 ${isOverall ? 'border-b-2 border-[var(--border)] pb-4 mb-2' : 'border-b border-[var(--border)]'}`}
      >
        <div className={`w-44 text-sm ${isOverall ? 'font-bold text-[var(--foreground)]' : 'text-[var(--foreground)]'}`}>
          {item.name}
        </div>
        <div className="flex-1 relative h-10">
          {/* Background track */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-center">
            <div className="w-full h-2 bg-[var(--muted)] rounded-full relative">
              {/* Grid lines */}
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-[var(--border)]"
                  style={{ left: `${(n / maxScore) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {/* Survey Score Bar (Mor - Ana renk) */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${surveyPercent}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="absolute top-1/2 -translate-y-1/2 h-5 bg-gradient-to-r from-fuchsia-500 to-violet-500 rounded-l-full flex items-center justify-end pr-1"
            style={{ minWidth: item.surveyScore > 0 ? '30px' : '0' }}
          >
            <span className="text-[10px] font-bold text-white drop-shadow">
              {item.surveyScore.toFixed(2)}
            </span>
          </motion.div>

          {/* Progress Score Bar (İndigo - Gelişim) - Mor'un üstüne eklenir */}
          {hasProgress && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent - surveyPercent}%` }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute top-1/2 -translate-y-1/2 h-5 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-r-full flex items-center justify-end pr-1"
              style={{ left: `${surveyPercent}%`, minWidth: '24px' }}
            >
              <span className="text-[10px] font-bold text-white drop-shadow">
                {item.progressScore.toFixed(1)}
              </span>
            </motion.div>
          )}
        </div>

        {/* Delta indicator */}
        <div className="w-16 text-right">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`text-sm font-bold ${
              hasProgress ? 'text-emerald-500 dark:text-emerald-400' : 'text-[var(--muted-foreground)]'
            }`}
          >
            {hasProgress ? `+${item.delta.toFixed(2)}` : '+0.00'}
          </motion.span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-6 text-[var(--foreground)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Target className="text-violet-400" size={24} />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        
        {/* Overall Summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
              {overall.surveyScore.toFixed(2)}
            </div>
            <TrendingUp size={20} className="text-[var(--muted-foreground)]" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-sm font-bold text-white shadow-lg">
              {overall.progressScore.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {categories.map((cat) => renderRow(cat))}
      </div>

      {/* Scale */}
      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-[var(--border)]">
        <div className="w-44" />
        <div className="flex-1 flex justify-between text-xs text-[var(--muted-foreground)] px-2">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
        <div className="w-16" />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-8 mt-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-fuchsia-500 to-violet-500" />
          <span className="text-sm text-[var(--muted-foreground)]">Anket</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-r from-cyan-400 to-blue-500" />
          <span className="text-sm text-[var(--muted-foreground)]">Gelişim</span>
        </div>
      </div>
    </div>
  );
}
