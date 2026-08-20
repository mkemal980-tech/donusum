"use client";

import { useInView } from "react-intersection-observer";

interface ProgressBarProps {
  value: number;
  label: string;
  color?: string;
}

/**
 * Etiketli ilerleme çubuğu.
 *
 * Dolgu genişliği CSS geçişiyle animasyonlanır; görünür alana girince
 * 0'dan değerine gider. `prefers-reduced-motion` globals.css'te tüm
 * geçişleri kapattığı için burada ayrıca kontrol gerekmiyor.
 */
export default function ProgressBar({ value, label, color = "var(--accent)" }: ProgressBarProps) {
  const { ref, inView } = useInView({ triggerOnce: true });
  const safeValue = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div ref={ref} className="w-full">
      <div className="flex items-baseline justify-between gap-3">
        {label ? (
          <span className="truncate t-sm" style={{ color: "var(--ink-2)" }} title={label}>
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className="t-sm tabular font-medium" style={{ color: "var(--ink)" }}>
          {safeValue}%
        </span>
      </div>
      <div
        className="progress-bar mt-1.5"
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || undefined}
      >
        <div
          className="progress-bar-fill"
          style={{ width: inView ? `${safeValue}%` : 0, background: color }}
        />
      </div>
    </div>
  );
}
