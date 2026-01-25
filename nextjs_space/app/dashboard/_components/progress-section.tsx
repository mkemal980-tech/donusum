"use client";

import { useState, useEffect } from "react";
import { ProgressBenchmarkChart } from "@/components/ui/progress-benchmark-chart";
import { TrendingUp, Target, Info } from "lucide-react";
import Link from "next/link";

interface ProgressData {
  overall: {
    surveyScore: number;
    progressScore: number;
    delta: number;
  };
  categories: Record<string, {
    surveyScore: number;
    progressScore: number;
    delta: number;
    name: string;
  }>;
  subCategories: Record<string, {
    surveyScore: number;
    progressScore: number;
    delta: number;
    name: string;
    categoryId: string;
    categoryName: string;
  }>;
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
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="text-violet-400" size={24} />
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Benchmark</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="text-violet-400" size={24} />
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Benchmark</h3>
        </div>
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          Veri yüklenemedi
        </div>
      </div>
    );
  }

  // Kategori veya alt kategori verilerini hazırla
  const chartCategories = viewMode === 'category' 
    ? Object.values(data.categories).map(cat => ({
        name: cat.name,
        surveyScore: cat.surveyScore,
        progressScore: cat.progressScore,
        delta: cat.delta
      }))
    : Object.values(data.subCategories).map(subCat => ({
        name: subCat.name,
        surveyScore: subCat.surveyScore,
        progressScore: subCat.progressScore,
        delta: subCat.delta
      }));

  const hasDelta = data.overall.delta > 0;

  return (
    <div className="space-y-4">
      {/* Info Box */}
      {hasDelta && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
          <TrendingUp className="text-emerald-400 mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-emerald-400">Gelişim Kaydedildi!</p>
            <p className="text-sm text-emerald-300">
              Önerileri tamamlayarak skorunuzu <span className="font-bold">+{data.overall.delta.toFixed(2)}</span> puan artırdınız.
              <Link href="/roadmap" className="underline ml-1 hover:text-emerald-200">Yol haritasına git →</Link>
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
              ? 'bg-[rgba(245,158,11,0.1)]0 text-white'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
          }`}
        >
          Alt Kategoriler
        </button>
        <button
          onClick={() => setViewMode('category')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'category'
              ? 'bg-[rgba(6,182,212,0.1)]0 text-white'
              : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
          }`}
        >
          Kategoriler
        </button>
      </div>

      {/* Chart */}
      <ProgressBenchmarkChart
        title="Benchmark"
        overall={{ ...data.overall, name: "Genel" }}
        categories={chartCategories}
      />
    </div>
  );
}
