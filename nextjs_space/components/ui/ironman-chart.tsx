"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Building2, Globe, Target, Plus } from "lucide-react";

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
    velocityAverage: number;
    velocityBest: number;
    enduranceAverage: number;
    enduranceBest: number;
    velocityAverageTarget: number;
    enduranceAverageTarget: number;
    sectorName: string;
    subSectorName: string | null;
  } | null;
  company: {
    name: string;
    industry: string;
    region: string;
  };
  stats: {
    velocityQuestionCount: number;
    enduranceQuestionCount: number;
    totalResponses: number;
  };
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

    // Colors
    const gridColor = 'rgba(200, 200, 210, 0.3)';
    const axisColor = '#94a3b8';
    const labelColor = '#64748b';

    // Draw background - light gray
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padding, padding, chartSize, chartSize);

    // Draw quadrant backgrounds with subtle colors
    const midX = padding + chartSize / 2;
    const midY = padding + chartSize / 2;

    // Walker (bottom-left)
    ctx.fillStyle = 'rgba(241, 245, 249, 1)';
    ctx.fillRect(padding, midY, chartSize / 2, chartSize / 2);

    // Sprinter (bottom-right)
    ctx.fillStyle = 'rgba(241, 245, 249, 1)';
    ctx.fillRect(midX, midY, chartSize / 2, chartSize / 2);

    // Marathon Runner (top-left)
    ctx.fillStyle = 'rgba(241, 245, 249, 1)';
    ctx.fillRect(padding, padding, chartSize / 2, chartSize / 2);

    // Iron Man (top-right) - light blue tint
    ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
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
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(midX, padding);
    ctx.lineTo(midX, padding + chartSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, midY);
    ctx.lineTo(padding + chartSize, midY);
    ctx.stroke();

    // Draw diagonal reference line (Iron Man line)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
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
    
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Walker', padding + chartSize / 4, padding + chartSize - 12);
    ctx.fillText('Sprinter', padding + chartSize * 3 / 4, padding + chartSize - 12);
    ctx.fillText('Marathon Runner', padding + chartSize / 4, padding + 18);
    
    ctx.fillStyle = '#6366f1';
    ctx.fillText('Iron Man', padding + chartSize * 3 / 4, padding + 18);

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
    ctx.fillStyle = 'rgba(147, 197, 253, 0.7)';
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

    // Draw target point (blue)
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw current point (pink) - larger
    ctx.shadowColor = 'rgba(219, 39, 119, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.arc(currentX, currentY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Axis titles
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Velocity', size / 2, size - 5);
    
    ctx.save();
    ctx.translate(14, size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Endurance', 0, 0);
    ctx.restore();

  }, [data, mounted, otherCompanies]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  if (loading || !mounted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <p className="text-gray-500 text-center">Ironman verileri yüklenemedi</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100"
    >
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Scatter Plot */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Ironman Analysis</h3>
              <button className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
            
            <canvas ref={canvasRef} className="mx-auto" />
            
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-pink-500" />
                <span>Your current ({data.current.date})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Your target ({data.target.date})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-300" />
                <span>Other companies (current - {data.current.date})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 border-t-2 border-dashed border-indigo-400" />
                <span>Reference line (Iron Man)</span>
              </div>
            </div>
          </div>

          {/* Right: Benchmark & Info */}
          <div className="space-y-4">
            {/* Benchmark Bar Chart */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Benchmark of Ironman Analysis</h4>
              
              {/* Velocity Benchmark */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Velocity</span>
                </div>
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  {/* Scale markers */}
                  <div className="absolute inset-0 flex justify-between px-1 text-[10px] text-gray-400 items-center z-10">
                    <span>1.0</span><span>2.0</span><span>3.0</span><span>4.0</span><span>5.0</span>
                  </div>
                  {/* Your Current - Pink */}
                  <div 
                    className="absolute h-6 flex items-center justify-end pr-1"
                    style={{ width: `${(data.current.velocity / 5) * 100}%` }}
                  >
                    <div className="bg-pink-400 h-5 rounded-full flex items-center justify-center px-2 text-[10px] text-white font-medium min-w-[32px]">
                      {data.current.velocity.toFixed(1)}
                    </div>
                  </div>
                  {/* Your Target - Blue */}
                  <div 
                    className="absolute h-6 flex items-center"
                    style={{ left: `${(data.target.velocity / 5) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-blue-500 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                      {data.target.velocity.toFixed(1)}
                    </div>
                  </div>
                  {/* Industry Avg - Purple */}
                  {data.benchmark && (
                    <>
                      <div 
                        className="absolute h-6 flex items-center"
                        style={{ left: `${(data.benchmark.velocityAverage / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-purple-400 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {data.benchmark.velocityAverage.toFixed(1)}
                        </div>
                      </div>
                      <div 
                        className="absolute h-6 flex items-center"
                        style={{ left: `${(data.benchmark.velocityBest / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-purple-700 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {data.benchmark.velocityBest.toFixed(1)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Endurance Benchmark */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">Endurance</span>
                </div>
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 flex justify-between px-1 text-[10px] text-gray-400 items-center z-10">
                    <span>1.0</span><span>2.0</span><span>3.0</span><span>4.0</span><span>5.0</span>
                  </div>
                  {/* Your Current - Pink */}
                  <div 
                    className="absolute h-6 flex items-center justify-end pr-1"
                    style={{ width: `${(data.current.endurance / 5) * 100}%` }}
                  >
                    <div className="bg-pink-400 h-5 rounded-full flex items-center justify-center px-2 text-[10px] text-white font-medium min-w-[32px]">
                      {data.current.endurance.toFixed(1)}
                    </div>
                  </div>
                  {/* Your Target - Blue */}
                  <div 
                    className="absolute h-6 flex items-center"
                    style={{ left: `${(data.target.endurance / 5) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-blue-500 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                      {data.target.endurance.toFixed(1)}
                    </div>
                  </div>
                  {/* Industry Avg - Purple */}
                  {data.benchmark && (
                    <>
                      <div 
                        className="absolute h-6 flex items-center"
                        style={{ left: `${(data.benchmark.enduranceAverage / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-purple-400 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {data.benchmark.enduranceAverage.toFixed(1)}
                        </div>
                      </div>
                      <div 
                        className="absolute h-6 flex items-center"
                        style={{ left: `${(data.benchmark.enduranceBest / 5) * 100}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="bg-purple-700 h-5 w-8 rounded-full flex items-center justify-center text-[10px] text-white font-medium">
                          {data.benchmark.enduranceBest.toFixed(1)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mt-3">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                  <span>Your Current</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Your Target</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <span>Ind. Avg. Current</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-700" />
                  <span>Ind. Avg. Target</span>
                </div>
              </div>
            </div>

            {/* Quadrant Info & Company Details */}
            <div className="grid grid-cols-2 gap-4">
              {/* Quadrant Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-bold text-gray-800 mb-2">{data.current.quadrantInfo.title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {data.current.quadrantInfo.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">Industry</span>
                  </div>
                  <p className="text-xs text-gray-600">{data.company.industry}</p>
                  
                  <div className="flex items-center gap-2 mt-3 mb-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">Region</span>
                  </div>
                  <p className="text-xs text-gray-600">{data.company.region}</p>
                </div>

                {/* Score Summary */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">Score</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Current ({data.current.date})</p>
                      <p className="text-gray-700">Velocity: {data.current.velocity.toFixed(1)}</p>
                      <p className="text-gray-700">Endurance: {data.current.endurance.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Target ({data.target.date})</p>
                      <p className="text-gray-700">Velocity: {data.target.velocity.toFixed(1)}</p>
                      <p className="text-gray-700">Endurance: {data.target.endurance.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Select to Compare */}
              <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-gray-400 mb-4">Select to compare</p>
                <button className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                  <Plus className="w-8 h-8" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
