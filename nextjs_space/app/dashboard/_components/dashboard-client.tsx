"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/ui/header";
import ScoreCard from "@/components/ui/score-card";
import ProgressBar from "@/components/ui/progress-bar";
import { MaturityLevelBar } from "@/components/ui/maturity-level-bar";
import SectionErrorBoundary from "@/components/section-error-boundary";
import { ProgressSection } from "./progress-section";

import { CategoryProgressChart } from "./category-progress-chart";

// Error fallback component for chunk loading failures
const ChunkErrorFallback = ({ componentName }: { componentName: string }) => (
  <div className="p-6 bg-[var(--bg-card)] rounded-xl border border-[var(--border-soft)] text-center">
    <p className="text-[var(--text-muted)]">{componentName} yüklenemedi.</p>
    <Button
      onClick={() => window.location.reload()} 
      className="mt-2 text-[var(--bg-deep)] text-sm"
    >
      Sayfayı Yenile
    </Button>
  </div>
);

// Dynamic imports with Next.js - more reliable than React.lazy
const BenchmarkSection = dynamic(
  () => import("./benchmark-section").then(mod => mod.BenchmarkSection),
  { 
    loading: () => <div className="animate-pulse bg-[var(--bg-card-2)] rounded-xl h-[400px]" />,
    ssr: false
  }
);

const CategoryDashboard = dynamic(
  () => import("./category-dashboard").then(mod => mod.CategoryDashboard),
  { 
    loading: () => <div className="animate-pulse bg-[var(--bg-card-2)] rounded-xl h-[600px]" />,
    ssr: false
  }
);

const IronmanChart = dynamic(
  () => import("@/components/ui/ironman-chart").then(mod => mod.IronmanChart),
  { 
    loading: () => <div className="animate-pulse bg-[var(--bg-card-2)] rounded-xl h-[500px]" />,
    ssr: false
  }
);

const KPIDashboard = dynamic(
  () => import("./kpi-dashboard").then(mod => mod.KPIDashboard),
  { 
    loading: () => <div className="animate-pulse bg-[var(--bg-card-2)] rounded-xl h-[300px]" />,
    ssr: false
  }
);
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
import { Button } from "@/components/ui/button";

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

// Theme colors - Cyan/Teal tones (matching template)
// Kategori çubukları olgunluk skalasının renklerini paylaşır; temaya göre
// değişmesi için sabit değer değil token kullanılır.
const categoryColors = [
  "var(--level-5)",
  "var(--level-3)",
  "var(--level-4)",
  "var(--level-2)",
  "var(--level-1)"
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
  if (percentage >= 80) return { label: 'Lider', color: 'var(--accent-cyan)' };
  if (percentage >= 60) return { label: 'Olgun', color: '#2dd4bf' };
  if (percentage >= 40) return { label: 'Gelişen', color: '#38bdf8' };
  if (percentage >= 20) return { label: 'Farkındalık', color: '#5eead4' };
  return { label: 'Başlangıç', color: '#67e8f9' };
};

/**
 * 1-5 puana göre olgunluk seviyesi hesaplama
 * Puan -> Yüzde dönüşümü: (puan - 1) / 4 * 100
 */
const getMaturityLevelFromScore = (score: number) => {
  const percentage = ((score - 1) / 4) * 100;
  return getMaturityLevelFromPercentage(percentage);
};

interface CategoryStats {
  id: string;
  name: string;
  answeredQuestions: number;
  totalQuestions: number;
  recommendationCount: number;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  sector: { id: string; name: string; naicsCode: string } | null;
  subSector: { id: string; name: string } | null;
}

export default function DashboardClient() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  /**
   * Puan taslak mı kesin mi? Gönderilmemiş bir puana bakıp karar vermek
   * yanıltıcı olur: ertesi gün değişebilir.
   */
  const [assessmentStatus, setAssessmentStatus] = useState<{
    submitted: boolean;
    submittedAt: string | null;
  }>({ submitted: false, submittedAt: null });
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [errorState, setErrorState] = useState<{ type: string; message: string } | null>(null);
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const lastLoadedSurveyIdRef = useRef<string | null>(null);
  
  // OPTIMIZED: Tek seferde surveys + ilk survey datasını çek
  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true);
      try {
        // 1. Önce surveys'i çek
        const surveyRes = await fetch("/api/survey/assigned");
        if (!surveyRes.ok) {
          setLoading(false);
          return;
        }

        const surveyData = await surveyRes.json();
        const activeSurveys = (surveyData ?? []).filter((s: Survey) => s.isActive);
        setSurveys(activeSurveys);

        if (activeSurveys.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Kullanıcının yanıtı olan anketi bul, yoksa ilk anketi seç
        // Her anket için yanıt sayısını kontrol et
        let selectedId = activeSurveys[0].id;
        
        // Paralel olarak tüm anketlerin yanıt sayısını kontrol et
        const responseCounts = await Promise.all(
          activeSurveys.map(async (survey: Survey) => {
            try {
              const res = await fetch(`/api/survey/responses?surveyId=${survey.id}&countOnly=true`);
              if (res.ok) {
                const data = await res.json();
                return { surveyId: survey.id, count: data.count || 0 };
              }
            } catch {}
            return { surveyId: survey.id, count: 0 };
          })
        );
        
        // Yanıtı olan ilk anketi seç
        const surveyWithResponses = responseCounts.find(r => r.count > 0);
        if (surveyWithResponses) {
          selectedId = surveyWithResponses.surveyId;
        }
        
        const firstSurveyId = selectedId;
        setSelectedSurveyId(firstSurveyId);
        lastLoadedSurveyIdRef.current = firstSurveyId;

        const [dashboardRes, categoryScoresRes] = await Promise.all([
          fetch(`/api/dashboard/unified?surveyId=${firstSurveyId}`),
          fetch(`/api/survey/category-scores?surveyId=${firstSurveyId}`)
        ]);
        
        if (dashboardRes.status === 401) {
          // Session expired, redirect to login
          window.location.href = '/login';
          return;
        }
        
        // Kategori skorlarını işle
        let categoryScoresMap: Record<string, CategoryScore> = {};
        if (categoryScoresRes.ok) {
          const catData = await categoryScoresRes.json();
          if (catData.categories) {
            catData.categories.forEach((cat: any) => {
              categoryScoresMap[cat.id] = {
                name: cat.name,
                score: cat.score,
                percentage: cat.percentage
              };
            });
          }
        }
        
        if (dashboardRes.ok) {
          const data = await dashboardRes.json();
          
          // Tüm state'leri tek seferde set et
          setUserProfile(data.userProfile);
          setScoreData({ totalScore: data.score.totalScore, categoryScores: categoryScoresMap });
          setResponses(data.responses);
          setTotalQuestions(data.score.totalQuestions);
          setCategoryStats(data.categoryStats);
          setAssessmentStatus({
            submitted: Boolean(data.assessment?.locked),
            submittedAt: data.assessment?.submittedAt ?? null,
          });
        }
      } catch (error) {
        console.error("Error initializing dashboard:", error);
        setErrorState({
          type: 'LOAD_ERROR',
          message: 'Dashboard yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.'
        });
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  // Survey değiştiğinde sadece dashboard datasını güncelle
  useEffect(() => {
    if (!selectedSurveyId || surveys.length === 0) return;
    if (lastLoadedSurveyIdRef.current === selectedSurveyId) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [dashboardRes, categoryScoresRes] = await Promise.all([
          fetch(`/api/dashboard/unified?surveyId=${selectedSurveyId}`),
          fetch(`/api/survey/category-scores?surveyId=${selectedSurveyId}`)
        ]);
        
        if (dashboardRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        
        // Kategori skorlarını işle
        let categoryScoresMap: Record<string, CategoryScore> = {};
        if (categoryScoresRes.ok) {
          const catData = await categoryScoresRes.json();
          if (catData.categories) {
            catData.categories.forEach((cat: any) => {
              categoryScoresMap[cat.id] = {
                name: cat.name,
                score: cat.score,
                percentage: cat.percentage
              };
            });
          }
        }
        
        if (dashboardRes.ok) {
          const data = await dashboardRes.json();
          
          setScoreData({ totalScore: data.score.totalScore, categoryScores: categoryScoresMap });
          setResponses(data.responses);
          setTotalQuestions(data.score.totalQuestions);
          setCategoryStats(data.categoryStats);
          setAssessmentStatus({
            submitted: Boolean(data.assessment?.locked),
            submittedAt: data.assessment?.submittedAt ?? null,
          });
          lastLoadedSurveyIdRef.current = selectedSurveyId;
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedSurveyId, surveys.length]);

  const completedQuestions = responses?.length ?? 0;
  const completionPercentage = totalQuestions > 0 
    ? Math.round((completedQuestions / totalQuestions) * 100) 
    : 0;

  // PDF Oluşturma Fonksiyonu - Dark Theme Design
  const generatePdfReport = async () => {
    setGeneratingPdf(true);
    try {
      // Kategori skorlarını al
      const categoryScoresRes = await fetch(`/api/survey/category-scores?surveyId=${selectedSurveyId}`);
      let categoryData = null;
      if (categoryScoresRes.ok) {
        categoryData = await categoryScoresRes.json();
      }

      // Ironman verilerini al
      const ironmanRes = await fetch(`/api/ironman/user?surveyId=${selectedSurveyId}`);
      let ironmanData = null;
      if (ironmanRes.ok) {
        ironmanData = await ironmanRes.json();
      }

      // Önerileri al
      const recommendationsRes = await fetch(`/api/recommendations?surveyId=${selectedSurveyId}`);
      let recommendations: any[] = [];
      if (recommendationsRes.ok) {
        const recData = await recommendationsRes.json();
        recommendations = recData ?? [];
      }

      // Maturity level hesapla - 1-5 puan kullan
      const overallScore = categoryData?.overallScore ?? 1;
      const overallPercentage = categoryData?.overallPercentage ?? scoreData?.totalScore ?? 0;
      const maturity = getMaturityLevelFromPercentage(overallPercentage);

      // Seçilen anket adı
      const surveyName = surveys.find(s => s.id === selectedSurveyId)?.name ?? 'Değerlendirme';

      // Kullanıcı bilgileri
      const userName = [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || 'Kullanıcı';
      const companyName = userProfile?.organization || 'Şirket Adı Belirtilmemiş';
      const sectorName = userProfile?.sector?.name || 'Sektör Belirtilmemiş';
      const subSectorName = userProfile?.subSector?.name || '';
      const reportDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

      // Kategori sayısı ve öneri istatistikleri
      const categoryCount = Object.keys(scoreData?.categoryScores ?? {}).length;
      const quickWinCount = recommendations.filter((r: any) => r.strategicType === 'QUICK_WIN').length;
      const projectCount = recommendations.filter((r: any) => r.strategicType === 'PROJECT').length;
      const bigBetCount = recommendations.filter((r: any) => r.strategicType === 'BIG_BET').length;

      // En düşük ve en yüksek kategoriler
      const categoryEntries = Object.entries(scoreData?.categoryScores ?? {});
      const sortedCategories = categoryEntries.sort((a: any, b: any) => (a[1]?.percentage ?? 0) - (b[1]?.percentage ?? 0));
      const lowestCategories = sortedCategories.slice(0, 3);
      const highestCategories = sortedCategories.slice(-3).reverse();

      // HTML içeriği - Modern Corporate Report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            @page {
              size: A4;
              margin: 15mm 20mm;
            }
            
            @page :first {
              margin: 0;
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
              background: #ffffff;
              color: #334155;
              line-height: 1.6;
              font-size: 10pt;
              -webkit-font-smoothing: antialiased;
            }
            
            h1, h2, h3 {
              font-family: 'Inter', sans-serif;
              color: #0f172a;
              font-weight: 700;
              letter-spacing: -0.02em;
            }
            
            /* ========== KAPAK SAYFASI - MODERN MINIMAL ========== */
            .cover-page {
              height: 297mm;
              background: #ffffff;
              position: relative;
              page-break-after: always;
              padding: 0;
            }
            
            .cover-header {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 60mm;
              background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
            }
            
            .cover-content {
              position: absolute;
              top: 60mm;
              left: 0;
              right: 0;
              bottom: 0;
              padding: 40mm 30mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            
            .cover-logo {
              width: 60px;
              height: 60px;
              background: #0ea5e9;
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              font-weight: 800;
              color: white;
              margin-bottom: 24px;
            }
            
            .cover-title {
              font-size: 42pt;
              font-weight: 800;
              margin-bottom: 12px;
              line-height: 1.1;
              color: #0f172a;
            }
            
            .cover-subtitle {
              font-size: 14pt;
              color: #64748b;
              margin-bottom: 40px;
              font-weight: 500;
            }
            
            .cover-company {
              font-size: 28pt;
              font-weight: 700;
              color: #0ea5e9;
              margin-bottom: 48px;
            }
            
            .cover-meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 40px;
            }
            
            .cover-meta-item {
              background: #f8fafc;
              padding: 16px 20px;
              border-radius: 8px;
              border-left: 3px solid #0ea5e9;
            }
            
            .cover-meta-label {
              font-size: 8pt;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
              font-weight: 600;
            }
            
            .cover-meta-value {
              font-size: 11pt;
              color: #0f172a;
              font-weight: 600;
            }
            
            .cover-badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #0f172a;
              color: white;
              padding: 14px 28px;
              border-radius: 8px;
              font-size: 12pt;
              font-weight: 700;
              margin-top: auto;
            }
            
            .cover-badge-dot {
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: #22d3ee;
            }
            
            /* ========== İÇERİK SAYFALARI - CLEAN LAYOUT ========== */
            .content-page {
              padding: 0;
              page-break-after: always;
            }
            
            .page-header {
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 16px;
              margin-bottom: 32px;
              display: flex;
              justify-content: space-between;
              align-items: baseline;
            }
            
            .page-header-title {
              font-size: 8pt;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 1.5px;
              font-weight: 600;
            }
            
            .page-header-company {
              font-size: 9pt;
              color: #0f172a;
              font-weight: 600;
            }
            
            .section-title {
              font-size: 22pt;
              color: #0f172a;
              margin-bottom: 8px;
              font-weight: 800;
            }
            
            .section-subtitle {
              font-size: 11pt;
              color: #64748b;
              margin-bottom: 28px;
              font-weight: 400;
            }
            
            .section-intro {
              font-size: 10pt;
              color: #64748b;
              margin-bottom: 24px;
              line-height: 1.7;
            }
            
            /* Özet Kutusu - Modern Highlight */
            .summary-box {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-left: 4px solid #0ea5e9;
              padding: 24px 28px;
              margin-bottom: 32px;
              border-radius: 8px;
            }
            
            .summary-box h3 {
              font-size: 11pt;
              color: #0f172a;
              margin-bottom: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .summary-box p {
              font-size: 10pt;
              color: #475569;
              line-height: 1.8;
            }
            
            /* KPI Grid - Minimal Cards */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin-bottom: 32px;
            }
            
            .kpi-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 24px 20px;
              text-align: center;
              transition: all 0.2s;
            }
            
            .kpi-value {
              font-size: 32pt;
              font-weight: 800;
              color: #0f172a;
              line-height: 1;
            }
            
            .kpi-value.highlight {
              color: #0ea5e9;
            }
            
            .kpi-label {
              font-size: 8pt;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-top: 8px;
              font-weight: 600;
            }
            
            /* Tablo Stili - Clean & Modern */
            .data-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-bottom: 32px;
              font-size: 9pt;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              overflow: hidden;
            }
            
            .data-table th {
              background: #f8fafc;
              color: #64748b;
              padding: 14px 18px;
              text-align: left;
              font-weight: 700;
              font-size: 8pt;
              text-transform: uppercase;
              letter-spacing: 1px;
              border-bottom: 2px solid #e2e8f0;
            }
            
            .data-table td {
              padding: 14px 18px;
              border-bottom: 1px solid #f1f5f9;
              color: #334155;
            }
            
            .data-table tbody tr:last-child td {
              border-bottom: none;
            }
            
            .data-table tr:hover {
              background: #fafbfc;
            }
            
            /* Seviye Badge - Refined */
            .level-badge {
              display: inline-block;
              padding: 5px 14px;
              border-radius: 6px;
              font-size: 8pt;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            
            .level-badge.baslangic { background: #fee2e2; color: #991b1b; }
            .level-badge.farkindalik { background: #fed7aa; color: #9a3412; }
            .level-badge.gelisen { background: #fef08a; color: #854d0e; }
            .level-badge.olgun { background: #bbf7d0; color: #166534; }
            .level-badge.lider { background: #bfdbfe; color: #1e40af; }
            
            /* Progress Bar - Minimal */
            .progress-bar {
              height: 6px;
              background: #f1f5f9;
              border-radius: 3px;
              overflow: hidden;
            }
            
            .progress-fill {
              height: 100%;
              border-radius: 3px;
              transition: width 0.3s;
            }
            
            .progress-fill.low { background: #ef4444; }
            .progress-fill.medium { background: #f59e0b; }
            .progress-fill.high { background: #10b981; }
            
            /* Öneri Kartları - Card Design */
            .recommendation-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 14px;
              margin-bottom: 28px;
            }
            
            .rec-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 18px 22px;
              border-left: 3px solid;
            }
            
            .rec-card.quick-win { border-left-color: #10b981; }
            .rec-card.project { border-left-color: #f59e0b; }
            .rec-card.big-bet { border-left-color: #ef4444; }
            
            .rec-header {
              display: flex;
              align-items: center;
              gap: 14px;
              margin-bottom: 10px;
            }
            
            .rec-type {
              font-size: 7pt;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              padding: 4px 12px;
              border-radius: 5px;
              white-space: nowrap;
            }
            
            .rec-type.quick-win { background: #d1fae5; color: #065f46; }
            .rec-type.project { background: #fef3c7; color: #78350f; }
            .rec-type.big-bet { background: #fee2e2; color: #7f1d1d; }
            
            .rec-title {
              font-size: 11pt;
              font-weight: 700;
              color: #0f172a;
            }
            
            .rec-desc {
              font-size: 9pt;
              color: #64748b;
              line-height: 1.6;
            }
            
            .rec-meta {
              display: flex;
              gap: 18px;
              margin-top: 12px;
              font-size: 8pt;
              color: #94a3b8;
            }
            
            /* İki Sütun Layout - Card Style */
            .two-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-bottom: 28px;
            }
            
            .column-box {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 22px 24px;
            }
            
            .column-box h4 {
              font-size: 10pt;
              color: #0f172a;
              margin-bottom: 18px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .column-list {
              list-style: none;
            }
            
            .column-list li {
              padding: 11px 0;
              border-bottom: 1px solid #f1f5f9;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 9pt;
              color: #475569;
            }
            
            .column-list li:last-child {
              border-bottom: none;
            }
            
            /* Ironman Bölümü - Minimal Dark */
            .ironman-section {
              background: #0f172a;
              border-radius: 8px;
              padding: 28px 32px;
              color: white;
              margin-bottom: 28px;
            }
            
            .ironman-section h4 {
              font-size: 11pt;
              color: #22d3ee;
              margin-bottom: 20px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .ironman-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
            }
            
            .ironman-stat {
              background: rgba(255,255,255,0.03);
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 8px;
              padding: 18px;
            }
            
            .ironman-value {
              font-size: 28pt;
              font-weight: 800;
            }
            
            .ironman-value.velocity { color: #fbbf24; }
            .ironman-value.endurance { color: #60a5fa; }
            .ironman-value.quadrant { color: #22d3ee; font-size: 13pt; }
            
            .ironman-label {
              font-size: 8pt;
              color: #94a3b8;
              margin-top: 8px;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 600;
            }
            
            /* Sayfa Numarası Footer */
            .page-footer {
              position: fixed;
              bottom: 15mm;
              left: 20mm;
              right: 20mm;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              color: #94a3b8;
            }
            
            /* Utility Classes */
            .no-break {
              page-break-inside: avoid;
            }
            
            /* Print ayarları */
            @media print {
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <!-- ========== KAPAK SAYFASI - MODERN ========== -->
          <div class="cover-page">
            <div class="cover-header"></div>
            <div class="cover-content">
              <div>
                <div class="cover-logo">${companyName.charAt(0).toUpperCase()}</div>
                <div class="cover-title">Dönüşüm Olgunluk<br/>Raporu</div>
                <div class="cover-subtitle">${surveyName}</div>
                <div class="cover-company">${companyName}</div>
              </div>
              
              <div>
                <div class="cover-meta-grid">
                  <div class="cover-meta-item">
                    <div class="cover-meta-label">Sektör</div>
                    <div class="cover-meta-value">${sectorName}</div>
                  </div>
                  <div class="cover-meta-item">
                    <div class="cover-meta-label">Rapor Tarihi</div>
                    <div class="cover-meta-value">${reportDate}</div>
                  </div>
                  ${subSectorName ? `
                  <div class="cover-meta-item">
                    <div class="cover-meta-label">Alt Sektör</div>
                    <div class="cover-meta-value">${subSectorName}</div>
                  </div>
                  ` : ''}
                  <div class="cover-meta-item">
                    <div class="cover-meta-label">Değerlendiren</div>
                    <div class="cover-meta-value">${userName}</div>
                  </div>
                </div>
                
                <div class="cover-badge">
                  <span class="cover-badge-dot"></span>
                  ${maturity.label} Seviyesi
                </div>
              </div>
            </div>
          </div>

          <!-- ========== YÖNETİCİ ÖZETİ - MODERN ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Yönetici Özeti</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Yönetici Özeti</h2>
            <p class="section-subtitle">Değerlendirme Sonuçlarının Özet Sunumu</p>
            
            <div class="summary-box">
              <h3>Genel Değerlendirme</h3>
              <p>
                ${companyName}, ${surveyName} kapsamında ${categoryCount} ana kategori üzerinden değerlendirilmiştir. 
                Değerlendirme sonucunda <strong>"${maturity.label}"</strong> olgunluk seviyesinde konumlanmıştır 
                (%${overallPercentage.toFixed(0)} tamamlanma). Toplam ${recommendations.length} öneri tespit edilmiştir: 
                ${quickWinCount} hızlı kazanım, ${projectCount} proje, ${bigBetCount} stratejik yatırım.
              </p>
            </div>
            
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-value highlight">${overallScore.toFixed(1)}</div>
                <div class="kpi-label">Genel Puan (1-5)</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${completedQuestions}</div>
                <div class="kpi-label">Cevaplanan Soru</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${completionPercentage}%</div>
                <div class="kpi-label">Tamamlanma</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${recommendations.length}</div>
                <div class="kpi-label">Öneri Sayısı</div>
              </div>
            </div>
            
            <div class="two-column">
              <div class="column-box">
                <h4>⚠ Gelişim Gerektiren Alanlar</h4>
                <ul class="column-list">
                  ${lowestCategories.length > 0 ? lowestCategories.map(([id, data]: any) => `
                    <li>
                      <span style="font-weight: 600;">${data?.name ?? 'Kategori'}</span>
                      <span style="color: #ef4444; font-weight: 700;">${data?.percentage?.toFixed(0) ?? 0}%</span>
                    </li>
                  `).join('') : '<li><span>Veri yok</span></li>'}
                </ul>
              </div>
              <div class="column-box">
                <h4>✓ Güçlü Alanlar</h4>
                <ul class="column-list">
                  ${highestCategories.length > 0 ? highestCategories.map(([id, data]: any) => `
                    <li>
                      <span style="font-weight: 600;">${data?.name ?? 'Kategori'}</span>
                      <span style="color: #10b981; font-weight: 700;">${data?.percentage?.toFixed(0) ?? 0}%</span>
                    </li>
                  `).join('') : '<li><span>Veri yok</span></li>'}
                </ul>
              </div>
            </div>
            
            ${ironmanData ? `
            <div class="ironman-section no-break">
              <h4>Dönüşüm Dinamiği Analizi (Ironman)</h4>
              <div class="ironman-grid">
                <div class="ironman-stat">
                  <div class="ironman-value velocity">${(ironmanData.velocity ?? 0).toFixed(2)}</div>
                  <div class="ironman-label">Hız (Velocity)</div>
                </div>
                <div class="ironman-stat">
                  <div class="ironman-value endurance">${(ironmanData.endurance ?? 0).toFixed(2)}</div>
                  <div class="ironman-label">Dayanıklılık (Endurance)</div>
                </div>
                <div class="ironman-stat">
                  <div class="ironman-value quadrant">${ironmanData.quadrant ?? 'Belirsiz'}</div>
                  <div class="ironman-label">Kadran</div>
                </div>
              </div>
            </div>
            ` : ''}
          </div>

          <!-- ========== KATEGORİ ANALİZİ - MODERN ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Kategori Analizi</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Kategori Performansı</h2>
            <p class="section-subtitle">Detaylı Kategori ve Alt Kategori Analizleri</p>
            
            <p class="section-intro">
              Aşağıdaki tablo değerlendirme kapsamındaki tüm kategorilerin performansını göstermektedir. 
              Her kategori için mevcut puan, ilerleme ve olgunluk seviyesi belirtilmiştir.
            </p>
            
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 35%;">Kategori</th>
                  <th style="width: 15%;">Puan</th>
                  <th style="width: 30%;">İlerleme</th>
                  <th style="width: 20%;">Seviye</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(scoreData?.categoryScores ?? {}).map(([id, data]: any) => {
                  const percentage = data?.percentage ?? 0;
                  const level = getMaturityLevelFromPercentage(percentage);
                  const progressClass = percentage < 40 ? 'low' : percentage < 70 ? 'medium' : 'high';
                  const levelClass = level.label === 'Başlangıç' ? 'baslangic' : 
                                     level.label === 'Farkındalık' ? 'farkindalik' :
                                     level.label === 'Gelişen' ? 'gelisen' :
                                     level.label === 'Olgun' ? 'olgun' : 'lider';
                  return `
                    <tr class="no-break">
                      <td><strong>${data?.name ?? 'Kategori'}</strong></td>
                      <td>${percentage.toFixed(0)}%</td>
                      <td>
                        <div class="progress-bar">
                          <div class="progress-fill ${progressClass}" style="width: ${percentage}%;"></div>
                        </div>
                      </td>
                      <td><span class="level-badge ${levelClass}">${level.label}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
            
            ${categoryData?.categories ? `
            <h3 style="font-size: 14pt; margin: 28px 0 16px; color: #374151;">Alt Kategori Detayları</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kategori / Alt Kategori</th>
                  <th>Puan</th>
                  <th>Hedef</th>
                  <th>Fark</th>
                  <th>Seviye</th>
                </tr>
              </thead>
              <tbody>
                ${(categoryData.categories ?? []).map((cat: any) => {
                  const catLevel = getMaturityLevelFromScore(cat.score ?? 1);
                  const catLevelClass = catLevel.label === 'Başlangıç' ? 'baslangic' : 
                                        catLevel.label === 'Farkındalık' ? 'farkindalik' :
                                        catLevel.label === 'Gelişen' ? 'gelisen' :
                                        catLevel.label === 'Olgun' ? 'olgun' : 'lider';
                  return `
                    <tr class="no-break" style="background: #f1f5f9;">
                      <td><strong>${cat.name}</strong></td>
                      <td><strong>${cat.score?.toFixed(2) ?? '-'}</strong></td>
                      <td>5.00</td>
                      <td style="color: ${(5 - (cat.score ?? 0)) > 2 ? '#dc2626' : '#16a34a'};">${(5 - (cat.score ?? 0)).toFixed(2)}</td>
                      <td><span class="level-badge ${catLevelClass}">${catLevel.label}</span></td>
                    </tr>
                    ${(cat.subCategories ?? []).map((sub: any) => {
                      const subLevel = getMaturityLevelFromScore(sub.score ?? 1);
                      const subLevelClass = subLevel.label === 'Başlangıç' ? 'baslangic' : 
                                            subLevel.label === 'Farkındalık' ? 'farkindalik' :
                                            subLevel.label === 'Gelişen' ? 'gelisen' :
                                            subLevel.label === 'Olgun' ? 'olgun' : 'lider';
                      return `
                        <tr class="no-break">
                          <td style="padding-left: 28px; color: #6b7280;">└ ${sub.name}</td>
                          <td>${sub.score?.toFixed(2) ?? '-'}</td>
                          <td>5.00</td>
                          <td style="color: ${(5 - (sub.score ?? 0)) > 2 ? '#dc2626' : '#16a34a'};">${(5 - (sub.score ?? 0)).toFixed(2)}</td>
                          <td><span class="level-badge ${subLevelClass}">${subLevel.label}</span></td>
                        </tr>
                      `;
                    }).join('')}
                  `;
                }).join('')}
              </tbody>
            </table>
            ` : ''}
          </div>

          ${recommendations.length > 0 ? `
          <!-- ========== ÖNERİLER - MODERN ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Stratejik Öneriler</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Eylem Planı</h2>
            <p class="section-subtitle">Önceliklendirilmiş Stratejik Öneriler</p>
            
            <p class="section-intro">
              Değerlendirme sonucunda belirlenen öneriler stratejik öneme ve uygulama kolaylığına göre 
              sınıflandırılmıştır. Hızlı kazanımlar kısa vadede, büyük yatırımlar uzun vadede planlanmalıdır.
            </p>
            
            <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
              <div class="kpi-card" style="border-left: 4px solid #22c55e;">
                <div class="kpi-value" style="color: #22c55e;">${quickWinCount}</div>
                <div class="kpi-label">Hızlı Kazanım</div>
              </div>
              <div class="kpi-card" style="border-left: 4px solid #f59e0b;">
                <div class="kpi-value" style="color: #f59e0b;">${projectCount}</div>
                <div class="kpi-label">Proje</div>
              </div>
              <div class="kpi-card" style="border-left: 4px solid #ef4444;">
                <div class="kpi-value" style="color: #ef4444;">${bigBetCount}</div>
                <div class="kpi-label">Büyük Yatırım</div>
              </div>
            </div>
            
            <div class="recommendation-grid">
              ${recommendations.slice(0, 8).map((rec: any) => {
                const typeClass = rec.strategicType === 'QUICK_WIN' ? 'quick-win' : 
                                  rec.strategicType === 'PROJECT' ? 'project' : 'big-bet';
                const typeName = rec.strategicType === 'QUICK_WIN' ? 'Hızlı Kazanım' : 
                                 rec.strategicType === 'PROJECT' ? 'Proje' : 'Büyük Yatırım';
                const timeframe = rec.timeframe === 'SHORT_TERM' ? 'Kısa Vade' : 
                                  rec.timeframe === 'MEDIUM_TERM' ? 'Orta Vade' : 'Uzun Vade';
                return `
                  <div class="rec-card ${typeClass} no-break">
                    <div class="rec-header">
                      <span class="rec-type ${typeClass}">${typeName}</span>
                      <span class="rec-title">${rec.title}</span>
                    </div>
                    <div class="rec-desc">${rec.description?.substring(0, 180) ?? ''}${(rec.description?.length ?? 0) > 180 ? '...' : ''}</div>
                    <div class="rec-meta">
                      <span>⏱️ ${timeframe}</span>
                      <span>💰 CAPEX: ${'$'.repeat(rec.capexLevel ?? 1)}</span>
                      <span>📊 OPEX: ${'$'.repeat(rec.opexLevel ?? 1)}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            
            ${recommendations.length > 8 ? `
            <p style="font-size: 10pt; color: #6b7280; text-align: center; margin-top: 16px;">
              ... ve ${recommendations.length - 8} öneri daha. Tüm öneriler için platformdaki Öneriler sayfasını ziyaret edin.
            </p>
            ` : ''}
          </div>
          ` : ''}

          <!-- ========== SONUÇ - MODERN ========== -->
          <div class="content-page" style="page-break-after: auto;">
            <div class="page-header">
              <span class="page-header-title">Sonuç ve Öneriler</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Sonuç</h2>
            <p class="section-subtitle">Değerlendirme Özeti ve Gelecek Adımlar</p>
            
            <div class="summary-box">
              <h3>Değerlendirme Özeti</h3>
              <p>
                ${companyName}, mevcut değerlendirme çerçevesinde <strong>"${maturity.label}"</strong> olgunluk 
                seviyesinde konumlanmaktadır. Belirlenen ${recommendations.length} öneri doğrultusunda 
                sistematik bir iyileştirme yaklaşımı benimsenmesi önerilmektedir.
              </p>
            </div>
            
            <div class="two-column">
              <div class="column-box">
                <h4>Öncelikli Eylemler</h4>
                <ul class="column-list">
                  <li>Hızlı kazanımları 0-3 ay içinde uygulayın</li>
                  <li>Proje önceliklerini netleştirin</li>
                  <li>Bütçe ve kaynak planlaması yapın</li>
                  <li>İlerlemeyi düzenli izleyin ve raporlayın</li>
                </ul>
              </div>
              <div class="column-box">
                <h4>Zaman Çizelgesi Önerisi</h4>
                <ul class="column-list">
                  <li><strong>0-6 ay:</strong> Hızlı kazanımlar ve temel projeler</li>
                  <li><strong>6-12 ay:</strong> Orta ölçekli projeler</li>
                  <li><strong>12-24 ay:</strong> Stratejik yatırımlar</li>
                </ul>
              </div>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; margin-top: 32px; text-align: center;">
              <p style="font-size: 9pt; color: #64748b; margin-bottom: 12px;">
                Bu rapor ${reportDate} tarihinde
              </p>
              <p style="font-size: 14pt; color: #0ea5e9; font-weight: 700; letter-spacing: -0.02em;">
                Dönüşüm Platformu
              </p>
              <p style="font-size: 9pt; color: #64748b; margin-top: 12px;">
                tarafından otomatik olarak oluşturulmuştur
              </p>
            </div>
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
        a.download = `${companyName.toLowerCase().replace(/\s+/g, '-')}-donusum-raporu-${new Date().toISOString().split('T')[0]}.pdf`;
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

  // Error durumunu göster
  if (errorState) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="bg-[var(--bg-card)] p-8 rounded-xl border border-[var(--error)] max-w-md text-center">
            <div className="w-16 h-16 bg-[var(--error)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-main)] mb-2">Bir Sorun Oluştu</h2>
            <p className="text-[var(--text-muted)] mb-6">{errorState.message}</p>
            <Button
              onClick={() => window.location.reload()}
              className="text-[var(--bg-deep)] font-medium"
            >
              Sayfayı Yenile
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

  // Anket bulunamadı durumu
  if (surveys.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="bg-[var(--bg-card)] p-8 rounded-xl border border-[var(--border-soft)] max-w-md text-center">
            <div className="w-16 h-16 bg-[var(--accent)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-main)] mb-2">Henüz Anket Atanmadı</h2>
            <p className="text-[var(--text-muted)] mb-6">Size henüz değerlendirme anketi atanmamış. Lütfen yöneticinizle iletişime geçin.</p>
          </div>
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
              className="flex items-center gap-2 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white  px-5 py-2.5 rounded-xl hover:shadow-lg  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {generatingPdf ? (
                <>
                  <div className="w-4 h-4 border-2 border-white  border-t-transparent rounded-full animate-spin" />
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

        {/* Olgunluk puanı ve kategori kırılımı — panonun cevabı bu.
            Sayı kartlarından ve grafiklerden önce gelir: kullanıcı sayfayı
            açtığında ilk sorusu "kaç aldık", ikincisi "hangi başlıkta
            zayıfız". Gerisi bu ikisinin açıklaması. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Genel Olgunluk Puanı + Seviyelendirme */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-2 bg-[var(--bg-card)] rounded-2xl shadow-lg  p-8 border border-[var(--border-light)]"
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
            transition={{ delay: 0.1 }}
            className="lg:col-span-1 bg-[var(--bg-card)] rounded-2xl shadow-lg  p-6 border border-[var(--border-light)]"
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

        {/* KPI Dashboard */}
        <Suspense fallback={<ComponentSkeleton height="300px" />}>
          <KPIDashboard surveyId={selectedSurveyId} />
        </Suspense>

        {/* Gelişim Trend Grafiği */}
        <CategoryProgressChart surveyId={selectedSurveyId} />

        {/* Overview Cards (Legacy) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg  p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
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
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg  p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--secondary)]/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="text-[var(--secondary)]" size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Mevcut Puan</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{Math.round(scoreData?.totalScore ?? 0)}%</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {assessmentStatus.submitted
                    ? `Kesin puan${
                        assessmentStatus.submittedAt
                          ? ` · ${new Date(assessmentStatus.submittedAt).toLocaleDateString("tr-TR")}`
                          : ""
                      }`
                    : "Taslak — değerlendirme gönderilmedi"}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[var(--bg-card)] rounded-2xl shadow-lg  p-6 border border-[var(--border-light)] hover:shadow-xl transition-all duration-300"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-[var(--accent)]/10 rounded-xl flex items-center justify-center">
                <CheckCircle className="text-[var(--accent)]" size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">Değerlendirilen Kategoriler</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {categoryStats.length}
                </p>
              </div>
            </div>
            
            {/* Kategori Detayları */}
            <div className="space-y-3 mt-4 pt-4 border-t border-[var(--border-light)]">
              {categoryStats.map((cat, index) => (
                <div key={cat.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                    />
                    <span className="text-[var(--text-primary)] font-medium truncate max-w-[100px]" title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--primary)]">{cat.answeredQuestions}</span>/{cat.totalQuestions}
                    </span>
                    <span className="text-[var(--text-muted)]">|</span>
                    <span className="flex items-center gap-1">
                      <Lightbulb size={12} className="text-[var(--warning)]" />
                      <span className="font-semibold text-[var(--warning)] ">{cat.recommendationCount}</span>
                    </span>
                  </div>
                </div>
              ))}
              
              {categoryStats.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-2">
                  Henüz kategori verisi yok
                </p>
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
          <SectionErrorBoundary label="Kıyaslama grafiği yüklenemedi.">
            <Suspense fallback={<ComponentSkeleton height="400px" />}>
              <BenchmarkSection />
            </Suspense>
          </SectionErrorBoundary>
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
          <SectionErrorBoundary label="Ironman analizi yüklenemedi.">
            <Suspense fallback={<ComponentSkeleton height="600px" />}>
              <IronmanChart />
            </Suspense>
          </SectionErrorBoundary>
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
          <Suspense fallback={<ComponentSkeleton height="500px" />}>
            <CategoryDashboard surveyId={selectedSurveyId} />
          </Suspense>
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
            className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white  rounded-2xl p-6 text-left hover:shadow-xl  transition-all duration-200 hover:-translate-y-1"
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
            className="bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary-dark)] text-white  rounded-2xl p-6 text-left hover:shadow-xl  transition-all duration-200 hover:-translate-y-1"
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
            className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)] text-white  rounded-2xl p-6 text-left hover:shadow-xl  transition-all duration-200 hover:-translate-y-1"
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

// Skeleton Loader Component
function ComponentSkeleton({ height = "400px" }: { height?: string }) {
  return (
    <div 
      className="bg-[var(--bg-card)] rounded-2xl shadow-lg border border-[var(--border-soft)] animate-pulse"
      style={{ height }}
    >
      <div className="p-6 space-y-4">
        <div className="h-6 bg-[var(--bg-card-2)] rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-[var(--bg-card-2)] rounded"></div>
          <div className="h-4 bg-[var(--bg-card-2)] rounded w-5/6"></div>
          <div className="h-4 bg-[var(--bg-card-2)] rounded w-4/6"></div>
        </div>
      </div>
    </div>
  );
}
