"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, ChevronDown, ChevronUp, Clock, Target, TrendingUp } from "lucide-react";
import { useTheme } from "next-themes";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  strategicType: 'QUICK_WIN' | 'PROJECT' | 'BIG_BET';
  estimatedImpact: number;
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  order: number;
}

interface BubbleChartProps {
  recommendations: Recommendation[];
  title?: string;
}

const strategicColors = {
  QUICK_WIN: { bg: '#0CC1C3', border: '#0aa8aa', text: '#0a2a2a', label: 'Hızlı Kazanım' },
  PROJECT: { bg: '#3b82f6', border: '#2563eb', text: '#0a1628', label: 'Proje' },
  BIG_BET: { bg: '#a855f7', border: '#9333ea', text: '#1a0a28', label: 'Büyük Yatırım' }
};

const timeframeLabels = {
  SHORT_TERM: 'Kısa Vade',
  MEDIUM_TERM: 'Orta Vade',
  LONG_TERM: 'Uzun Vade'
};

const DollarIndicator = ({ level, size = 12 }: { level: number; size?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <DollarSign 
        key={i} 
        size={size} 
        className={i < level ? 'text-[var(--accent)]' : 'text-[var(--ui-passive)]'} 
      />
    ))}
  </div>
);

export function BubbleChart({ recommendations, title = "Bubble Chart" }: BubbleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sort recommendations by order
  const sortedRecs = [...recommendations].sort((a, b) => a.order - b.order);

  const isDark = mounted && theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Theme-aware colors
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';
    const axisColor = isDark ? '#94a3b8' : '#64748b';
    const labelColor = isDark ? '#94a3b8' : '#64748b';
    const titleColor = isDark ? '#cbd5e1' : '#475569';

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (i / 10) * chartWidth;
      const y = padding.top + (i / 10) * chartHeight;
      
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 2;
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    // Y axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = labelColor;
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    
    // X axis labels
    for (let i = 0; i <= 10; i += 2) {
      const x = padding.left + (i / 10) * chartWidth;
      ctx.fillText(i.toString(), x, height - padding.bottom + 20);
    }
    
    // Y axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i += 2) {
      const y = height - padding.bottom - (i / 10) * chartHeight;
      ctx.fillText(i.toString(), padding.left - 10, y + 4);
    }

    // Axis titles
    ctx.fillStyle = titleColor;
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    
    // X axis title
    ctx.fillText('Kaynak → Önem → Aciliyet', width / 2, height - 10);
    
    // Y axis title
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Öncelik Puanı', 0, 0);
    ctx.restore();

    // Draw bubbles
    sortedRecs.forEach((rec, index) => {
      const x = padding.left + ((rec.xPosition || 5) / 10) * chartWidth;
      const y = height - padding.bottom - ((rec.yPosition || 5) / 10) * chartHeight;
      const radius = Math.max(15, Math.min(40, (rec.estimatedImpact || 5) * 3));
      const colors = strategicColors[rec.strategicType];
      const isSelected = selectedId === rec.id;
      const isHovered = hoveredId === rec.id;

      // Draw bubble
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected || isHovered ? colors.border : colors.bg;
      ctx.globalAlpha = isSelected || isHovered ? 1 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Draw number
      ctx.fillStyle = colors.text;
      ctx.font = `bold ${Math.max(14, radius * 0.7)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), x, y);
    });

  }, [recommendations, selectedId, hoveredId, sortedRecs, isDark]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Check if click is on any bubble
    for (const rec of sortedRecs) {
      const bx = padding.left + ((rec.xPosition || 5) / 10) * chartWidth;
      const by = height - padding.bottom - ((rec.yPosition || 5) / 10) * chartHeight;
      const radius = Math.max(15, Math.min(40, (rec.estimatedImpact || 5) * 3));
      
      const distance = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
      if (distance <= radius) {
        setSelectedId(rec.id === selectedId ? null : rec.id);
        setExpandedId(rec.id === expandedId ? null : rec.id);
        return;
      }
    }
    setSelectedId(null);
  };

  // Handle canvas hover
  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    let found = false;
    for (const rec of sortedRecs) {
      const bx = padding.left + ((rec.xPosition || 5) / 10) * chartWidth;
      const by = height - padding.bottom - ((rec.yPosition || 5) / 10) * chartHeight;
      const radius = Math.max(15, Math.min(40, (rec.estimatedImpact || 5) * 3));
      
      const distance = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
      if (distance <= radius) {
        setHoveredId(rec.id);
        canvas.style.cursor = 'pointer';
        found = true;
        break;
      }
    }
    if (!found) {
      setHoveredId(null);
      canvas.style.cursor = 'default';
    }
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-lg border border-[var(--border-light)] p-6">
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">{title}</h3>
      
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart */}
        <div className="flex-1">
          <div 
            ref={containerRef} 
            className="relative w-full bg-[var(--bg-main)] rounded-lg border border-[var(--border-light)]"
            style={{ height: '400px' }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setHoveredId(null)}
              className="absolute inset-0"
            />
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {Object.entries(strategicColors).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: value.bg, border: `2px solid ${value.border}` }}
                />
                <span className="text-sm text-[var(--text-secondary)]">{value.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-[var(--ui-passive)]" />
                <span className="text-xs text-[var(--text-muted)]">Küçük Etki</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-[var(--ui-passive)]" />
                <span className="text-xs text-[var(--text-muted)]">Büyük Etki</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="w-full lg:w-80 max-h-[500px] overflow-y-auto">
          <div className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <span>#</span>
            <span className="flex-1">Öneriler</span>
            <span className="w-16 text-center">CAPEX</span>
            <span className="w-16 text-center">OPEX/yıl</span>
          </div>
          
          <div className="space-y-2">
            {sortedRecs.map((rec, index) => {
              const colors = strategicColors[rec.strategicType];
              const isExpanded = expandedId === rec.id;
              const isSelected = selectedId === rec.id;
              
              return (
                <motion.div
                  key={rec.id}
                  initial={false}
                  animate={{ 
                    backgroundColor: isSelected ? (isDark ? '#1e293b' : '#f0f9ff') : (isDark ? '#0f172a' : '#ffffff'),
                    borderColor: isSelected ? colors.border : (isDark ? '#334155' : '#e5e7eb')
                  }}
                  className="border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : rec.id);
                      setSelectedId(rec.id);
                    }}
                    onMouseEnter={() => setHoveredId(rec.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="w-full p-3 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <span 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: colors.border }}
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-[var(--text-primary)] truncate">
                      {rec.title}
                    </span>
                    <span className="w-16">
                      <DollarIndicator level={rec.capexLevel} size={10} />
                    </span>
                    <span className="w-16">
                      <DollarIndicator level={rec.opexLevel} size={10} />
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-[var(--text-muted)]" />
                    ) : (
                      <ChevronDown size={16} className="text-[var(--text-muted)]" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-[var(--border-light)] bg-[var(--bg-hover)]"
                      >
                        <div className="p-3 space-y-3">
                          <p className="text-sm text-[var(--text-secondary)]">{rec.description}</p>
                          
                          <div className="flex flex-wrap gap-2">
                            <span 
                              className="px-2 py-1 rounded text-xs font-medium"
                              style={{ backgroundColor: colors.bg, color: colors.border }}
                            >
                              {colors.label}
                            </span>
                            <span className="px-2 py-1 bg-[rgba(46,134,255,0.15)] text-[var(--blue-main)] rounded text-xs font-medium flex items-center gap-1">
                              <Clock size={12} />
                              {timeframeLabels[rec.timeframe]}
                            </span>
                            <span className="px-2 py-1 bg-[rgba(245,158,11,0.15)] text-[var(--warning)] rounded text-xs font-medium flex items-center gap-1">
                              <TrendingUp size={12} />
                              Etki: {rec.estimatedImpact}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <Target size={12} />
                              Konum: ({rec.xPosition}, {rec.yPosition})
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
