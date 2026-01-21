"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const drawChart = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || data.length < 2) return;

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
      ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
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
      ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
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
      "rgba(99, 102, 241, 0.12)",
      "rgba(99, 102, 241, 0.5)",
      2
    );

    // Draw current score polygon (inner, darker) - represents actual performance
    drawPolygon(
      data.map((d) => d.score),
      "rgba(236, 72, 153, 0.3)",
      "rgba(236, 72, 153, 0.9)",
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
      ctx.fillStyle = "#ec4899";
      ctx.fill();
      ctx.strokeStyle = "#fff";
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
      ctx.fillStyle = "#374151";
      
      const lineHeight = 14;
      const totalHeight = lines.length * lineHeight;
      const startY = y - totalHeight / 2 + lineHeight / 2;
      
      lines.forEach((line, idx) => {
        ctx.fillText(line, x, startY + idx * lineHeight);
      });
    }
  }, [data]);

  useEffect(() => {
    if (!mounted) return;
    
    drawChart();
    
    // Redraw on resize
    const handleResize = () => {
      requestAnimationFrame(drawChart);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [data, mounted, drawChart]);

  // Re-draw after a short delay to ensure container is sized
  useEffect(() => {
    if (mounted) {
      const timer = setTimeout(drawChart, 100);
      return () => clearTimeout(timer);
    }
  }, [mounted, drawChart]);

  if (!mounted) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-6 h-full border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  // Show message if not enough data points
  if (data.length < 2) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-6 h-full border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          <p>GAP analizi için en az 2 alt kategori gereklidir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 h-full border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "rgba(236, 72, 153, 0.7)" }} />
          <span className="text-sm text-gray-600 font-medium">Mevcut Durum</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: "rgba(99, 102, 241, 0.5)" }} />
          <span className="text-sm text-gray-600 font-medium">Hedef</span>
        </div>
      </div>
      
      <div ref={containerRef} className="h-[300px] w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
