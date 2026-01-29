"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Calendar, Activity, Award, RefreshCw } from "lucide-react";

interface ScoreHistoryRecord {
  id: string;
  overallScore: number;
  overallPercentage: number;
  velocityScore: number | null;
  enduranceScore: number | null;
  quadrant: string | null;
  completedRecommendations: number;
  recordedAt: string;
  triggerType: string;
}

interface ProgressData {
  overallScore: {
    start: number;
    end: number;
    change: number;
    changePercent: number;
  };
  velocity: {
    start: number | null;
    end: number | null;
    change: number | null;
  };
  endurance: {
    start: number | null;
    end: number | null;
    change: number | null;
  };
  recommendations: {
    start: number;
    end: number;
    completed: number;
  };
  quadrantProgress: {
    start: string | null;
    end: string | null;
    improved: boolean;
  };
}

interface GroupedData {
  monthly: Array<{
    date: string;
    avgOverall: number;
    avgVelocity: number;
    avgEndurance: number;
    count: number;
  }>;
}

interface ScoreTrendChartProps {
  surveyId?: string;
}

export function ScoreTrendChart({ surveyId }: ScoreTrendChartProps) {
  const [history, setHistory] = useState<ScoreHistoryRecord[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [groupedData, setGroupedData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6months');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const url = `/api/score-history?period=${period}${surveyId ? `&surveyId=${surveyId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
          setProgress(data.progress);
          setGroupedData(data.groupedData);
        }
      } catch (error) {
        console.error('Error fetching score history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [surveyId, period]);

  // Canvas çizimi
  useEffect(() => {
    if (!canvasRef.current || !groupedData?.monthly?.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Temizle
    ctx.clearRect(0, 0, width, height);

    const data = groupedData.monthly;
    if (data.length === 0) return;

    // Grid çizgileri
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y ekseni etiketleri
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((5 - i).toString(), padding.left - 8, y + 3);
    }

    // Veri noktaları
    const xStep = chartWidth / Math.max(data.length - 1, 1);

    // Overall Score çizgisi (cyan)
    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.avgOverall / 5) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Velocity çizgisi (mavi)
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    data.forEach((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.avgVelocity / 5) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Endurance çizgisi (yeşil)
    ctx.beginPath();
    ctx.strokeStyle = '#14b8a6';
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 2]);
    data.forEach((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - (d.avgEndurance / 5) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Noktalar ve X ekseni etiketleri
    data.forEach((d, i) => {
      const x = padding.left + i * xStep;
      
      // Overall nokta
      const yOverall = padding.top + chartHeight - (d.avgOverall / 5) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, yOverall, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();

      // X ekseni etiketi
      if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const [year, month] = d.date.split('-');
        const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
        ctx.fillText(`${monthNames[parseInt(month) - 1]}`, x, height - padding.bottom + 15);
        ctx.fillText(`${year.slice(2)}`, x, height - padding.bottom + 27);
      }
    });

  }, [groupedData]);

  const renderTrendIcon = (change: number | null) => {
    if (change === null) return null;
    if (change > 0) return <TrendingUp size={16} className="text-[var(--success)]" />;
    if (change < 0) return <TrendingDown size={16} className="text-[var(--error)]" />;
    return <Minus size={16} className="text-[var(--text-muted)]" />;
  };

  const quadrantLabels: Record<string, string> = {
    IRONMAN: 'Iron Man',
    SPRINTER: 'Sprinter',
    MARATHON_RUNNER: 'Marathon Runner',
    WALKER: 'Walker',
  };

  if (loading) {
    return (
      <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]">
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--bg-card-2)] rounded w-1/3 mb-4"></div>
          <div className="h-48 bg-[var(--bg-card-2)] rounded"></div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={20} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Gelişim Trend Analizi</h3>
        </div>
        <div className="text-center py-12 text-[var(--text-muted)]">
          <RefreshCw size={48} className="mx-auto mb-4 opacity-30" />
          <p>Henüz skor geçmişi yok.</p>
          <p className="text-sm mt-2">Önerileri tamamladıkça gelişiminiz burada görünecek.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Gelişim Trend Analizi</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {['3months', '6months', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-lg transition-all ${
                period === p 
                  ? 'bg-[var(--accent)] text-[var(--bg-deep)]' 
                  : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--accent)]/20'
              }`}
            >
              {p === '3months' ? '3 Ay' : p === '6months' ? '6 Ay' : '1 Yıl'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik */}
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-[#22d3ee]"></div>
              <span className="text-[var(--text-muted)]">Genel Skor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-[#3b82f6]" style={{borderStyle: 'dashed'}}></div>
              <span className="text-[var(--text-muted)]">Velocity</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-[#14b8a6]"></div>
              <span className="text-[var(--text-muted)]">Endurance</span>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-48"
            style={{ width: '100%', height: '192px' }}
          />
        </div>

        {/* İlerleme İstatistikleri */}
        {progress && (
          <div className="space-y-4">
            {/* Genel Skor Değişimi */}
            <div className="p-4 bg-[var(--bg-card-2)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-muted)]">Genel Skor</span>
                {renderTrendIcon(progress.overallScore.change)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--accent)]">
                  {progress.overallScore.end.toFixed(1)}
                </span>
                <span className="text-sm text-[var(--text-dim)]">/5</span>
                {progress.overallScore.change !== 0 && (
                  <span className={`text-sm font-medium ${
                    progress.overallScore.change > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                  }`}>
                    {progress.overallScore.change > 0 ? '+' : ''}{progress.overallScore.change.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--text-dim)] mt-1">
                Başlangıç: {progress.overallScore.start.toFixed(1)}
              </div>
            </div>

            {/* Tamamlanan Öneriler */}
            <div className="p-4 bg-[var(--success-bg)]0/10 rounded-lg border border-[var(--success)]/20">
              <div className="flex items-center gap-2 mb-2">
                <Award size={16} className="text-[var(--success)]" />
                <span className="text-sm text-[var(--text-muted)]">Tamamlanan Öneriler</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[var(--success)]">
                  +{progress.recommendations.completed}
                </span>
                <span className="text-sm text-[var(--text-dim)]">
                  (Toplam: {progress.recommendations.end})
                </span>
              </div>
            </div>

            {/* Quadrant Değişimi */}
            {progress.quadrantProgress.start && progress.quadrantProgress.end && (
              <div className={`p-4 rounded-lg border ${
                progress.quadrantProgress.improved 
                  ? 'bg-[var(--accent)]/100/10 border-[var(--accent)]/20' 
                  : 'bg-[var(--bg-card-2)] border-transparent'
              }`}>
                <div className="text-sm text-[var(--text-muted)] mb-2">Kadran Durumu</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-dim)]">
                    {quadrantLabels[progress.quadrantProgress.start] || progress.quadrantProgress.start}
                  </span>
                  <span className="text-[var(--accent)]">→</span>
                  <span className={`font-medium ${
                    progress.quadrantProgress.improved ? 'text-[var(--accent)]' : 'text-[var(--text-main)]'
                  }`}>
                    {quadrantLabels[progress.quadrantProgress.end] || progress.quadrantProgress.end}
                  </span>
                  {progress.quadrantProgress.improved && (
                    <TrendingUp size={14} className="text-[var(--accent)]" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Son Kayıtlar */}
      <div className="mt-6 pt-4 border-t border-[var(--border-soft)]">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-[var(--text-dim)]" />
          <span className="text-xs text-[var(--text-dim)]">
            {history.length} kayıt ({history[0] && new Date(history[0].recordedAt).toLocaleDateString('tr-TR')} - {history[history.length - 1] && new Date(history[history.length - 1].recordedAt).toLocaleDateString('tr-TR')})
          </span>
        </div>
      </div>
    </motion.div>
  );
}
