"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Globe, Target, Plus, X, ChevronDown, Check, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IronmanData {
  current: {
    velocity: number;
    endurance: number;
    date: string;
    quadrant: string;
    quadrantInfo: {
      title: string;
      titleEn: string;
      description: string;
      color: string;
    };
  };
  target: {
    velocity: number;
    endurance: number;
    date: string;
  };
  benchmark: {
    current: {
      velocity: number;
      endurance: number;
    };
    target: {
      velocity: number;
      endurance: number;
    };
  } | null;
  company: {
    name: string;
    industry: string;
    region: string;
  };
  stats: {
    totalQuestions: number;
    answeredQuestions: number;
    velocityQuestions: number;
    enduranceQuestions: number;
  };
}

interface SectorOption {
  id: string;
  name: string;
  subSectors?: { id: string; name: string }[];
}

interface ComparisonData {
  sectorId: string;
  sectorName: string;
  subSectorId?: string;
  subSectorName?: string;
  velocity: number;
  endurance: number;
  targetVelocity: number;
  targetEndurance: number;
}

// Simulated other companies data for visualization
const generateOtherCompanies = () => {
  const companies = [];
  for (let i = 0; i < 25; i++) {
    companies.push({
      velocity: 1 + Math.random() * 4,
      endurance: 1 + Math.random() * 4,
    });
  }
  return companies;
};

export function IronmanChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<IronmanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [otherCompanies] = useState(generateOtherCompanies);
  
  // Karşılaştırma state'leri
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedSubSector, setSelectedSubSector] = useState<string>('');
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/ironman/user');
        if (!res.ok) {
          // API hatası durumunda data null kalacak, fallback UI gösterilecek
          setData(null);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching ironman data:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Sektörleri yükle
  const fetchSectors = async () => {
    try {
      const res = await fetch('/api/sectors');
      if (res.ok) {
        const sectorsData = await res.json();
        setSectors(sectorsData);
      }
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  };

  // Karşılaştırma verisini getir
  const fetchComparisonData = async (sectorId: string, subSectorId?: string) => {
    setLoadingComparison(true);
    try {
      const params = new URLSearchParams({ sectorId });
      if (subSectorId) {
        params.append('subSectorId', subSectorId);
      }
      const res = await fetch(`/api/ironman/benchmark?${params.toString()}`);
      if (res.ok) {
        const benchmarkData = await res.json();
        const sector = sectors.find(s => s.id === sectorId);
        const subSector = sector?.subSectors?.find(ss => ss.id === subSectorId);
        
        setComparisonData({
          sectorId,
          sectorName: sector?.name || 'Bilinmeyen Sektör',
          subSectorId,
          subSectorName: subSector?.name,
          velocity: benchmarkData.current?.velocity || 2.5,
          endurance: benchmarkData.current?.endurance || 2.5,
          targetVelocity: benchmarkData.target?.velocity || 3.5,
          targetEndurance: benchmarkData.target?.endurance || 3.5,
        });
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      // Fallback: rastgele değerler
      const sector = sectors.find(s => s.id === sectorId);
      const subSector = sector?.subSectors?.find(ss => ss.id === subSectorId);
      setComparisonData({
        sectorId,
        sectorName: sector?.name || 'Bilinmeyen Sektör',
        subSectorId,
        subSectorName: subSector?.name,
        velocity: 2.0 + Math.random() * 1.5,
        endurance: 2.0 + Math.random() * 1.5,
        targetVelocity: 3.0 + Math.random() * 1.0,
        targetEndurance: 3.0 + Math.random() * 1.0,
      });
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleOpenCompareModal = () => {
    if (sectors.length === 0) {
      fetchSectors();
    }
    setShowCompareModal(true);
  };

  const handleSelectComparison = () => {
    if (selectedSector) {
      fetchComparisonData(selectedSector, selectedSubSector || undefined);
      setShowCompareModal(false);
    }
  };

  const handleClearComparison = () => {
    setComparisonData(null);
    setSelectedSector('');
    setSelectedSubSector('');
  };

  const currentSubSectors = sectors.find(s => s.id === selectedSector)?.subSectors || [];

  // Tema değişince tuval yeniden çizilir; renkler CSS'ten okunuyor.
  const { theme } = useTheme();

  /**
   * Grafik tuvale çizildiği için renkleri CSS'ten okumak zorunda: `var(--…)`
   * canvas'ta çalışmaz. Değerler çizim anında :root'tan alınır, böylece tema
   * değişince aynı kod diğer paletle çizer.
   */
  const token = (name: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  };

  const drawChart = useCallback(() => {
    if (!canvasRef.current || !data || !mounted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 420;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const padding = 50;
    const chartSize = size - padding * 2;

    ctx.clearRect(0, 0, size, size);

    // Colors - Dark Theme
    const gridColor = token('--chart-grid', 'rgba(100, 116, 139, 0.25)');
    const axisColor = token('--chart-axis-text', '#94a3b8');
    const labelColor = axisColor;

    // Zemin — temaya göre
    ctx.fillStyle = token('--chart-surface', '#1e293b');
    ctx.fillRect(padding, padding, chartSize, chartSize);

    // Draw quadrant backgrounds with subtle dark colors
    const midX = padding + chartSize / 2;
    const midY = padding + chartSize / 2;

    const quadrantColor = token('--chart-quadrant', 'rgba(30, 41, 59, 1)');

    // Walker (bottom-left)
    ctx.fillStyle = quadrantColor;
    ctx.fillRect(padding, midY, chartSize / 2, chartSize / 2);

    // Sprinter (bottom-right)
    ctx.fillStyle = quadrantColor;
    ctx.fillRect(midX, midY, chartSize / 2, chartSize / 2);

    // Marathon Runner (top-left)
    ctx.fillStyle = quadrantColor;
    ctx.fillRect(padding, padding, chartSize / 2, chartSize / 2);

    // Iron Man (top-right) - subtle blue tint
    ctx.fillStyle = token('--chart-quadrant-hi', 'rgba(59, 130, 246, 0.08)');
    ctx.fillRect(midX, padding, chartSize / 2, chartSize / 2);

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const pos = padding + (chartSize / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + chartSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + chartSize, pos);
      ctx.stroke();
    }

    // Draw center lines (thicker)
    ctx.strokeStyle = token('--chart-axis-line', 'rgba(148, 163, 184, 0.3)');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(midX, padding);
    ctx.lineTo(midX, padding + chartSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, midY);
    ctx.lineTo(padding + chartSize, midY);
    ctx.stroke();

    // Draw diagonal reference line (Iron Man line)
    ctx.strokeStyle = token('--chart-ref', 'rgba(99, 102, 241, 0.5)');
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartSize);
    ctx.lineTo(padding + chartSize, padding);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axis labels
    ctx.fillStyle = labelColor;
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 1; i <= 5; i++) {
      const xPos = padding + (chartSize / 5) * i - (chartSize / 10);
      ctx.fillText(i.toString(), xPos, padding + chartSize + 18);
    }
    ctx.textAlign = 'right';
    for (let i = 1; i <= 5; i++) {
      const yPos = padding + chartSize - (chartSize / 5) * i + (chartSize / 10);
      ctx.fillText(i.toString(), padding - 8, yPos + 4);
    }

    // Quadrant labels
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    
    ctx.fillStyle = token('--chart-label', '#64748b');
    ctx.fillText('Yaya', padding + chartSize / 4, padding + chartSize - 12);
    ctx.fillText('Sprinter', padding + chartSize * 3 / 4, padding + chartSize - 12);
    ctx.fillText('Maraton Koşucusu', padding + chartSize / 4, padding + 18);
    
    ctx.fillStyle = token('--chart-label-hi', '#818cf8');
    ctx.fillText('Demir Adam', padding + chartSize * 3 / 4, padding + 18);

    // Helper function to convert score to position
    const scoreToPos = (score: number, axis: 'x' | 'y') => {
      const normalized = (score - 1) / 4;
      if (axis === 'x') {
        return padding + normalized * chartSize;
      } else {
        return padding + chartSize - normalized * chartSize;
      }
    };

    // Draw other companies as small blue dots
    ctx.fillStyle = token('--chart-peer', 'rgba(96, 165, 250, 0.6)');
    otherCompanies.forEach(company => {
      const x = scoreToPos(company.velocity, 'x');
      const y = scoreToPos(company.endurance, 'y');
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw line from current to target
    const currentX = scoreToPos(data.current.velocity, 'x');
    const currentY = scoreToPos(data.current.endurance, 'y');
    const targetX = scoreToPos(data.target.velocity, 'x');
    const targetY = scoreToPos(data.target.endurance, 'y');

    ctx.strokeStyle = 'rgba(219, 39, 119, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, currentY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // Draw target point
    ctx.fillStyle = token('--series-target', '#3b82f6');
    ctx.beginPath();
    ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = token('--chart-point-ring', '#ffffff');
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw current point (pink) - larger
    ctx.shadowColor = 'rgba(219, 39, 119, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = token('--series-current', '#ec4899');
    ctx.beginPath();
    ctx.arc(currentX, currentY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = token('--chart-point-ring', '#ffffff');
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = axisColor;
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Velocity', size / 2, size - 5);
    
    ctx.save();
    ctx.translate(14, size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Endurance', 0, 0);
    ctx.restore();

    // `theme` kodda geçmiyor ama bağımlılık: renkler CSS'ten okunuyor, tema
    // değişince aynı veriyle yeniden çizilmesi gerekiyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mounted, otherCompanies, theme]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  if (loading || !mounted) {
    return (
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--border-soft)]">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[var(--blue-main)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.current || !data.target) {
    return (
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--border-soft)]">
        <p className="text-[var(--text-muted)] text-center">Ironman verileri yüklenemedi veya eksik</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-card)] rounded-2xl shadow-sm overflow-hidden border border-[var(--border-soft)]"
    >
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Scatter Plot */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-dim)]">Ironman Analizi</h3>
              <button className="p-1.5 rounded-full hover:bg-[var(--bg-card-2)] transition-colors">
                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            
            <canvas ref={canvasRef} className="mx-auto" />
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[var(--series-current)]" />
                <span>Mevcut durumunuz ({data.current?.date || '-'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[var(--series-target)]" />
                <span>Hedefiniz ({data.target?.date || '-'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[var(--chart-peer)]" />
                <span>Diğer şirketler (mevcut - {data.current?.date || '-'})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 border-t-2 border-dashed border-[var(--chart-ref)]" />
                <span>Referans çizgisi (Iron Man)</span>
              </div>
            </div>
          </div>

          {/* Right: Benchmark & Info */}
          <div className="space-y-4">
            {/* Benchmark Bar Chart */}
            <div className="bg-[var(--bg-card-2)] rounded-xl p-4">
              <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-4">Ironman Analizi Kıyaslaması</h4>
              
              {/* Velocity Benchmark */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-dim)]">Hız</span>
                </div>
                <div className="relative h-6 bg-[var(--bg-card)] rounded-full overflow-hidden">
                  {/* Your Current - Pink */}
                  <div 
                    className="absolute h-6 flex items-center justify-end pr-1 z-10"
                    style={{ width: `${((data.current?.velocity ?? 1) / 5) * 100}%` }}
                  >
                    <div className="bg-[var(--series-current)] h-5 rounded-full flex items-center justify-center px-2 text-[10px] text-white font-medium min-w-[32px]">
                      {(data.current?.velocity ?? 1).toFixed(1)}
                    </div>
                  </div>
                  {/* Your Target - Blue */}
                  <div 
                    className="absolute h-6 flex items-center z-10"
                    style={{ left: `${((data.target?.velocity ?? 3) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-[var(--series-target)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                      {(data.target?.velocity ?? 3).toFixed(1)}
                    </div>
                  </div>
                  {/* Industry Avg - Purple & Orange */}
                  {data.benchmark && (
                    <>
                      <div 
                        className="absolute h-6 flex items-center z-10"
                        style={{ left: `${((data.benchmark.current?.velocity ?? 2.5) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-[var(--series-sector-current)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {(data.benchmark.current?.velocity ?? 2.5).toFixed(1)}
                        </div>
                      </div>
                      <div 
                        className="absolute h-6 flex items-center z-10"
                        style={{ left: `${((data.benchmark.target?.velocity ?? 3.0) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-[var(--series-sector-target)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {(data.benchmark.target?.velocity ?? 3.0).toFixed(1)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Endurance Benchmark */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-dim)]">Dayanıklılık</span>
                </div>
                <div className="relative h-6 bg-[var(--bg-card)] rounded-full overflow-hidden">
                  {/* Your Current - Pink */}
                  <div 
                    className="absolute h-6 flex items-center justify-end pr-1 z-10"
                    style={{ width: `${((data.current?.endurance ?? 1) / 5) * 100}%` }}
                  >
                    <div className="bg-[var(--series-current)] h-5 rounded-full flex items-center justify-center px-2 text-[10px] text-white font-medium min-w-[32px]">
                      {(data.current?.endurance ?? 1).toFixed(1)}
                    </div>
                  </div>
                  {/* Your Target - Blue */}
                  <div 
                    className="absolute h-6 flex items-center z-10"
                    style={{ left: `${((data.target?.endurance ?? 3) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-[var(--series-target)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                      {(data.target?.endurance ?? 3).toFixed(1)}
                    </div>
                  </div>
                  {/* Industry Avg - Purple & Orange */}
                  {data.benchmark && (
                    <>
                      <div 
                        className="absolute h-6 flex items-center z-10"
                        style={{ left: `${((data.benchmark.current?.endurance ?? 2.5) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-[var(--series-sector-current)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {(data.benchmark.current?.endurance ?? 2.5).toFixed(1)}
                        </div>
                      </div>
                      <div 
                        className="absolute h-6 flex items-center z-10"
                        style={{ left: `${((data.benchmark.target?.endurance ?? 3.0) / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-[var(--series-sector-target)] h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {(data.benchmark.target?.endurance ?? 3.0).toFixed(1)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-[10px] text-[var(--text-muted)] mt-3">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--series-current)]" />
                  <span>Mevcut</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--series-target)]" />
                  <span>Hedef</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--series-sector-current)]" />
                  <span>Sektör Ort. Mevcut</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--series-sector-target)]" />
                  <span>Sektör Ort. Hedef</span>
                </div>
              </div>
            </div>

            {/* Quadrant Info & Company Details */}
            <div className="grid grid-cols-2 gap-4">
              {/* Quadrant Info */}
              <div className="bg-[var(--bg-card-2)] rounded-xl p-4">
                <h4 className="text-sm font-semibold text-[var(--text-dim)] mb-2">{data.current.quadrantInfo.title}</h4>
                <p className="text-xs text-[var(--text-dim)] leading-relaxed">
                  {data.current.quadrantInfo.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-medium text-[var(--text-dim)]">Sektör</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">{data.company.industry}</p>
                  
                  <div className="flex items-center gap-2 mt-3 mb-2">
                    <Globe className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-medium text-[var(--text-dim)]">Bölge</span>
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">{data.company.region}</p>
                </div>

                {/* Score Summary */}
                <div className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-medium text-[var(--text-dim)]">Puan</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[var(--text-muted)]">Mevcut ({data.current?.date || '-'})</p>
                      <p className="text-[var(--text-dim)]">Hız: {data.current?.velocity?.toFixed(1) || '0.0'}</p>
                      <p className="text-[var(--text-dim)]">Dayanıklılık: {data.current?.endurance?.toFixed(1) || '0.0'}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Hedef ({data.target?.date || '-'})</p>
                      <p className="text-[var(--text-dim)]">Hız: {data.target?.velocity?.toFixed(1) || '0.0'}</p>
                      <p className="text-[var(--text-dim)]">Dayanıklılık: {data.target?.endurance?.toFixed(1) || '0.0'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Select to Compare / Comparison Result */}
              <div className="bg-[var(--bg-card-2)] rounded-xl p-4 flex flex-col items-center justify-center text-center min-h-[200px]">
                {comparisonData ? (
                  // Karşılaştırma sonucu göster
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-xs font-medium text-[var(--text-dim)]">Karşılaştırma</span>
                      </div>
                      <button
                        onClick={handleClearComparison}
                        className="p-1 rounded-full hover:bg-[var(--bg-card)] transition-colors"
                      >
                        <X className="w-4 h-4 text-[var(--text-muted)]" />
                      </button>
                    </div>
                    
                    <div className="text-left mb-4">
                      <p className="text-sm font-semibold text-[var(--accent)]">{comparisonData.sectorName}</p>
                      {comparisonData.subSectorName && (
                        <p className="text-xs text-[var(--text-muted)]">{comparisonData.subSectorName}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-muted)]">Hız (Mevcut)</span>
                          <span className="text-[var(--text-dim)] font-medium">{comparisonData.velocity.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                            style={{ width: `${(comparisonData.velocity / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-muted)]">Dayanıklılık (Mevcut)</span>
                          <span className="text-[var(--text-dim)] font-medium">{comparisonData.endurance.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                            style={{ width: `${(comparisonData.endurance / 5) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[var(--border-soft)]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-muted)]">Hız (Hedef)</span>
                          <span className="text-[var(--text-dim)] font-medium">{comparisonData.targetVelocity.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--blue-main)] rounded-full transition-all duration-500"
                            style={{ width: `${(comparisonData.targetVelocity / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-muted)]">Dayanıklılık (Hedef)</span>
                          <span className="text-[var(--text-dim)] font-medium">{comparisonData.targetEndurance.toFixed(1)}</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-card)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--blue-main)] rounded-full transition-all duration-500"
                            style={{ width: `${(comparisonData.targetEndurance / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleOpenCompareModal}
                      className="mt-4 text-xs text-[var(--accent)] hover:underline"
                    >
                      Başka sektör seç
                    </button>
                  </div>
                ) : (
                  // Karşılaştırma butonu
                  <>
                    <p className="text-sm text-[var(--text-muted)] mb-4">Karşılaştırmak için seçin</p>
                    <button
                      onClick={handleOpenCompareModal}
                      className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--border-soft)] flex items-center justify-center text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Plus className="w-8 h-8" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Karşılaştırma Modal */}
      <AnimatePresence>
        {showCompareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCompareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-card)] rounded-2xl p-6 w-full max-w-md border border-[var(--border-soft)] shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-[var(--text-dim)]">Sektör Karşılaştırması</h3>
                <button
                  onClick={() => setShowCompareModal(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-card-2)] transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--text-muted)]" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Sektör Seçimi */}
                <div>
                  <label className="block text-sm font-medium text-[var(--text-dim)] mb-2">
                    Sektör Seçin
                  </label>
                  <div className="relative">
                    <select
                      value={selectedSector}
                      onChange={(e) => {
                        setSelectedSector(e.target.value);
                        setSelectedSubSector('');
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-soft)] text-[var(--text-dim)] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                    >
                      <option value="">Sektör seçin...</option>
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                  </div>
                </div>

                {/* Alt Sektör Seçimi */}
                {currentSubSectors.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-dim)] mb-2">
                      Alt Sektör (Opsiyonel)
                    </label>
                    <div className="relative">
                      <select
                        value={selectedSubSector}
                        onChange={(e) => setSelectedSubSector(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-soft)] text-[var(--text-dim)] appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                      >
                        <option value="">Tüm alt sektörler</option>
                        {currentSubSectors.map((subSector) => (
                          <option key={subSector.id} value={subSector.id}>
                            {subSector.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Seçim Butonu */}
                <Button
                  onClick={handleSelectComparison}
                  disabled={!selectedSector || loadingComparison}
                  className="w-full rounded-xl font-medium disabled:cursor-not-allowed"
                >
                  {loadingComparison ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Karşılaştır
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
