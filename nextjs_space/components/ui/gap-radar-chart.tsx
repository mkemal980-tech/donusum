"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "next-themes";

interface DataPoint {
  name: string;
  score: number; // 0-5 scale (current score)
  target: number; // 0-5 scale (target score)
}

interface GapRadarChartProps {
  data: DataPoint[];
  title?: string;
}

export function GapRadarChart({ data, title = "GAP Analizi" }: GapRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Theme-aware colors
  const colors = {
    primary: isDark ? '#22d3ee' : 'var(--blue-main)',
    primaryLight: isDark ? 'rgba(34, 211, 238, 0.2)' : 'rgba(59, 130, 246, 0.15)',
    secondary: isDark ? '#818cf8' : '#06b6d4',
    secondaryLight: isDark ? 'rgba(129, 140, 248, 0.3)' : 'rgba(6, 182, 212, 0.3)',
    accent: isDark ? '#f472b6' : '#ec4899',
    accentLight: isDark ? 'rgba(244, 114, 182, 0.3)' : 'rgba(236, 72, 153, 0.3)',
    grid: isDark ? 'rgba(34, 211, 238, 0.15)' : 'rgba(59, 130, 246, 0.2)',
    text: isDark ? '#e2e8f0' : '#374151',
    textMuted: isDark ? '#94a3b8' : '#9ca3af',
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // 2 veya daha az veri noktası için bar chart çiz
  const drawBarChart = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(dpr, dpr);

    const width = containerWidth;
    const height = containerHeight;
    const padding = { top: 30, bottom: 60, left: 20, right: 20 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    ctx.clearRect(0, 0, width, height);

    const barGroupWidth = chartWidth / data.length;
    const barWidth = Math.min(40, barGroupWidth * 0.35);
    const gap = 8;

    // Y ekseni çizgileri
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartHeight - (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Y ekseni etiketleri
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillStyle = colors.textMuted;
      ctx.textAlign = "right";
      ctx.fillText(i.toString(), padding.left - 8, y + 4);
    }

    // Her veri noktası için bar çiz
    data.forEach((item, index) => {
      const groupX = padding.left + barGroupWidth * index + barGroupWidth / 2;
      
      // Hedef bar (arka plan)
      const targetHeight = (item.target / 5) * chartHeight;
      const targetX = groupX - barWidth - gap / 2;
      const targetY = padding.top + chartHeight - targetHeight;
      
      ctx.fillStyle = colors.primaryLight;
      ctx.beginPath();
      ctx.roundRect(targetX, targetY, barWidth, targetHeight, 4);
      ctx.fill();
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Mevcut durum bar
      const scoreHeight = (item.score / 5) * chartHeight;
      const scoreX = groupX + gap / 2;
      const scoreY = padding.top + chartHeight - scoreHeight;
      
      ctx.fillStyle = colors.accentLight;
      ctx.beginPath();
      ctx.roundRect(scoreX, scoreY, barWidth, scoreHeight, 4);
      ctx.fill();
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Skorları bar üzerine yaz
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = colors.primary;
      ctx.fillText(item.target.toFixed(1), targetX + barWidth / 2, targetY - 6);
      ctx.fillStyle = colors.accent;
      ctx.fillText(item.score.toFixed(1), scoreX + barWidth / 2, scoreY - 6);
      
      // X ekseni etiketleri
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.fillStyle = colors.text;
      ctx.textAlign = "center";
      
      // Uzun isimleri kısalt
      const maxLen = data.length <= 2 ? 20 : 12;
      let label = item.name;
      if (label.length > maxLen) {
        label = label.substring(0, maxLen - 2) + "...";
      }
      ctx.fillText(label, groupX, padding.top + chartHeight + 25);
    });
  }, [data, colors]);

  const drawChart = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || data.length < 3) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get container size
    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;
    ctx.scale(dpr, dpr);

    const width = containerWidth;
    const height = containerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate max radius based on data count for better label spacing
    const labelSpace = data.length <= 4 ? 70 : 55;
    const maxRadius = Math.min(width, height) / 2 - labelSpace;
    const levels = 5;
    const numPoints = data.length;
    const angleStep = (2 * Math.PI) / numPoints;
    const startAngle = -Math.PI / 2; // Start from top

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw concentric polygons (web lines)
    for (let level = 1; level <= levels; level++) {
      const radius = (maxRadius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const angle = startAngle + (i % numPoints) * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis lines from center to each vertex
    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Helper to draw filled polygon
    const drawPolygon = (
      values: number[], 
      fillColor: string, 
      strokeColor: string, 
      lineWidth: number = 2
    ) => {
      if (values.length < 2) return;
      
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const idx = i % numPoints;
        const angle = startAngle + idx * angleStep;
        const value = Math.max(0, Math.min(values[idx] || 0, 5)) / 5; // Normalize to 0-1
        const radius = maxRadius * value;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    // Draw target polygon (outer, lighter) - represents benchmark/goal
    drawPolygon(
      data.map((d) => d.target),
      colors.primaryLight,
      colors.primary,
      2
    );

    // Draw current score polygon (inner, darker) - represents actual performance
    drawPolygon(
      data.map((d) => d.score),
      colors.accentLight,
      colors.accent,
      2.5
    );

    // Draw data points for current scores
    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const value = Math.max(0, Math.min(data[i].score || 0, 5)) / 5;
      const radius = maxRadius * value;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      // Draw point with shadow
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = colors.accent;
      ctx.fill();
      ctx.strokeStyle = isDark ? "#162033" : "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw labels at vertices
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + i * angleStep;
      const labelRadius = maxRadius + (data.length <= 4 ? 45 : 35);
      let x = centerX + labelRadius * Math.cos(angle);
      let y = centerY + labelRadius * Math.sin(angle);

      // Adjust position based on angle for better readability
      const normalizedAngle = ((angle + Math.PI * 2) % (Math.PI * 2));
      
      // Right side labels
      if (normalizedAngle > Math.PI / 4 && normalizedAngle < 3 * Math.PI / 4) {
        ctx.textAlign = "center";
        y += 10;
      }
      // Bottom labels
      else if (normalizedAngle >= 3 * Math.PI / 4 && normalizedAngle <= 5 * Math.PI / 4) {
        ctx.textAlign = "right";
        x -= 5;
      }
      // Left side labels  
      else if (normalizedAngle > 5 * Math.PI / 4 && normalizedAngle < 7 * Math.PI / 4) {
        ctx.textAlign = "center";
        y -= 5;
      }
      // Top labels
      else {
        ctx.textAlign = "left";
        x += 5;
      }

      // Word wrap for long labels
      const words = data[i].name.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      const maxChars = data.length <= 3 ? 20 : 14;
      
      for (const word of words) {
        if ((currentLine + " " + word).trim().length > maxChars) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Draw label text
      ctx.font = "12px Inter, system-ui, -apple-system, sans-serif";
      ctx.fillStyle = colors.text;
      
      const lineHeight = 14;
      const totalHeight = lines.length * lineHeight;
      const startY = y - totalHeight / 2 + lineHeight / 2;
      
      lines.forEach((line, idx) => {
        ctx.fillText(line, x, startY + idx * lineHeight);
      });
    }
  }, [data, colors, isDark]);

  // Doğru çizim fonksiyonunu seç: 3+ için radar, 1-2 için bar chart
  const draw = useCallback(() => {
    if (data.length >= 3) {
      drawChart();
    } else if (data.length >= 1) {
      drawBarChart();
    }
  }, [data.length, drawChart, drawBarChart]);

  useEffect(() => {
    if (!mounted) return;
    
    draw();
    
    // Redraw on resize
    const handleResize = () => {
      requestAnimationFrame(draw);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data, mounted, draw, theme]);

  // Re-draw after a short delay to ensure container is sized
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(draw, 100);
      return () => clearTimeout(timer);
    }
  }, [mounted, draw]);

  if (!mounted) {
    return (
      <div className="bg-[var(--bg-card)]  rounded-2xl shadow-soft  p-6 h-full border border-[var(--border-soft)]  transition-colors duration-300">
        <h3 className="text-lg font-semibold text-[var(--text-main)]  mb-4">{title}</h3>
        <div className="h-[300px] flex items-center justify-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Show message if no data
  if (data.length < 1) {
    return (
      <div className="bg-[var(--bg-card)]  rounded-2xl shadow-soft  p-6 h-full border border-[var(--border-soft)]  transition-colors duration-300">
        <h3 className="text-lg font-semibold text-[var(--text-main)]  mb-4">{title}</h3>
        <div className="h-[300px] flex items-center justify-center text-[var(--text-dim)] ">
          <p>GAP analizi için veri bulunamadı.</p>
        </div>
      </div>
    );
  }

  // 1-2 veri noktası için farklı açıklama
  const isBarChart = data.length < 3;

  return (
    <div className="bg-[var(--bg-card)]  rounded-2xl shadow-soft  p-6 h-full border border-[var(--border-soft)]  transition-colors duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-main)] ">{title}</h3>
        {isBarChart && (
          <span className="text-xs text-[var(--text-dim)]  bg-[var(--bg-card-2)]  px-2 py-1 rounded">
            3+ alt kategori ile örümcek grafik
          </span>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <div className="flex items-center gap-2">
          <div 
            className={`w-4 h-4 ${isBarChart ? 'rounded' : 'rounded-full'}`} 
            style={{ backgroundColor: colors.accent }} 
          />
          <span className="text-sm text-[var(--text-muted)]  font-medium">Mevcut Durum</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className={`w-4 h-4 ${isBarChart ? 'rounded' : 'rounded-full'}`} 
            style={{ backgroundColor: colors.primary }} 
          />
          <span className="text-sm text-[var(--text-muted)]  font-medium">Hedef</span>
        </div>
      </div>
      
      <div ref={containerRef} className="h-[300px] w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
