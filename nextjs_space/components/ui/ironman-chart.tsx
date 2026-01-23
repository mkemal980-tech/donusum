"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

interface IronmanData {
  user: {
    velocity: number;
    endurance: number;
    quadrant: string;
    quadrantInfo: {
      title: string;
      description: string;
      color?: string;
    };
    velocityQuestionCount?: number;
    enduranceQuestionCount?: number;
    totalResponses?: number;
  };
  imbalance?: {
    isImbalanced: boolean;
    difference: number;
    warning: {
      type: string;
      title: string;
      message: string;
      recommendation: string;
    } | null;
  };
  benchmark: {
    velocityAverage: number;
    velocityBest: number;
    enduranceAverage: number;
    enduranceBest: number;
    sectorName: string;
    subSectorName: string | null;
  } | null;
  sector: { id: string; name: string } | null;
  subSector: { id: string; name: string } | null;
}

const quadrantColors: Record<string, { light: { bg: string; border: string; text: string }; dark: { bg: string; border: string; text: string } }> = {
  IRONMAN: { 
    light: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700' },
    dark: { bg: 'bg-green-900/40', border: 'border-green-400', text: 'text-green-300' }
  },
  SPRINTER: { 
    light: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700' },
    dark: { bg: 'bg-orange-900/40', border: 'border-orange-400', text: 'text-orange-300' }
  },
  MARATHON_RUNNER: { 
    light: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-700' },
    dark: { bg: 'bg-purple-900/40', border: 'border-purple-400', text: 'text-purple-300' }
  },
  WALKER: { 
    light: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-700' },
    dark: { bg: 'bg-red-900/40', border: 'border-red-400', text: 'text-red-300' }
  },
};

export function IronmanChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<IronmanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/ironman/user');
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching ironman data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    if (!canvasRef.current || !data || !mounted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 400;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const padding = 50;
    const chartSize = size - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Theme-aware colors
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb';
    const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : '#374151';
    const labelColor = isDark ? 'rgba(255, 255, 255, 0.8)' : '#374151';
    const titleColor = isDark ? '#22d3ee' : '#1e3a8a';
    const diagonalColor = isDark ? 'rgba(34, 211, 238, 0.5)' : '#1e3a8a';

    // Draw background quadrants
    const midX = padding + chartSize / 2;
    const midY = padding + chartSize / 2;

    const quadrantOpacity = isDark ? 0.2 : 0.1;

    // Walker (bottom-left) - red
    ctx.fillStyle = `rgba(239, 68, 68, ${quadrantOpacity})`;
    ctx.fillRect(padding, midY, chartSize / 2, chartSize / 2);

    // Sprinter (bottom-right) - orange
    ctx.fillStyle = `rgba(249, 115, 22, ${quadrantOpacity})`;
    ctx.fillRect(midX, midY, chartSize / 2, chartSize / 2);

    // Marathon Runner (top-left) - purple
    ctx.fillStyle = `rgba(168, 85, 247, ${quadrantOpacity})`;
    ctx.fillRect(padding, padding, chartSize / 2, chartSize / 2);

    // Iron Man (top-right) - green
    ctx.fillStyle = `rgba(34, 197, 94, ${quadrantOpacity})`;
    ctx.fillRect(midX, padding, chartSize / 2, chartSize / 2);

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const pos = padding + (chartSize / 5) * i;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + chartSize);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + chartSize, pos);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartSize);
    ctx.lineTo(padding + chartSize, padding + chartSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartSize);
    ctx.stroke();

    // Draw axis labels
    ctx.fillStyle = labelColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 1; i <= 5; i++) {
      const xPos = padding + (chartSize / 5) * (i - 0.5);
      const yPos = padding + chartSize - (chartSize / 5) * (i - 0.5);
      ctx.fillText(i.toString(), xPos, padding + chartSize + 15);
      ctx.fillText(i.toString(), padding - 15, yPos + 4);
    }

    // Axis titles
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = titleColor;
    ctx.fillText('Velocity (Hız)', size / 2, size - 5);
    ctx.save();
    ctx.translate(12, size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Endurance (Olgunluk)', 0, 0);
    ctx.restore();

    // Draw diagonal reference line
    ctx.strokeStyle = diagonalColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartSize);
    ctx.lineTo(padding + chartSize, padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Quadrant labels
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = isDark ? 'rgba(248, 113, 113, 0.9)' : 'rgba(239, 68, 68, 0.8)';
    ctx.fillText('Walker', padding + chartSize / 4, padding + chartSize - 15);
    ctx.fillStyle = isDark ? 'rgba(251, 146, 60, 0.9)' : 'rgba(249, 115, 22, 0.8)';
    ctx.fillText('Sprinter', padding + chartSize * 3 / 4, padding + chartSize - 15);
    ctx.fillStyle = isDark ? 'rgba(192, 132, 252, 0.9)' : 'rgba(168, 85, 247, 0.8)';
    ctx.fillText('Marathon Runner', padding + chartSize / 4, padding + 20);
    ctx.fillStyle = isDark ? 'rgba(74, 222, 128, 0.9)' : 'rgba(34, 197, 94, 0.8)';
    ctx.fillText('Iron Man', padding + chartSize * 3 / 4, padding + 20);

    // Helper function to convert score to position
    const scoreToPos = (score: number, axis: 'x' | 'y') => {
      const normalized = (score - 1) / 4; // Convert 1-5 to 0-1
      if (axis === 'x') {
        return padding + normalized * chartSize;
      } else {
        return padding + chartSize - normalized * chartSize;
      }
    };

    // Draw benchmark points if available
    if (data.benchmark) {
      // Average point
      const avgX = scoreToPos(data.benchmark.velocityAverage, 'x');
      const avgY = scoreToPos(data.benchmark.enduranceAverage, 'y');
      ctx.fillStyle = isDark ? '#38bdf8' : '#60a5fa';
      ctx.beginPath();
      ctx.arc(avgX, avgY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark ? '#0f172a' : '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('O', avgX, avgY + 3);

      // Best point
      const bestX = scoreToPos(data.benchmark.velocityBest, 'x');
      const bestY = scoreToPos(data.benchmark.enduranceBest, 'y');
      ctx.fillStyle = isDark ? '#22d3ee' : '#1e3a8a';
      ctx.beginPath();
      ctx.arc(bestX, bestY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isDark ? '#0f172a' : '#fff';
      ctx.fillText('E', bestX, bestY + 3);
    }

    // Draw user point
    const userX = scoreToPos(data.user.velocity, 'x');
    const userY = scoreToPos(data.user.endurance, 'y');
    
    // User point with glow
    ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(userX, userY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('S', userX, userY + 4);

  }, [data, mounted, isDark]);

  if (loading || !mounted) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 dark:border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-gray-400 text-center">Ironman verileri yüklenemedi</p>
      </div>
    );
  }

  const quadrantColorSet = quadrantColors[data.user.quadrant] || quadrantColors.WALKER;
  const colors = isDark ? quadrantColorSet.dark : quadrantColorSet.light;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] overflow-hidden border border-gray-200 dark:border-slate-700"
    >
      {/* Header - Dark navy gradient in dark mode */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-slate-900 dark:to-slate-800 px-6 py-4 border-b border-transparent dark:border-slate-700">
        <h3 className="text-lg font-bold text-white dark:text-gray-100">Ironman Analizi</h3>
        <p className="text-white/70 dark:text-gray-400 text-sm">Hız ve Olgunluk Değerlendirmesi</p>
      </div>

      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="flex-shrink-0">
            <canvas ref={canvasRef} className="mx-auto" />
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-pink-500"></span>
                <span>Sizin Skorunuz</span>
              </div>
              {data.benchmark && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-400 dark:bg-sky-400"></span>
                    <span>Sektör Ort.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-900 dark:bg-cyan-400"></span>
                    <span>Sektör En İyi</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="flex-1 space-y-4">
            {/* Quadrant Info */}
            <div className={`p-4 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
              <h4 className={`text-xl font-bold ${colors.text}`}>{data.user.quadrantInfo.title}</h4>
              <p className={`mt-2 text-sm ${colors.text} opacity-90`}>{data.user.quadrantInfo.description}</p>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Velocity (Hız)</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{data.user.velocity.toFixed(1)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.user.velocityQuestionCount || 0} soru • 1-5 ölçeği
                </p>
              </div>
              <div className="bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700">
                <p className="text-sm text-teal-600 dark:text-teal-300 font-medium">Endurance (Olgunluk)</p>
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{data.user.endurance.toFixed(1)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.user.enduranceQuestionCount || 0} soru • 1-5 ölçeği
                </p>
              </div>
            </div>

            {/* Dengesizlik Uyarısı */}
            {data.imbalance?.isImbalanced && data.imbalance.warning && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-500">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h5 className="font-bold text-amber-700 dark:text-amber-300">{data.imbalance.warning.title}</h5>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{data.imbalance.warning.message}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
                      💡 {data.imbalance.warning.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Benchmark Comparison */}
            {data.benchmark && (
              <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <h5 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  Sektör Karşılaştırması: {data.benchmark.sectorName}
                  {data.benchmark.subSectorName && ` - ${data.benchmark.subSectorName}`}
                </h5>
                
                {/* Velocity Comparison */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-blue-600 dark:text-blue-400">Velocity</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Ort: {data.benchmark.velocityAverage.toFixed(1)} | En İyi: {data.benchmark.velocityBest.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-blue-300 dark:bg-blue-700 rounded-full"
                      style={{ width: `${(data.benchmark.velocityBest / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full bg-blue-500 dark:bg-blue-500 rounded-full"
                      style={{ width: `${(data.benchmark.velocityAverage / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full w-1 bg-pink-500 rounded-full"
                      style={{ left: `${(data.user.velocity / 5) * 100}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                </div>

                {/* Endurance Comparison */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-teal-600 dark:text-teal-400">Endurance</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      Ort: {data.benchmark.enduranceAverage.toFixed(1)} | En İyi: {data.benchmark.enduranceBest.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-teal-300 dark:bg-teal-700 rounded-full"
                      style={{ width: `${(data.benchmark.enduranceBest / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full bg-teal-500 dark:bg-teal-500 rounded-full"
                      style={{ width: `${(data.benchmark.enduranceAverage / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full w-1 bg-pink-500 rounded-full"
                      style={{ left: `${(data.user.endurance / 5) * 100}%`, transform: 'translateX(-50%)' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {!data.benchmark && data.sector && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600 p-4 rounded-lg">
                <p className="text-amber-700 dark:text-amber-300 text-sm">
                  <strong>{data.sector.name}</strong> sektörü için henüz benchmark verisi tanımlanmamış.
                  Admin panelinden ekleyebilirsiniz.
                </p>
              </div>
            )}

            {!data.sector && (
              <div className="bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 p-4 rounded-lg">
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Sektör bilginiz tanımlı değil. Profil ayarlarından sektörünüzü seçerek
                  benchmark karşılaştırması görebilirsiniz.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
