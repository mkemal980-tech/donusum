"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ChevronDown, ChevronRight, Award, Target } from "lucide-react";

interface SubCategoryProgress {
  id: string;
  name: string;
  baseScore: number;
  bonusPoints: number;
  totalScore: number;
  completedCount: number;
  responseCount: number;
}

interface CategoryProgress {
  id: string;
  name: string;
  baseScore: number;
  bonusPoints: number;
  totalScore: number;
  completedCount: number;
  responseCount: number;
  subCategories: SubCategoryProgress[];
}

interface OverallProgress {
  velocity: { baseScore: number; bonusPoints: number; totalScore: number };
  endurance: { baseScore: number; bonusPoints: number; totalScore: number };
  totalCompletedRecommendations: number;
  totalResponses: number;
}

interface CategoryProgressChartProps {
  surveyId?: string;
}

export function CategoryProgressChart({ surveyId }: CategoryProgressChartProps) {
  const [categories, setCategories] = useState<CategoryProgress[]>([]);
  const [overall, setOverall] = useState<OverallProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const url = `/api/progress-scores${surveyId ? `?surveyId=${surveyId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
          setOverall(data.overall || null);
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, [surveyId]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]">
        <div className="animate-pulse">
          <div className="h-6 bg-[var(--bg-card-2)] rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-[var(--bg-card-2)] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  const ProgressBar = ({ item, isSubCategory = false }: { item: SubCategoryProgress | CategoryProgress; isSubCategory?: boolean }) => {
    const maxScore = 5;
    const safeBaseScore = item.baseScore ?? 0;
    const safeBonusPoints = item.bonusPoints ?? 0;
    const basePercent = (safeBaseScore / maxScore) * 100;
    const bonusPercent = (safeBonusPoints / maxScore) * 100;

    return (
      <div className={`${isSubCategory ? 'py-2 pl-6' : 'py-3'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`${isSubCategory ? 'text-sm text-[var(--text-muted)]' : 'text-sm font-medium text-[var(--text-main)]'}`}>
            {item.name || 'Kategori'}
          </span>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-[var(--accent)] font-medium">{safeBaseScore.toFixed(2)}</span>
            {safeBonusPoints > 0 && (
              <span className="text-[var(--series-2)] font-medium">+{safeBonusPoints.toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="relative h-6 bg-[var(--bg-card-2)] rounded-md overflow-hidden">
          {/* Base Score (Sarı) */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${basePercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute h-full bg-[var(--accent)] rounded-l-md"
          />
          {/* Bonus Points (Mavi) */}
          {safeBonusPoints > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bonusPercent}%` }}
              transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
              className="absolute h-full bg-[var(--series-2)]"
              style={{ left: `${basePercent}%` }}
            />
          )}
          {/* Puan etiketleri */}
          <div className="absolute inset-0 flex items-center">
            {basePercent > 15 && (
              <span 
                className="absolute text-xs font-bold text-white"
                style={{ left: `${Math.min(basePercent - 2, basePercent / 2)}%`, transform: 'translateX(-50%)' }}
              >
                {safeBaseScore.toFixed(2)}
              </span>
            )}
            {safeBonusPoints > 0 && bonusPercent > 10 && (
              <span 
                className="absolute text-xs font-bold text-white"
                style={{ left: `${basePercent + bonusPercent / 2}%`, transform: 'translateX(-50%)' }}
              >
                {safeBonusPoints.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-card)] rounded-xl p-6 border border-[var(--border-soft)]"
    >
      {/* Başlık */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-[var(--accent)]" />
          <h3 className="text-lg font-semibold text-[var(--text-main)]">İlerleme ve Gelişim</h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--accent)] rounded"></div>
            <span className="text-[var(--text-muted)]">Mevcut Puan</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[var(--series-2)] rounded"></div>
            <span className="text-[var(--text-muted)]">Kazanılan Bonus</span>
          </div>
        </div>
      </div>

      {/* Velocity & Endurance */}
      {overall && overall.velocity && overall.endurance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-[var(--bg-card-2)] rounded-lg">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-[var(--ink-3)]" />
              <span className="text-sm font-medium text-[var(--text-main)]">Velocity</span>
            </div>
            <div className="relative h-5 bg-[var(--bg-deep)] rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((overall.velocity.baseScore ?? 0) / 5) * 100}%` }}
                className="absolute h-full bg-[var(--accent)]"
              />
              {(overall.velocity.bonusPoints ?? 0) > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((overall.velocity.bonusPoints ?? 0) / 5) * 100}%` }}
                  className="absolute h-full bg-[var(--series-2)]"
                  style={{ left: `${((overall.velocity.baseScore ?? 0) / 5) * 100}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-[var(--accent)]">{(overall.velocity.baseScore ?? 0).toFixed(2)}</span>
              {(overall.velocity.bonusPoints ?? 0) > 0 && (
                <span className="text-[var(--series-2)]">+{(overall.velocity.bonusPoints ?? 0).toFixed(2)}</span>
              )}
              <span className="text-[var(--text-muted)]">
                Toplam: {(overall.velocity.totalScore ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award size={16} className="text-[var(--ink-3)]" />
              <span className="text-sm font-medium text-[var(--text-main)]">Endurance</span>
            </div>
            <div className="relative h-5 bg-[var(--bg-deep)] rounded overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((overall.endurance.baseScore ?? 0) / 5) * 100}%` }}
                className="absolute h-full bg-[var(--accent)]"
              />
              {(overall.endurance.bonusPoints ?? 0) > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((overall.endurance.bonusPoints ?? 0) / 5) * 100}%` }}
                  className="absolute h-full bg-[var(--series-2)]"
                  style={{ left: `${((overall.endurance.baseScore ?? 0) / 5) * 100}%` }}
                />
              )}
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-[var(--accent)]">{(overall.endurance.baseScore ?? 0).toFixed(2)}</span>
              {(overall.endurance.bonusPoints ?? 0) > 0 && (
                <span className="text-[var(--series-2)]">+{(overall.endurance.bonusPoints ?? 0).toFixed(2)}</span>
              )}
              <span className="text-[var(--text-muted)]">
                Toplam: {(overall.endurance.totalScore ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Kategori Listesi */}
      <div className="space-y-2">
        {categories.map((category) => (
          <div key={category.id} className="border border-[var(--border-soft)] rounded-lg overflow-hidden">
            {/* Kategori Başlığı */}
            <div
              className="cursor-pointer hover:bg-[var(--bg-card-2)] transition-colors"
              onClick={() => category.subCategories.length > 0 && toggleCategory(category.id)}
            >
              <div className="flex items-center gap-2 px-4 py-2">
                {category.subCategories.length > 0 && (
                  <span className="text-[var(--text-muted)]">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                )}
                <span className="flex-1">
                  <ProgressBar item={category} />
                </span>
              </div>
            </div>

            {/* Alt Kategoriler */}
            <AnimatePresence>
              {expandedCategories.has(category.id) && category.subCategories.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-[var(--border-soft)] bg-[var(--bg-card-2)]/50"
                >
                  {category.subCategories.map((subCat) => (
                    <div key={subCat.id} className="px-4">
                      <ProgressBar item={subCat} isSubCategory />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Özet */}
      {overall && overall.totalCompletedRecommendations > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--border-soft)] text-center">
          <p className="text-sm text-[var(--text-muted)]">
            <span className="text-[var(--accent)] font-semibold">{overall.totalCompletedRecommendations}</span>
            {' '}öneri tamamlandı • Bonus puanlar skorunuza eklendi
          </p>
        </div>
      )}
    </motion.div>
  );
}
