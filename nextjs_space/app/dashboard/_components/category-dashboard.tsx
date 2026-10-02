"use client";

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { MaturityGauge, getScoreLevel } from "@/components/ui/maturity-gauge";
import { GapRadarChart } from "@/components/ui/gap-radar-chart";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Lightbulb, Lock, Plus } from "lucide-react";
import { getNextMaturityLevel } from "@/lib/dashboard-result";
import { Button } from "@/components/ui/button";

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

type StartingRecommendation = {
  id: string;
  title: string;
  description: string;
  strategicType: string;
  timeframe: string;
  costType: string;
  estimatedImpact: number;
  isInRoadmap: boolean;
  isActionable: boolean;
  stepDistance: number;
  reasons: string[];
};

type RecommendationGroup = {
  total: number;
  recommendations: StartingRecommendation[];
};

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
  selectedCategoryId?: string | null;
  onCategoryChange?: (categoryId: string) => void;
}

export function CategoryDashboard({
  surveyId,
  selectedCategoryId,
  onCategoryChange,
}: CategoryDashboardProps) {
  const [data, setData] = useState<CategoryScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [recommendationGroups, setRecommendationGroups] = useState<Record<string, RecommendationGroup>>({});
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [addingRecommendationId, setAddingRecommendationId] = useState<string | null>(null);
  const returnFocusSubCategoryIdRef = useRef<string | null>(null);
  const selectedSubCategoryId = selectedSubCategory?.id ?? null;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = surveyId 
          ? `/api/survey/category-scores?surveyId=${surveyId}`
          : "/api/survey/category-scores";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Kategori puanları alınamadı");
        const result = await res.json();
        setData(result);
        if (result.categories?.length > 0) {
          const weakest = [...result.categories].sort(
            (a: Category, b: Category) => a.percentage - b.percentage
          )[0];
          setActiveCategory(weakest.id);
          setSelectedSubCategory(null);
        }
      } catch (error) {
        console.error("Error fetching category scores:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [surveyId]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!surveyId) {
        setRecommendationGroups({});
        setRecommendationsLoading(false);
        return;
      }
      setRecommendationsLoading(true);
      setRecommendationsError(false);
      try {
        const response = await fetch(
          `/api/dashboard/subcategory-recommendations?surveyId=${encodeURIComponent(surveyId)}`
        );
        if (!response.ok) throw new Error("Alt kategori önerileri alınamadı");
        const result = await response.json();
        setRecommendationGroups(result.groups ?? {});
      } catch (error) {
        console.error("Error fetching subcategory recommendations:", error);
        setRecommendationGroups({});
        setRecommendationsError(true);
      } finally {
        setRecommendationsLoading(false);
      }
    };
    fetchRecommendations();
  }, [surveyId]);

  useEffect(() => {
    if (!data?.categories.length) return;
    const requested = data.categories.find((category) => category.id === selectedCategoryId);
    const weakest = [...data.categories].sort((a, b) => a.percentage - b.percentage)[0];
    const nextCategoryId = requested?.id ?? weakest.id;
    if (activeCategory !== nextCategoryId) {
      setActiveCategory(nextCategoryId);
      setSelectedSubCategory(null);
    }
    if (selectedCategoryId !== nextCategoryId) onCategoryChange?.(nextCategoryId);
  }, [activeCategory, data, onCategoryChange, selectedCategoryId]);

  useEffect(() => {
    if (selectedSubCategoryId) {
      document.getElementById("subcategory-detail-heading")?.focus();
      return;
    }

    const returnId = returnFocusSubCategoryIdRef.current;
    if (returnId) {
      document.getElementById(`subcategory-card-${returnId}`)?.focus();
      returnFocusSubCategoryIdRef.current = null;
    }
  }, [selectedSubCategoryId]);

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
  const overallLevel = getScoreLevel(data.overallScore);
  const percentages = data.categories.map((category) => category.percentage);
  const lowestPercentage = Math.min(...percentages);
  const highestPercentage = Math.max(...percentages);
  const hasDistinctExtremes = lowestPercentage !== highestPercentage;
  const currentLevel = currentCategory ? getScoreLevel(currentCategory.score) : null;
  const nextLevel = currentCategory ? getNextMaturityLevel(currentCategory.score) : null;

  const selectCategory = (categoryId: string) => {
    setActiveCategory(categoryId);
    setSelectedSubCategory(null);
    onCategoryChange?.(categoryId);
  };

  const handleCategoryKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    if (!data?.categories.length) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % data.categories.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + data.categories.length) % data.categories.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = data.categories.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextCategory = data.categories[nextIndex];
    selectCategory(nextCategory.id);
    requestAnimationFrame(() => {
      document.getElementById(`category-tab-${nextCategory.id}`)?.focus();
    });
  };

  const returnToSubCategory = (subCategoryId: string) => {
    returnFocusSubCategoryIdRef.current = subCategoryId;
    setSelectedSubCategory(null);
  };

  const addToRoadmap = async (recommendationId: string) => {
    setAddingRecommendationId(recommendationId);
    try {
      const response = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(result?.error || "Öneri yol haritasına eklenemedi");
        return;
      }

      setRecommendationGroups((current) =>
        Object.fromEntries(
          Object.entries(current).map(([subCategoryId, group]) => [
            subCategoryId,
            {
              ...group,
              recommendations: group.recommendations.map((recommendation) =>
                recommendation.id === recommendationId
                  ? { ...recommendation, isInRoadmap: true }
                  : recommendation
              ),
            },
          ])
        )
      );
      toast.success("Öneri yol haritasına eklendi");
    } catch (error) {
      console.error("Error adding recommendation to roadmap:", error);
      toast.error("Öneri yol haritasına eklenirken bir hata oluştu");
    } finally {
      setAddingRecommendationId(null);
    }
  };

  // If a subcategory is selected, show its details
  if (selectedSubCategory && currentCategory) {
    const subCatLevel = getScoreLevel(selectedSubCategory.score);
    const recommendationGroup = recommendationGroups[selectedSubCategory.id] ?? {
      total: 0,
      recommendations: [],
    };
    
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => returnToSubCategory(selectedSubCategory.id)}
          className="btn-ghost -ml-3 self-start"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Kategori kırılımına dön
        </button>

        <div>
          <p className="t-caption">{currentCategory.name}</p>
          <h3
            id="subcategory-detail-heading"
            tabIndex={-1}
            className="mt-1.5 t-title focus-visible:outline-none"
            style={{ color: "var(--ink)" }}
          >
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

        <section
          className="rounded-[var(--radius-lg)] p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          aria-labelledby="starting-recommendations-heading"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 id="starting-recommendations-heading" className="t-subhead" style={{ color: "var(--ink)" }}>
                Başlamak için önerilen adımlar
              </h3>
              <p className="mt-1 max-w-[70ch] t-sm" style={{ color: "var(--ink-2)" }}>
                Bu adımlar yanıtlarınız, uygulanabilirlik ve beklenen etkiye göre öne çıkarılmıştır.
                Diğer öneriler gelişim planının tamamlayıcı parçalarıdır.
              </p>
            </div>
            {recommendationGroup.total > 0 && (
              <Link
                href={{
                  pathname: "/recommendations",
                  query: {
                    surveyId,
                    subCategoryId: selectedSubCategory.id,
                    subCategoryName: selectedSubCategory.name,
                  },
                }}
                className="inline-flex shrink-0 items-center gap-1.5 t-sm font-medium underline-offset-4 hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Tüm önerileri gör ({recommendationGroup.total})
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>

          {recommendationsLoading ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3" aria-label="Öneriler yükleniyor">
              {[0, 1, 2].map((item) => <div key={item} className="skeleton h-48" />)}
            </div>
          ) : recommendationsError ? (
            <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--warning-bg)" }} role="alert">
              <Lightbulb className="mt-0.5 shrink-0" size={18} style={{ color: "var(--warning)" }} aria-hidden="true" />
              <p className="t-sm" style={{ color: "var(--ink-2)" }}>
                Öneriler şu anda yüklenemedi. Sayfayı yenileyerek tekrar deneyebilirsiniz.
              </p>
            </div>
          ) : recommendationGroup.recommendations.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {recommendationGroup.recommendations.map((recommendation) => (
                <article
                  key={recommendation.id}
                  className="flex min-h-48 flex-col rounded-[var(--radius-md)] p-4"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-primary">
                      {recommendation.strategicType === "QUICK_WIN"
                        ? "Hızlı kazanım"
                        : recommendation.strategicType === "BIG_BET"
                          ? "Büyük yatırım"
                          : "Proje"}
                    </span>
                    {!recommendation.isActionable && (
                      <span className="badge badge-neutral inline-flex items-center gap-1">
                        <Lock size={11} aria-hidden="true" />
                        Sırası gelmedi
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                    {recommendation.title}
                  </h4>
                  <p className="mt-2 line-clamp-3 t-sm" style={{ color: "var(--ink-2)" }}>
                    {recommendation.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    {recommendation.reasons.map((reason) => (
                      <span key={reason} className="badge badge-neutral">{reason}</span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: "var(--line)" }}>
                    <Button asChild variant="ghost" size="sm">
                      <Link
                        href={{
                          pathname: "/recommendations",
                          query: {
                            surveyId,
                            subCategoryId: selectedSubCategory.id,
                            subCategoryName: selectedSubCategory.name,
                            recommendationId: recommendation.id,
                          },
                        }}
                      >
                        İncele
                      </Link>
                    </Button>
                    {recommendation.isInRoadmap ? (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={{
                            pathname: "/roadmap",
                            query: {
                              recommendationId: recommendation.id,
                              subCategoryName: selectedSubCategory.name,
                            },
                          }}
                        >
                          <Check size={14} aria-hidden="true" />
                          Yol haritasında
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!recommendation.isActionable}
                        loading={addingRecommendationId === recommendation.id}
                        title={!recommendation.isActionable ? "Önce mevcut basamaktaki adımı tamamlayın" : undefined}
                        onClick={() => addToRoadmap(recommendation.id)}
                      >
                        {addingRecommendationId !== recommendation.id && (
                          recommendation.isActionable
                            ? <Plus size={14} aria-hidden="true" />
                            : <Lock size={14} aria-hidden="true" />
                        )}
                        {recommendation.isActionable ? "Yol haritasına ekle" : "Sırası gelmedi"}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
              <Lightbulb className="mt-0.5 shrink-0" size={18} style={{ color: "var(--ink-3)" }} aria-hidden="true" />
              <p className="t-sm" style={{ color: "var(--ink-2)" }}>
                Bu alt kategori için yanıtlarınızla eşleşen bir öneri bulunmuyor.
              </p>
            </div>
          )}
        </section>
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
        {data.categories.map((category, categoryIndex) => {
          const isActive = activeCategory === category.id;
          const isHighest = hasDistinctExtremes && category.percentage === highestPercentage;
          const isLowest = hasDistinctExtremes && category.percentage === lowestPercentage;

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`category-panel-${category.id}`}
              id={`category-tab-${category.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectCategory(category.id)}
              onKeyDown={(event) => handleCategoryKeyDown(event, categoryIndex)}
              className={`theme-tab ${isActive ? "active" : ""}`}
            >
              {category.name}
              <span className="ml-1.5 tabular" style={{ color: isActive ? "inherit" : "var(--ink-2)" }}>
                %{Math.round(category.percentage)}
              </span>
              {isHighest && <span className="ml-1.5 badge badge-success">En yüksek</span>}
              {isLowest && <span className="ml-1.5 badge badge-neutral">En düşük</span>}
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

      {currentCategory && currentLevel && (
        <div
          className="flex flex-col gap-2 rounded-[var(--radius-md)] p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: "var(--surface-2)" }}
        >
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              {currentCategory.name}
            </h3>
            {currentCategory.description && (
              <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
                {currentCategory.description}
              </p>
            )}
          </div>
          <p className="shrink-0 t-sm" style={{ color: "var(--ink-2)" }}>
            <span className="tabular font-medium" style={{ color: "var(--ink)" }}>
              {currentCategory.score.toFixed(1)} / 5
            </span>{" "}
            · {currentLevel.label}
            {nextLevel ? (
              <> · {nextLevel.label} seviyesine <span className="tabular">{nextLevel.pointsNeeded.toFixed(1)}</span> puan</>
            ) : (
              <> · En üst seviye</>
            )}
          </p>
        </div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {currentCategory && (
          <motion.div
            key={currentCategory.id}
            id={`category-panel-${currentCategory.id}`}
            role="tabpanel"
            aria-labelledby={`category-tab-${currentCategory.id}`}
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
              title="Mevcut durum ve üst seviye farkı"
              targetLabel="Üst seviye (5/5)"
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
              const recommendationCount = recommendationGroups[subCat.id]?.total ?? 0;
              return (
                <button
                  key={subCat.id}
                  id={`subcategory-card-${subCat.id}`}
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
                    <div className="flex flex-wrap gap-2">
                      <span className="badge badge-neutral">{levelInfo.label}</span>
                      <span className="badge badge-primary">
                        {recommendationsLoading
                          ? "Öneriler yükleniyor"
                          : recommendationsError
                            ? "Öneriler yüklenemedi"
                            : `${recommendationCount} öneri`}
                      </span>
                    </div>
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
