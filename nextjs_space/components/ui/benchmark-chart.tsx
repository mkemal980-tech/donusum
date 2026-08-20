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
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--surface-3)]"
            style={{ left: `${avgPercent}%` }}
          />

          {/* Average marker */}
          <motion.div
            initial={{ scale: 0, left: 0 }}
            animate={{ scale: 1, left: `${avgPercent}%` }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-3)] text-[11px] font-semibold tabular text-[var(--ink)]">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--accent-solid)] text-[11px] font-semibold tabular text-[var(--on-accent)]">
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
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--series-4)] text-[11px] font-semibold tabular text-[var(--canvas)]">
              {item.bestScore.toFixed(1)}
            </div>
          </motion.div>
        </div>
      </div>
    );
  };

  return (
    <section
      className="rounded-[var(--radius-lg)] p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <h3 className="t-subhead" style={{ color: "var(--ink)" }}>
        {title}
      </h3>

      {/* Chart */}
      <div className="space-y-1">
        {/* Overall row */}
        {renderRow({ ...overall, name: "Genel" }, true)}

        {/* Category rows */}
        {categories.map((cat) => renderRow(cat))}
      </div>

      {/* Scale */}
      <div className="mt-4 flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="w-28" />
        <div className="flex flex-1 justify-between px-2 t-caption" style={{ letterSpacing: "0.02em" }}>
          <span>1.0</span>
          <span>2.0</span>
          <span>3.0</span>
          <span>4.0</span>
          <span>5.0</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-6 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--surface-3)]" />
          <span className="t-sm" style={{ color: "var(--ink-2)" }}>Sektör ortalaması</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
          <span className="t-sm" style={{ color: "var(--ink-2)" }}>{companyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--series-4)]" />
          <span className="t-sm" style={{ color: "var(--ink-2)" }}>Sektörün en iyisi</span>
        </div>
      </div>
    </section>
  );
}
