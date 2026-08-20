"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MaturityGauge, getScoreLevel } from "@/components/ui/maturity-gauge";
import { GapRadarChart } from "@/components/ui/gap-radar-chart";
import { ArrowLeft, ChevronRight } from "lucide-react";

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
    "var(--series-1)",
    "var(--series-2)",
    "var(--series-3)",
    "var(--series-4)",
    "var(--series-5)"
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
    return <div className="skeleton h-[420px]" />;
  }

  if (!data || data.categories.length === 0) {
    return (
      <section
        className="rounded-[var(--radius-lg)] p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <p className="t-body" style={{ color: "var(--ink-2)" }}>
          Kategori kırılımı, anketin ilk bölümü tamamlandığında oluşur.
        </p>
      </section>
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
        <button
          type="button"
          onClick={() => setSelectedSubCategory(null)}
          className="btn-ghost -ml-3 self-start"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Kategori kırılımına dön
        </button>

        <div>
          <p className="t-caption">{currentCategory.name}</p>
          <h3 className="mt-1.5 t-title" style={{ color: "var(--ink)" }}>
            {selectedSubCategory.name}
          </h3>
          <p className="mt-2 flex items-center gap-2.5 t-body" style={{ color: "var(--ink-2)" }}>
            <span className="tabular font-medium" style={{ color: "var(--ink)" }}>
              {selectedSubCategory.score.toFixed(1)} / 5
            </span>
            <span className="badge badge-neutral">{subCatLevel.label}</span>
          </p>
        </div>

        {/* SubLevels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedSubCategory.subLevels.map((subLevel) => {
            const levelInfo = getScoreLevel(subLevel.score);
            return (
              <div
                key={subLevel.id}
                className="rounded-[var(--radius-lg)] p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                <h4 className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                  {subLevel.name}
                </h4>
                <p className="mt-2 t-metric" style={{ color: "var(--ink)" }}>
                  {subLevel.score.toFixed(1)}
                  <span className="t-sm" style={{ color: "var(--ink-3)" }}>
                    {" "}/ 5
                  </span>
                </p>
                <div className="progress-bar mt-3">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${subLevel.percentage}%`, background: "var(--accent)" }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="badge badge-neutral">{levelInfo.label}</span>
                  <span className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
                    {subLevel.answeredCount}/{subLevel.questionCount} soru
                  </span>
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
      {/* Genel seviye: panonun tepesindeki puanın 1-5 karşılığı. Kendi
          renkli bloğunda değil, tek satırlık bir özet olarak durur. */}
      <p className="t-sm" style={{ color: "var(--ink-2)" }}>
        Genel olgunluk{" "}
        <span className="tabular font-medium" style={{ color: "var(--ink)" }}>
          {data.overallScore.toFixed(1)} / 5.0
        </span>{" "}
        · <span style={{ color: "var(--ink)" }}>{overallLevel.label}</span>
      </p>

      {/* Kategori sekmeleri */}
      <div className="theme-tabs flex-wrap" role="tablist" aria-label="Kategori">
        {data.categories.map((category) => {
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(category.id)}
              className={`theme-tab ${isActive ? "active" : ""}`}
            >
              {category.name}
              {category.weight !== 1 && (
                /* Ağırlık bir yüzde değil çarpan; "%200" yanlış okunuyordu. */
                <span className="ml-1.5 t-caption" style={{ letterSpacing: 0, color: "var(--ink-3)" }}>
                  ×{category.weight}
                </span>
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
        <section
          className="rounded-[var(--radius-lg)] p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          aria-labelledby="subcategory-heading"
        >
          <h3 id="subcategory-heading" className="t-subhead" style={{ color: "var(--ink)" }}>
            Alt kategoriler
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {currentCategory.subCategories.map((subCat) => {
              const levelInfo = getScoreLevel(subCat.score);
              return (
                <button
                  key={subCat.id}
                  type="button"
                  onClick={() => setSelectedSubCategory(subCat)}
                  className="group rounded-[var(--radius-md)] p-4 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-3)]"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="truncate text-[15px] font-medium" style={{ color: "var(--ink)" }}>
                      {subCat.name}
                    </h4>
                    <ChevronRight
                      size={16}
                      style={{ color: "var(--ink-3)" }}
                      className="shrink-0 transition-transform duration-fast ease-out-quart group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="badge badge-neutral">{levelInfo.label}</span>
                    <span className="t-sm tabular" style={{ color: "var(--ink-2)" }}>
                      {subCat.score.toFixed(1)} / 5
                    </span>
                  </div>

                  <div className="progress-bar mt-2">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${subCat.percentage}%`, background: "var(--accent)" }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
