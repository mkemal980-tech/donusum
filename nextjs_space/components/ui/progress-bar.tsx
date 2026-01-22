"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

interface ProgressBarProps {
  value: number;
  label: string;
  color?: string;
}

export default function ProgressBar({ value, label, color = "var(--primary)" }: ProgressBarProps) {
  const { ref, inView } = useInView({ triggerOnce: true });

  return (
    <div ref={ref} className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label ?? ''}</span>
        <span className="text-sm font-semibold" style={{ color }}>{value ?? 0}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden bg-[var(--border-light)]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: inView ? `${value ?? 0}%` : 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}