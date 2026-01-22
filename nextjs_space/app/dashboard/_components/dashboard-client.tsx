"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Header from "@/components/ui/header";
import ScoreCard from "@/components/ui/score-card";
import ProgressBar from "@/components/ui/progress-bar";
import { MaturityLevelBar } from "@/components/ui/maturity-level-bar";
import { BenchmarkSection } from "./benchmark-section";
import { ProgressSection } from "./progress-section";
import { CategoryDashboard } from "./category-dashboard";
import { IronmanChart } from "@/components/ui/ironman-chart";
import { 
  ClipboardList, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight,
  BarChart3,
  Lightbulb,
  Map,
  PieChart,
  FileText,
  Download,
  ChevronDown
} from "lucide-react";

interface CategoryScore {
  score: number;
  percentage: number;
  name: string;
}

interface ScoreData {
  totalScore: number;
  categoryScores: Record<string, CategoryScore>;
}

interface SurveyResponse {
  id: string;
  questionId: string;
}

interface Survey {
  id: string;
  name: string;
  isActive: boolean;
}

// Theme colors - all purple/indigo tones
const categoryColors = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#4f46e5",
  "#7c3aed"
];

/**
 * Yüzdeye göre olgunluk seviyesi hesaplama
 * %0-19: Başlangıç
 * %20-39: Farkındalık
 * %40-59: Gelişen
 * %60-79: Olgun
 * %80-100: Lider
 */
const getMaturityLevelFromPercentage = (percentage: number) => {
  if (percentage >= 80) return { label: 'Lider', color: '#4f46e5' };
  if (percentage >= 60) return { label: 'Olgun', color: '#6366f1' };
  if (percentage >= 40) return { label: 'Gelişen', color: '#8b5cf6' };
  if (percentage >= 20) return { label: 'Farkındalık', color: '#a78bfa' };
  return { label: 'Başlangıç', color: '#c4b5fd' };
};

/**
 * 1-5 puana göre olgunluk seviyesi hesaplama
 * Puan -> Yüzde dönüşümü: (puan - 1) / 4 * 100
 */
const getMaturityLevelFromScore = (score: number) => {
  const percentage = ((score - 1) / 4) * 100;
  return getMaturityLevelFromPercentage(percentage);
};

export default function DashboardClient() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Fetch assigned surveys for this user
  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const res = await fetch("/api/survey/assigned");
        if (res.ok) {
          const data = await res.json();
          const activeSurveys = (data ?? []).filter((s: Survey) => s.isActive);
          setSurveys(activeSurveys);
          if (activeSurveys.length > 0 && !selectedSurveyId) {
            setSelectedSurveyId(activeSurveys[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching surveys:", error);
      }
    };
    fetchSurveys();
  }, []);

  // Fetch dashboard data when survey changes
  useEffect(() => {
    if (!selectedSurveyId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const surveyParam = selectedSurveyId ? `?surveyId=${selectedSurveyId}` : '';
        
        const [scoreRes, responsesRes, structureRes] = await Promise.all([
          fetch(`/api/survey/score${surveyParam}`),
          fetch(`/api/survey/responses${surveyParam}`),
          fetch(`/api/survey/structure${surveyParam}`)
        ]);

        if (scoreRes.ok) {
          const score = await scoreRes.json();
          setScoreData(score);
        }

        if (responsesRes.ok) {
          const resp = await responsesRes.json();
          setResponses(resp ?? []);
        }

        if (structureRes.ok) {
          const structure = await structureRes.json();
          let count = 0;
          // Düzeltilmiş soru sayısı hesabı - hasSubLevels kontrolü
          (structure ?? []).forEach((cat: any) => {
            (cat?.subCategories ?? []).forEach((sub: any) => {
              if (sub?.hasSubLevels === false) {
                // Sorular doğrudan alt kategoride
                count += (sub?.questions?.length ?? 0);
              } else {
                // Sorular alt seviyelerde
                (sub?.subLevels ?? []).forEach((level: any) => {
                  count += (level?.questions?.length ?? 0);
                });
              }
            });
          });
          setTotalQuestions(count);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSurveyId]);

  const completedQuestions = responses?.length ?? 0;
  const completionPercentage = totalQuestions > 0 
    ? Math.round((completedQuestions / totalQuestions) * 100) 
    : 0;

  // PDF Oluşturma Fonksiyonu
  const generatePdfReport = async () => {
    setGeneratingPdf(true);
    try {
      // Kategori skorlarını al
      const categoryScoresRes = await fetch(`/api/survey/category-scores?surveyId=${selectedSurveyId}`);
      let categoryData = null;
      if (categoryScoresRes.ok) {
        categoryData = await categoryScoresRes.json();
      }

      // Maturity level hesapla - 1-5 puan kullan
      const overallScore = categoryData?.overallScore ?? 1;
      const overallPercentage = categoryData?.overallPercentage ?? scoreData?.totalScore ?? 0;
      const maturity = getMaturityLevelFromPercentage(overallPercentage);

      // Seçilen anket adı
      const surveyName = surveys.find(s => s.id === selectedSurveyId)?.name ?? 'Değerlendirme';

      // HTML içeriği oluştur
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1f2937; }
            .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #1e3a8a; }
            .header h1 { color: #1e3a8a; font-size: 28px; margin-bottom: 8px; }
            .header p { color: #6b7280; font-size: 14px; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
            .summary-card { background: #f8fafc; border-radius: 12px; padding: 20px; text-align: center; }
            .summary-card .label { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
            .summary-card .value { font-size: 28px; font-weight: bold; color: #1e3a8a; }
            .maturity-section { background: linear-gradient(135deg, #1e3a8a 0%, #3b5998 100%); border-radius: 16px; padding: 30px; margin-bottom: 40px; color: white; text-align: center; }
            .maturity-section h2 { font-size: 18px; margin-bottom: 16px; opacity: 0.9; }
            .maturity-badge { display: inline-block; background: ${maturity.color}; color: white; padding: 12px 32px; border-radius: 30px; font-size: 24px; font-weight: bold; }
            .maturity-score { font-size: 48px; font-weight: bold; margin: 20px 0; }
            .section { margin-bottom: 30px; }
            .section h3 { font-size: 18px; color: #1e3a8a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
            .category-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; }
            .category-name { font-weight: 500; }
            .category-score { font-weight: bold; color: #1e3a8a; }
            .progress-bar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; margin: 0 16px; }
            .progress-fill { height: 100%; border-radius: 4px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
            .gap-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            .gap-table th, .gap-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .gap-table th { background: #f8fafc; font-weight: 600; color: #374151; }
            .level-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Dönüşüm Platformu - ${surveyName}</h1>
            <p>Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Tamamlanan Sorular</div>
              <div class="value">${completedQuestions}/${totalQuestions}</div>
            </div>
            <div class="summary-card">
              <div class="label">Tamamlanma Oranı</div>
              <div class="value">${completionPercentage}%</div>
            </div>
            <div class="summary-card">
              <div class="label">Değerlendirilen Kategoriler</div>
              <div class="value">${Object.keys(scoreData?.categoryScores ?? {}).length}</div>
            </div>
          </div>

          <div class="maturity-section">
            <h2>Genel Olgunluk Seviyesi</h2>
            <div class="maturity-score">${overallScore.toFixed(2)} / 5</div>
            <div class="maturity-badge">${maturity.label}</div>
          </div>

          <div class="section">
            <h3>Kategori Bazlı Puanlar</h3>
            ${Object.entries(scoreData?.categoryScores ?? {}).map(([id, data], index) => `
              <div class="category-item">
                <span class="category-name">${data?.name ?? 'Kategori'}</span>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${data?.percentage ?? 0}%; background: ${categoryColors[index % categoryColors.length]};"></div>
                </div>
                <span class="category-score">${data?.percentage ?? 0}%</span>
              </div>
            `).join('')}
          </div>

          ${categoryData?.categories ? `
          <div class="section">
            <h3>GAP Analizi - Alt Kategori Detayları</h3>
            <table class="gap-table">
              <thead>
                <tr>
                  <th>Kategori / Alt Kategori</th>
                  <th>Mevcut Puan</th>
                  <th>Hedef</th>
                  <th>Seviye</th>
                </tr>
              </thead>
              <tbody>
                ${(categoryData.categories ?? []).map((cat: any) => `
                  <tr style="background: #f0f9ff;">
                    <td><strong>${cat.name}</strong></td>
                    <td><strong>${cat.score?.toFixed(2) ?? '-'}</strong></td>
                    <td>5.00</td>
                    <td>
                      <span class="level-badge" style="background: ${getMaturityLevelFromScore(cat.score ?? 1).color}20; color: ${getMaturityLevelFromScore(cat.score ?? 1).color};">
                        ${getMaturityLevelFromScore(cat.score ?? 1).label}
                      </span>
                    </td>
                  </tr>
                  ${(cat.subCategories ?? []).map((sub: any) => `
                    <tr>
                      <td style="padding-left: 24px;">└ ${sub.name}</td>
                      <td>${sub.score?.toFixed(2) ?? '-'}</td>
                      <td>5.00</td>
                      <td>
                        <span class="level-badge" style="background: ${getMaturityLevelFromScore(sub.score ?? 1).color}20; color: ${getMaturityLevelFromScore(sub.score ?? 1).color};">
                          ${getMaturityLevelFromScore(sub.score ?? 1).label}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>Bu rapor Dönüşüm Platformu tarafından otomatik olarak oluşturulmuştur.</p>
          </div>
        </body>
        </html>
      `;

      // PDF oluştur
      const pdfRes = await fetch('/api/html2pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent })
      });

      if (pdfRes.ok) {
        const blob = await pdfRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `donusum-raporu-${surveyName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('PDF oluşturma hatası');
        alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      alert('PDF oluşturulurken bir hata oluştu.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8" ref={dashboardRef}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Dönüşüm Panosu</h1>
            <p className="text-[var(--text-secondary)]">Kuruluşunuzun olgunluk değerlendirmesi ilerlemesini ve içgörülerini takip edin</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Anket Seçimi */}
            {surveys.length > 1 && (
              <div className="relative">
                <select
                  value={selectedSurveyId}
                  onChange={(e) => setSelectedSurveyId(e.target.value)}
                  className="px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                >
                  {surveys.map(survey => (
                    <option key={survey.id} value={survey.id}>
                      {survey.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* PDF İndir Butonu */}
            <button
              onClick={generatePdfReport}
              disabled={generatingPdf}
              className="flex items-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white dark:text-[var(--bg-main)] px-5 py-2.5 rounded-xl hover:shadow-lg dark:shadow-[0_4px_20px_rgba(34,211,238,0.3)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {generatingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white dark:border-[var(--bg-main)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Oluşturuluyor...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="text-sm">PDF Rapor</span>
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Seçili Anket Bilgisi */}
        {surveys.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-2"
          >
            <FileText size={18} className="text-[var(--primary)]" />
            <span className="text-sm text-[var(--primary)] font-medium">
              Görüntülenen Anket: {surveys.find(s => s.id === selectedSurveyId)?.name ?? 'Seçilmedi'}
            </span>
          </motion.div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-xl flex items-center justify-center">
                <ClipboardList className="text-[var(--primary)]" size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Anket İlerlemesi</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{completionPercentage}%</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar value={completionPercentage} label="" color="var(--primary)" />
              <p className="text-xs text-[var(--text-muted)] mt-2">{totalQuestions} sorudan {completedQuestions} tanesi tamamlandı</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--secondary)]/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-[var(--secondary)]" size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Mevcut Puan</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{scoreData?.totalScore ?? 0}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center">
                <CheckCircle className="text-[var(--accent)]" size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Değerlendirilen Kategoriler</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {Object.keys(scoreData?.categoryScores ?? {})?.length ?? 0}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Genel Olgunluk Puanı + Seviyelendirme */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-8 border border-[var(--border-light)]"
          >
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 h-full">
              {/* Score Card */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Genel Olgunluk Puanı</h3>
                <ScoreCard 
                  score={scoreData?.totalScore ?? 0} 
                  label={getMaturityLevelFromPercentage(scoreData?.totalScore ?? 0).label} 
                  color={getMaturityLevelFromPercentage(scoreData?.totalScore ?? 0).color} 
                  size="large" 
                />
              </div>
              
              {/* Divider */}
              <div className="hidden md:block w-px h-64 bg-[var(--border-light)]" />
              <div className="md:hidden w-48 h-px bg-[var(--border-light)]" />
              
              {/* Maturity Level Bar */}
              <MaturityLevelBar 
                score={scoreData?.totalScore ?? 0} 
                isPercentage={true} 
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-1 bg-[var(--bg-card)] rounded-2xl shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] p-6 border border-[var(--border-light)]"
          >
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-[var(--secondary)]" size={20} />
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Kategori Puanları</h3>
            </div>
            
            <div className="space-y-4">
              {Object.entries(scoreData?.categoryScores ?? {})?.map(([id, data], index) => (
                <ProgressBar
                  key={id}
                  value={data?.percentage ?? 0}
                  label={data?.name ?? 'Bilinmeyen Kategori'}
                  color={categoryColors[index % categoryColors.length]}
                />
              ))}
              
              {Object.keys(scoreData?.categoryScores ?? {})?.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <p>Puan dağılımınızı görmek için anketi tamamlayın</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Benchmark Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <BenchmarkSection />
        </motion.div>

        {/* Progress Benchmark Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.61 }}
          className="mb-8"
        >
          <ProgressSection surveyId={selectedSurveyId} />
        </motion.div>

        {/* Ironman Analysis Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62 }}
          className="mb-8"
        >
          <IronmanChart />
        </motion.div>

        {/* Category Analysis Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[var(--secondary)]/10 rounded-xl flex items-center justify-center">
              <PieChart className="text-[var(--secondary)]" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Kategori Analizi</h2>
              <p className="text-sm text-[var(--text-secondary)]">Seviyelendirme ve GAP Analizi</p>
            </div>
          </div>
          <CategoryDashboard surveyId={selectedSurveyId} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <button
            onClick={() => router.push("/survey")}
            className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white dark:text-[var(--bg-main)] rounded-2xl p-6 text-left hover:shadow-xl dark:shadow-[0_8px_30px_rgba(34,211,238,0.3)] transition-all duration-200 hover:-translate-y-1"
          >
            <ClipboardList size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ankete Devam Et</h3>
            <p className="text-sm opacity-80 mb-4">Olgunluk değerlendirmenizi tamamlayın</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              Başla <ArrowRight size={16} />
            </span>
          </button>

          <button
            onClick={() => router.push("/recommendations")}
            className="bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary-dark)] text-white dark:text-[var(--bg-main)] rounded-2xl p-6 text-left hover:shadow-xl dark:shadow-[0_8px_30px_rgba(129,140,248,0.3)] transition-all duration-200 hover:-translate-y-1"
          >
            <Lightbulb size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Önerileri Görüntüle</h3>
            <p className="text-sm opacity-80 mb-4">Geliştirme fırsatlarını keşfedin</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              İncele <ArrowRight size={16} />
            </span>
          </button>

          <button
            onClick={() => router.push("/roadmap")}
            className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white dark:text-[var(--bg-main)] rounded-2xl p-6 text-left hover:shadow-xl dark:shadow-[0_8px_30px_rgba(52,211,153,0.3)] transition-all duration-200 hover:-translate-y-1"
          >
            <Map size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Yol Haritası Oluştur</h3>
            <p className="text-sm opacity-80 mb-4">Dönüşüm yolculuğunuzu planlayın</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              Planla <ArrowRight size={16} />
            </span>
          </button>
        </motion.div>
      </main>
    </div>
  );
}
