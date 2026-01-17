"use client";

import { useEffect, useRef, useState } from "react";

interface DataPoint {
  name: string;
  score: number; // 0-5 scale (current score)
  target: number; // 0-5 scale (target score)
}

interface GapRadarChartProps {
  data: DataPoint[];
  title?: string;
}

// Theme colors
const THEME_COLORS = {
  navy: "#1e3a8a",
  navyLight: "#3b5998",
  purple: "#a78bfa",
  purpleLight: "#c4b5fd",
  purpleDark: "#7c3aed",
};

export function GapRadarChart({ data, title = "GAP Analizi" }: GapRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 60;
    const levels = 5;
    const angleStep = (2 * Math.PI) / data.length;
    const startAngle = -Math.PI / 2; // Start from top

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw concentric polygons (levels)
    for (let level = 1; level <= levels; level++) {
      const radius = (maxRadius / levels) * level;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const angle = startAngle + i * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(30, 58, 138, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axis lines
    for (let i = 0; i < data.length; i++) {
      const angle = startAngle + i * angleStep;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(30, 58, 138, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Helper to draw polygon
    const drawPolygon = (values: number[], fillColor: string, strokeColor: string) => {
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const angle = startAngle + i * angleStep;
        const value = Math.min(values[i], 5) / 5; // Normalize to 0-1
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
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    // Draw target polygon (background) - Navy theme
    drawPolygon(
      data.map((d) => d.target),
      "rgba(30, 58, 138, 0.2)",
      "rgba(30, 58, 138, 0.6)"
    );

    // Draw current score polygon (foreground) - Purple theme
    drawPolygon(
      data.map((d) => d.score),
      "rgba(167, 139, 250, 0.4)",
      "rgba(124, 58, 237, 0.9)"
    );

    // Draw labels
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#374151";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < data.length; i++) {
      const angle = startAngle + i * angleStep;
      const labelRadius = maxRadius + 35;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);

      // Wrap long labels
      const words = data[i].name.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      
      for (const word of words) {
        if (currentLine.length + word.length > 12) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      if (currentLine) lines.push(currentLine);

      lines.forEach((line, idx) => {
        ctx.fillText(line, x, y + idx * 14 - ((lines.length - 1) * 7));
      });
    }
  }, [data, mounted]);

  if (!mounted) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 h-full border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-[280px] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-full border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(167, 139, 250, 0.6)" }} />
          <span className="text-sm text-gray-600">Mevcut Durum</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(30, 58, 138, 0.4)" }} />
          <span className="text-sm text-gray-600">Hedef</span>
        </div>
      </div>
      
      <div className="h-[260px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
