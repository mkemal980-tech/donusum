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

const quadrantColors: Record<string, { bg: string; border: string; text: string }> = {
  IRONMAN: { bg: 'bg-[rgba(12,193,195,0.15)]', border: 'border-[var(--accent)]', text: 'text-[var(--accent)]' },
  SPRINTER: { bg: 'bg-[rgba(251,146,60,0.15)]', border: 'border-orange-400', text: 'text-orange-400' },
  MARATHON_RUNNER: { bg: 'bg-[rgba(139,92,246,0.15)]', border: 'border-purple-400', text: 'text-purple-400' },
  WALKER: { bg: 'bg-[rgba(239,68,68,0.15)]', border: 'border-red-400', text: 'text-red-400' },
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
    const titleColor = isDark ? 'var(--accent-cyan)' : 'var(--accent)';
    const diagonalColor = isDark ? 'rgba(34, 211, 238, 0.5)' : 'var(--accent)';

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
      ctx.fillStyle = isDark ? 'var(--accent-cyan)' : 'var(--accent)';
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
      <div className="bg-[var(--bg-card)] rounded-xl shadow-lg p-6 border border-[var(--border-soft)]">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[var(--bg-card)] rounded-xl shadow-lg p-6 border border-[var(--border-soft)]">
        <p className="text-[var(--text-dim)] text-center">Ironman verileri yüklenemedi</p>
      </div>
    );
  }

  const colors = quadrantColors[data.user.quadrant] || quadrantColors.WALKER;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-card)] rounded-xl shadow-lg overflow-hidden border border-[var(--border-soft)]"
    >
      {/* Header - Dark navy gradient in dark mode */}
      <div className="bg-gradient-to-r from-[var(--blue-main)] to-[var(--accent)] px-6 py-4 border-b border-transparent">
        <h3 className="text-lg font-bold text-white">Ironman Analizi</h3>
        <p className="text-white/70 text-sm">Hız ve Olgunluk Değerlendirmesi</p>
      </div>

      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Chart */}
          <div className="flex-shrink-0">
            <canvas ref={canvasRef} className="mx-auto" />
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-pink-500"></span>
                <span>Sizin Skorunuz</span>
              </div>
              {data.benchmark && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-400"></span>
                    <span>Sektör Ort.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-900"></span>
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
              <div className="bg-[rgba(46,134,255,0.1)] p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-[var(--blue-main)] font-medium">Velocity (Hız)</p>
                <p className="text-3xl font-bold text-[var(--blue-main)]">{data.user.velocity.toFixed(1)}</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {data.user.velocityQuestionCount || 0} soru • 1-5 ölçeği
                </p>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                <p className="text-sm text-teal-600 font-medium">Endurance (Olgunluk)</p>
                <p className="text-3xl font-bold text-teal-600">{data.user.endurance.toFixed(1)}</p>
                <p className="text-xs text-[var(--text-dim)] mt-1">
                  {data.user.enduranceQuestionCount || 0} soru • 1-5 ölçeği
                </p>
              </div>
            </div>

            {/* Dengesizlik Uyarısı */}
            {data.imbalance?.isImbalanced && data.imbalance.warning && (
              <div className="p-4 rounded-lg bg-[rgba(245,158,11,0.1)] border-2 border-amber-400">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h5 className="font-bold text-amber-400">{data.imbalance.warning.title}</h5>
                    <p className="text-sm text-amber-800 mt-1">{data.imbalance.warning.message}</p>
                    <p className="text-xs text-amber-400 mt-2 italic">
                      💡 {data.imbalance.warning.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Benchmark Comparison */}
            {data.benchmark && (
              <div className="bg-[var(--bg-card-2)] p-4 rounded-lg border border-[var(--border-soft)]">
                <h5 className="font-semibold text-[var(--text-main)] mb-3">
                  Sektör Karşılaştırması: {data.benchmark.sectorName}
                  {data.benchmark.subSectorName && ` - ${data.benchmark.subSectorName}`}
                </h5>
                
                {/* Velocity Comparison */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--blue-main)]">Velocity</span>
                    <span className="text-[var(--text-dim)]">
                      Ort: {data.benchmark.velocityAverage.toFixed(1)} | En İyi: {data.benchmark.velocityBest.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-[var(--border-soft)] rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-blue-300 rounded-full"
                      style={{ width: `${(data.benchmark.velocityBest / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full bg-[rgba(46,134,255,0.1)]0 rounded-full"
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
                    <span className="text-teal-600">Endurance</span>
                    <span className="text-[var(--text-dim)]">
                      Ort: {data.benchmark.enduranceAverage.toFixed(1)} | En İyi: {data.benchmark.enduranceBest.toFixed(1)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-[var(--border-soft)] rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-teal-300 rounded-full"
                      style={{ width: `${(data.benchmark.enduranceBest / 5) * 100}%` }}
                    />
                    <div
                      className="absolute h-full bg-teal-500 rounded-full"
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
              <div className="bg-[rgba(245,158,11,0.1)] border border-amber-500/50 p-4 rounded-lg">
                <p className="text-amber-400 text-sm">
                  <strong>{data.sector.name}</strong> sektörü için henüz benchmark verisi tanımlanmamış.
                  Admin panelinden ekleyebilirsiniz.
                </p>
              </div>
            )}

            {!data.sector && (
              <div className="bg-[var(--bg-card-2)] border border-[var(--border-soft)] p-4 rounded-lg">
                <p className="text-[var(--text-muted)] text-sm">
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
