"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MaturityGauge } from "@/components/ui/maturity-gauge";
import { GapRadarChart } from "@/components/ui/gap-radar-chart";
import { ArrowLeft, TrendingUp, Layers, ChevronRight } from "lucide-react";
import Link from "next/link";

interface SubLevel {
  id: string;
  name: string;
  score: number;
  percentage: number;
  questionCount: number;
  answeredCount: number;
}

interface SubCategory {
  id: string;
  name: string;
  score: number;
  percentage: number;
  target: number;
  subLevels: SubLevel[];
}

interface Category {
  id: string;
  name: string;
  description: string;
  score: number;
  percentage: number;
  subCategories: SubCategory[];
}

interface CategoryScores {
  overallScore: number;
  overallPercentage: number;
  categories: Category[];
}

const categoryColors: Record<string, string> = {
  "Environmental Sustainability": "#22c55e",
  "Çevresel Sürdürülebilirlik": "#22c55e",
  "Çevre": "#22c55e",
  "Social Responsibility": "#f59e0b",
  "Sosyal Sorumluluk": "#f59e0b",
  "Sosyal": "#f59e0b",
  "Governance & Ethics": "#8b5cf6",
  "Yönetişim & Etik": "#8b5cf6",
  "Yönetişim": "#8b5cf6",
  "Digital Transformation": "#3b82f6",
  "Dijital Dönüşüm": "#3b82f6",
};

const getScoreLabel = (score: number): string => {
  if (score >= 4.5) return "Lider";
  if (score >= 3.5) return "Olgun";
  if (score >= 2.5) return "Gelişen";
  if (score >= 1.5) return "Farkındalık";
  return "Başlangıç";
};

export function CategoryDashboard() {
  const [data, setData] = useState<CategoryScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/survey/category-scores");
        const result = await res.json();
        setData(result);
        if (result.categories?.length > 0) {
          setActiveCategory(result.categories[0].id);
        }
      } catch (error) {
        console.error("Error fetching category scores:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="bg-[#1e1e2f] rounded-xl p-8 text-center">
        <p className="text-gray-400">Henüz kategori verisi bulunmuyor</p>
      </div>
    );
  }

  const currentCategory = data.categories.find(c => c.id === activeCategory);

  // If a subcategory is selected, show its details
  if (selectedSubCategory && currentCategory) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedSubCategory(null)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Geri Dön</span>
        </button>

        {/* SubCategory Header */}
        <div className="bg-gradient-to-r from-[#1e3a8a] to-[#7c3aed] rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white">{selectedSubCategory.name}</h2>
          <p className="text-white/70 mt-1">{currentCategory.name}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <span className="text-white/70 text-sm">Puan</span>
              <p className="text-2xl font-bold text-white">{selectedSubCategory.score.toFixed(1)}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <span className="text-white/70 text-sm">Seviye</span>
              <p className="text-xl font-bold text-white">{getScoreLabel(selectedSubCategory.score)}</p>
            </div>
          </div>
        </div>

        {/* SubLevels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSubCategory.subLevels.map((subLevel) => (
            <div key={subLevel.id} className="bg-[#1e1e2f] rounded-xl p-5">
              <h4 className="text-white font-medium mb-3">{subLevel.name}</h4>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Puan</span>
                <span className="text-xl font-bold text-purple-400">{subLevel.score.toFixed(1)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${subLevel.percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{getScoreLabel(subLevel.score)}</span>
                <span>{subLevel.answeredCount}/{subLevel.questionCount} soru</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {data.categories.map((category) => {
          const isActive = activeCategory === category.id;
          const color = categoryColors[category.name] || "#8b5cf6";
          
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                isActive
                  ? "text-white shadow-lg"
                  : "bg-[#2a2a3d] text-gray-400 hover:bg-[#3a3a4d] hover:text-white"
              }`}
              style={isActive ? { backgroundColor: color } : {}}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {currentCategory && (
          <motion.div
            key={currentCategory.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Maturity Gauge */}
            <MaturityGauge
              score={currentCategory.score}
              title="Seviyelendirme"
            />

            {/* GAP Analysis Radar */}
            <GapRadarChart
              title="GAP Analizi"
              data={currentCategory.subCategories.map(sub => ({
                name: sub.name,
                score: sub.score,
                target: sub.target
              }))}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SubCategories List */}
      {currentCategory && currentCategory.subCategories.length > 0 && (
        <div className="bg-[#1e1e2f] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Layers size={20} />
            Alt Kategoriler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentCategory.subCategories.map((subCat) => (
              <button
                key={subCat.id}
                onClick={() => setSelectedSubCategory(subCat)}
                className="bg-[#2a2a3d] hover:bg-[#3a3a4d] rounded-xl p-4 text-left transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium">{subCat.name}</h4>
                  <ChevronRight className="text-gray-500 group-hover:text-white transition-colors" size={20} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-sm">Puan</span>
                      <span className="text-purple-400 font-bold">{subCat.score.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${subCat.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">{getScoreLabel(subCat.score)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
