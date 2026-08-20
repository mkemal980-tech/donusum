"use client";

import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

interface ScoreCardProps {
  score: number;
  label: string;
  color?: string;
  size?: "small" | "large";
}

/**
 * Olgunluk puanı halkası.
 *
 * Sayı görünür alana girince hedefe sayar; halka aynı sürede dolar. Sayının
 * kendisi mürekkep rengindedir — halka zaten seviyeyi renkle söylüyor, sayıyı
 * da renklendirmek iki kez aynı şeyi anlatıyordu.
 */
export default function ScoreCard({ score, label, color, size = "large" }: ScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });

  const strokeColor = color || "var(--accent)";
  const target = Math.round(Math.max(0, Math.min(100, score ?? 0)));

  useEffect(() => {
    if (!inView) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayScore(target);
      return;
    }

    const duration = 900;
    const steps = 45;
    const stepValue = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += stepValue;
      if (current >= target) {
        setDisplayScore(target);
        clearInterval(interval);
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [inView, target]);

  const radius = size === "large" ? 76 : 40;
  const strokeWidth = size === "large" ? 10 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = (target / 100) * circumference;

  return (
    <div ref={ref} className="flex flex-col items-center">
      <div className="relative">
        <svg
          width={radius * 2 + strokeWidth * 2}
          height={radius * 2 + strokeWidth * 2}
          className="-rotate-90"
          role="img"
          aria-label={`Olgunluk puanı yüzde ${target}, ${label}`}
        >
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="var(--surface-2)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={inView ? circumference - progress : circumference}
            style={{ transition: "stroke-dashoffset 900ms var(--ease-out-quart)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={size === "large" ? "t-metric-lg" : "t-metric"}
            style={{ color: "var(--ink)" }}
          >
            {displayScore}%
          </span>
        </div>
      </div>
      <p className="mt-3 t-sm" style={{ color: "var(--ink-2)" }}>
        {label ?? ""}
      </p>
    </div>
  );
}
