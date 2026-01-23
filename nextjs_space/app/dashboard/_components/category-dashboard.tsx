"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MaturityGauge, getScoreLevel } from "@/components/ui/maturity-gauge";
import { GapRadarChart } from "@/components/ui/gap-radar-chart";
import { ArrowLeft, TrendingUp, Layers, ChevronRight, Award } from "lucide-react";

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
  weight: number;
  subCategories: SubCategory[];
}

interface CategoryScores {
  overallScore: number;
  overallPercentage: number;
  categories: Category[];
}

// Theme colors - Cyan/Teal tones (matching template)
const getCategoryColor = (index: number): string => {
  const colors = [
    "#22d3ee", // cyan primary
    "#38bdf8", // light blue
    "#2dd4bf", // teal
    "#5eead4", // cyan light
    "#67e8f9", // cyan lightest
  ];
  return colors[index % colors.length];
};

interface CategoryDashboardProps {
  surveyId?: string;
}

export function CategoryDashboard({ surveyId }: CategoryDashboardProps) {
  const [data, setData] = useState<CategoryScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = surveyId 
          ? `/api/survey/category-scores?surveyId=${surveyId}`
          : "/api/survey/category-scores";
        const res = await fetch(url);
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
  }, [surveyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.categories.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft p-8 text-center border border-gray-200 dark:border-slate-700">
        <p className="text-gray-500 dark:text-gray-400">Henüz kategori verisi bulunmuyor</p>
      </div>
    );
  }

  const currentCategory = data.categories.find(c => c.id === activeCategory);
  const currentCategoryIndex = data.categories.findIndex(c => c.id === activeCategory);
  const overallLevel = getScoreLevel(data.overallScore);

  // If a subcategory is selected, show its details
  if (selectedSubCategory && currentCategory) {
    const subCatLevel = getScoreLevel(selectedSubCategory.score);
    
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedSubCategory(null)}
          className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Geri Dön</span>
        </button>

        {/* SubCategory Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-teal-500 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 shadow-lg border border-transparent dark:border-slate-600">
          <h2 className="text-2xl font-bold text-white dark:text-gray-100">{selectedSubCategory.name}</h2>
          <p className="text-white/70 dark:text-gray-400 mt-1">{currentCategory.name}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="bg-white/20 dark:bg-slate-900/50 rounded-xl px-4 py-2 backdrop-blur-sm">
              <span className="text-white/70 dark:text-gray-400 text-sm">Puan</span>
              <p className="text-2xl font-bold text-white dark:text-cyan-400">{selectedSubCategory.score.toFixed(1)}</p>
            </div>
            <div 
              className="rounded-xl px-4 py-2"
              style={{ backgroundColor: subCatLevel.color }}
            >
              <span className="text-white/70 text-sm">Seviye</span>
              <p className="text-xl font-bold text-white">{subCatLevel.label}</p>
            </div>
          </div>
        </div>

        {/* SubLevels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSubCategory.subLevels.map((subLevel) => {
            const levelInfo = getScoreLevel(subLevel.score);
            return (
              <div key={subLevel.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft p-5 border border-gray-200 dark:border-slate-700">
                <h4 className="text-gray-800 dark:text-gray-100 font-medium mb-3">{subLevel.name}</h4>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">Puan</span>
                  <span className="text-xl font-bold" style={{ color: levelInfo.color }}>
                    {subLevel.score.toFixed(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 mb-3">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${subLevel.percentage}%`,
                      backgroundColor: levelInfo.color
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                  <span 
                    className="px-3 py-1 rounded-full text-white text-xs font-medium"
                    style={{ backgroundColor: levelInfo.color }}
                  >
                    {levelInfo.label}
                  </span>
                  <span>{subLevel.answeredCount}/{subLevel.questionCount} soru</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className="bg-gradient-to-r from-cyan-500 to-teal-500 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-6 shadow-lg border border-transparent dark:border-slate-600">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 dark:bg-slate-900/50 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Award className="text-white dark:text-cyan-400" size={28} />
            </div>
            <div>
              <p className="text-white/70 dark:text-gray-400 text-sm">Genel Olgunluk Seviyesi</p>
              <p className="text-3xl font-bold text-white dark:text-gray-100">{data.overallScore.toFixed(1)} / 5.0</p>
            </div>
          </div>
          <div 
            className="px-6 py-3 rounded-2xl text-white font-bold text-lg shadow-lg"
            style={{ backgroundColor: overallLevel.color }}
          >
            {overallLevel.label}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        {data.categories.map((category, index) => {
          const isActive = activeCategory === category.id;
          const color = getCategoryColor(index);
          
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                isActive
                  ? "text-white shadow-lg"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
              style={isActive ? { backgroundColor: color } : {}}
            >
              {category.name}
              {category.weight !== 1 && (
                <span className="ml-2 text-xs opacity-75">({(category.weight * 100).toFixed(0)}%)</span>
              )}
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
              showOverallLevel={true}
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Layers size={20} className="text-teal-500 dark:text-cyan-400" />
            Alt Kategoriler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentCategory.subCategories.map((subCat) => {
              const levelInfo = getScoreLevel(subCat.score);
              return (
                <button
                  key={subCat.id}
                  onClick={() => setSelectedSubCategory(subCat)}
                  className="bg-gray-50 dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-700 rounded-xl p-4 text-left transition-all duration-200 group border border-gray-100 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-600"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-gray-800 dark:text-gray-100 font-medium">{subCat.name}</h4>
                    <ChevronRight className="text-gray-400 dark:text-gray-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors" size={20} />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-gray-500 dark:text-gray-400 text-sm">Puan</span>
                        <span className="font-bold" style={{ color: levelInfo.color }}>
                          {subCat.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${subCat.percentage}%`,
                            backgroundColor: levelInfo.color
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <span 
                        className="text-xs px-3 py-1 rounded-full text-white font-medium"
                        style={{ backgroundColor: levelInfo.color }}
                      >
                        {levelInfo.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
