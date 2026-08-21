"use client";

import { useState, useEffect } from "react";
import { ProgressBenchmarkChart } from "@/components/ui/progress-benchmark-chart";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

interface CategoryItem {
  id: string;
  name: string;
  baseScore: number;
  bonusPoints: number;
  totalScore: number;
  completedCount: number;
  responseCount: number;
  subCategories: Array<{
    id: string;
    name: string;
    baseScore: number;
    bonusPoints: number;
    totalScore: number;
    completedCount: number;
    responseCount: number;
  }>;
}

interface ProgressData {
  categories: CategoryItem[];
  overall: {
    velocity: { baseScore: number; bonusPoints: number; totalScore: number };
    endurance: { baseScore: number; bonusPoints: number; totalScore: number };
    totalCompletedRecommendations: number;
    totalResponses: number;
  };
}

export function ProgressSection({ surveyId }: { surveyId?: string }) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'category' | 'subcategory'>('subcategory');

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const url = surveyId 
          ? `/api/progress-scores?surveyId=${surveyId}`
          : '/api/progress-scores';
        const res = await fetch(url);
        if (!res.ok) {
          setData(null);
          return;
        }
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching progress:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [surveyId]);

  if (loading) {
    return <div className="skeleton h-[420px]" />;
  }

  if (!data || !data.categories || !Array.isArray(data.categories)) {
    return (
      <section
        className="rounded-[var(--radius-lg)] p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <h3 className="t-subhead" style={{ color: "var(--ink)" }}>
          İlerleme ve gelişim
        </h3>
        <p className="mt-2 t-sm" style={{ color: "var(--ink-3)" }}>
          Öneriler tamamlandıkça kazanılan puan burada görünür.
        </p>
      </section>
    );
  }

  // Kategori dizisinden alt kategorileri çıkar
  const allSubCategories = data.categories.flatMap(cat => 
    (cat.subCategories || []).map(subCat => ({
      ...subCat,
      categoryName: cat.name
    }))
  );

  // Genel ortalama skor hesapla
  const overallBaseScore = data.categories.length > 0
    ? data.categories.reduce((sum, cat) => sum + (cat.baseScore || 0), 0) / data.categories.length
    : 0;
  const overallBonusPoints = data.categories.reduce((sum, cat) => sum + (cat.bonusPoints || 0), 0);

  const chartCategories = viewMode === 'category' 
    ? data.categories.map(cat => ({
        name: cat.name || '',
        surveyScore: cat.baseScore || 0,
        progressScore: cat.totalScore || 0,
        delta: cat.bonusPoints || 0
      }))
    : allSubCategories.map(subCat => ({
        name: subCat.name || '',
        surveyScore: subCat.baseScore || 0,
        progressScore: subCat.totalScore || 0,
        delta: subCat.bonusPoints || 0
      }));

  const hasDelta = overallBonusPoints > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasDelta && (
        <p
          className="flex items-start gap-2.5 rounded-[var(--radius-xs)] p-3 t-sm"
          style={{ background: "var(--success-bg)", color: "var(--success)" }}
        >
          <TrendingUp className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <span>
            Tamamlanan öneriler puanınızı{" "}
            <span className="tabular font-medium">+{overallBonusPoints.toFixed(2)}</span> artırdı.{" "}
            <Link href="/roadmap" className="underline underline-offset-4">
              Yol haritasına git
            </Link>
          </span>
        </p>
      )}

      {/* Kırılım seçimi: aynı grafiğin iki görünümü, sekme dili kullanılır. */}
      <div className="theme-tabs" role="tablist" aria-label="Kırılım">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'subcategory'}
          onClick={() => setViewMode('subcategory')}
          className={`theme-tab ${viewMode === 'subcategory' ? 'active' : ''}`}
        >
          Alt kategoriler
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'category'}
          onClick={() => setViewMode('category')}
          className={`theme-tab ${viewMode === 'category' ? 'active' : ''}`}
        >
          Kategoriler
        </button>
      </div>

      {/* Chart */}
      <ProgressBenchmarkChart
        title="Benchmark"
        overall={{ 
          surveyScore: overallBaseScore, 
          progressScore: Math.min(5, overallBaseScore + overallBonusPoints), 
          delta: overallBonusPoints,
          name: "Genel" 
        }}
        categories={chartCategories}
      />
    </div>
  );
}
