"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

interface ScoreCardProps {
  score: number;
  label: string;
  color?: string;
  size?: "small" | "large";
}

export default function ScoreCard({ score, label, color, size = "large" }: ScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });

  // Default color uses CSS variable for theme support
  const strokeColor = color || "var(--primary)";

  useEffect(() => {
    if (inView) {
      const duration = 1500;
      const steps = 60;
      const stepValue = (score ?? 0) / steps;
      let current = 0;
      const interval = setInterval(() => {
        current += stepValue;
        if (current >= (score ?? 0)) {
          setDisplayScore(score ?? 0);
          clearInterval(interval);
        } else {
          setDisplayScore(Math.round(current));
        }
      }, duration / steps);
      return () => clearInterval(interval);
    }
  }, [inView, score]);

  const radius = size === "large" ? 80 : 40;
  const strokeWidth = size === "large" ? 12 : 6;
  const circumference = 2 * Math.PI * radius;
  const progress = ((score ?? 0) / 100) * circumference;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center"
    >
      <div className="relative">
        <svg
          width={radius * 2 + strokeWidth * 2}
          height={radius * 2 + strokeWidth * 2}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            className="stroke-gray-200 dark:stroke-dark-border"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <motion.circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="dark:drop-shadow-[0_0_8px_var(--primary)]"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span 
            className={`font-bold ${size === "large" ? "text-4xl" : "text-xl"} text-[var(--primary)]`}
          >
            {displayScore}%
          </span>
        </div>
      </div>
      <p className={`mt-3 font-medium text-[var(--text-secondary)] ${size === "large" ? "text-lg" : "text-sm"}`}>
        {label ?? ''}
      </p>
    </motion.div>
  );
}
