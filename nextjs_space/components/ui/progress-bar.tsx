"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";

interface ProgressBarProps {
  value: number;
  label: string;
  color?: string;
}

export default function ProgressBar({ value, label, color = "#1e3a8a" }: ProgressBarProps) {
  const { ref, inView } = useInView({ triggerOnce: true });

  return (
    <div ref={ref} className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">{label ?? ''}</span>
        <span className="text-sm font-semibold" style={{ color }}>{value ?? 0}%</span>
      </div>
      <div className="progress-bar">
        <motion.div
          className="progress-bar-fill"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: inView ? `${value ?? 0}%` : 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}