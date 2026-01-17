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

export default function ScoreCard({ score, label, color = "#1e3a8a", size = "large" }: ScoreCardProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const { ref, inView } = useInView({ triggerOnce: true });

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
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${size === "large" ? "text-4xl" : "text-xl"}`} style={{ color }}>
            {displayScore}%
          </span>
        </div>
      </div>
      <p className={`mt-3 font-medium text-gray-700 ${size === "large" ? "text-lg" : "text-sm"}`}>{label ?? ''}</p>
    </motion.div>
  );
}