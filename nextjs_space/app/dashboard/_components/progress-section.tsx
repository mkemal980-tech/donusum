"use client";

import { useState, useEffect } from "react";
import { ProgressBenchmarkChart } from "@/components/ui/progress-benchmark-chart";
import { TrendingUp, Target, Info } from "lucide-react";
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
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="text-[var(--accent)]" size={24} />
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Benchmark</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !data.categories || !Array.isArray(data.categories)) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="text-[var(--accent)]" size={24} />
          <h3 className="text-lg font-semibold text-[var(--text-main)]">Benchmark</h3>
        </div>
        <div className="text-center py-8 text-[var(--text-muted)]">
          Henüz veri bulunmuyor
        </div>
      </div>
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
    <div className="space-y-4">
      {/* Info Box */}
      {hasDelta && (
        <div className="bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] rounded-xl p-4 flex items-start gap-3">
          <TrendingUp className="text-[#22c55e] mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-[#22c55e]">Gelişim Kaydedildi!</p>
            <p className="text-sm text-[#22c55e]">
              Önerileri tamamlayarak skorunuzu <span className="font-bold">+{overallBonusPoints.toFixed(2)}</span> puan artırdınız.
              <Link href="/roadmap" className="underline ml-1 hover:text-[#16a34a]">Yol haritasına git →</Link>
            </p>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('subcategory')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'subcategory'
              ? 'bg-[rgba(245,158,11,0.2)] text-[#f59e0b]'
              : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
          }`}
        >
          Alt Kategoriler
        </button>
        <button
          onClick={() => setViewMode('category')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'category'
              ? 'bg-[rgba(6,182,212,0.2)] text-[#06b6d4]'
              : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
          }`}
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
