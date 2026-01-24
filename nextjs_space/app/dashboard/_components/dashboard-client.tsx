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

// Theme colors - Cyan/Teal tones (matching template)
const categoryColors = [
  "#22d3ee",
  "#38bdf8",
  "#2dd4bf",
  "#5eead4",
  "#67e8f9"
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
  if (percentage >= 80) return { label: 'Lider', color: '#22d3ee' };
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
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const router = useRouter();
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const data = await res.json();
          setUserProfile(data);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };
    fetchUserProfile();
  }, []);

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
        
        const [scoreRes, responsesRes, structureRes, recommendationsRes] = await Promise.all([
          fetch(`/api/survey/score${surveyParam}`),
          fetch(`/api/survey/responses${surveyParam}`),
          fetch(`/api/survey/structure${surveyParam}`),
          fetch(`/api/recommendations${surveyParam}`)
        ]);

        let userResponses: SurveyResponse[] = [];
        if (responsesRes.ok) {
          const resp = await responsesRes.json();
          userResponses = resp ?? [];
          setResponses(userResponses);
        }

        if (scoreRes.ok) {
          const score = await scoreRes.json();
          setScoreData(score);
        }

        // Öneri verilerini al
        let recommendations: any[] = [];
        if (recommendationsRes.ok) {
          const recData = await recommendationsRes.json();
          recommendations = recData ?? [];
        }

        if (structureRes.ok) {
          const structure = await structureRes.json();
          let count = 0;
          const stats: CategoryStats[] = [];
          
          // Kullanıcının cevapladığı question ID'leri
          const answeredQuestionIds = new Set(userResponses.map((r: SurveyResponse) => r.questionId));
          
          // Düzeltilmiş soru sayısı hesabı - hasSubLevels kontrolü
          (structure ?? []).forEach((cat: any) => {
            let catTotalQuestions = 0;
            let catAnsweredQuestions = 0;
            const catQuestionIds: string[] = [];
            
            (cat?.subCategories ?? []).forEach((sub: any) => {
              if (sub?.hasSubLevels === false) {
                // Sorular doğrudan alt kategoride
                const questions = sub?.questions ?? [];
                catTotalQuestions += questions.length;
                questions.forEach((q: any) => {
                  catQuestionIds.push(q.id);
                  if (answeredQuestionIds.has(q.id)) {
                    catAnsweredQuestions++;
                  }
                });
                count += questions.length;
              } else {
                // Sorular alt seviyelerde
                (sub?.subLevels ?? []).forEach((level: any) => {
                  const questions = level?.questions ?? [];
                  catTotalQuestions += questions.length;
                  questions.forEach((q: any) => {
                    catQuestionIds.push(q.id);
                    if (answeredQuestionIds.has(q.id)) {
                      catAnsweredQuestions++;
                    }
                  });
                  count += questions.length;
                });
              }
            });
            
            // Kategori için öneri sayısını hesapla
            const catRecommendationCount = recommendations.filter((rec: any) => 
              rec.categoryId === cat.id
            ).length;
            
            stats.push({
              id: cat.id,
              name: cat.name,
              answeredQuestions: catAnsweredQuestions,
              totalQuestions: catTotalQuestions,
              recommendationCount: catRecommendationCount
            });
          });
          
          setTotalQuestions(count);
          setCategoryStats(stats);
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

      // HTML içeriği - Dark Theme Design (Kompakt 2 Sayfa)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            @page {
              size: A4;
              margin: 15mm;
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
              background: #0f172a;
              color: #e2e8f0;
              padding: 0;
              line-height: 1.5;
              font-size: 12px;
            }
            
            .page {
              padding: 20px;
            }
            
            /* Header / Künye Section */
            .header-section {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              border: 1px solid #334155;
              border-radius: 12px;
              padding: 16px 20px;
              margin-bottom: 16px;
            }
            
            .company-logo {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 12px;
            }
            
            .logo-icon {
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
            }
            
            .company-name {
              font-size: 20px;
              font-weight: 700;
              color: #f1f5f9;
            }
            
            .company-subtitle {
              font-size: 11px;
              color: #94a3b8;
              margin-top: 2px;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
            }
            
            .info-item {
              background: #1e293b;
              border-radius: 8px;
              padding: 10px;
              border: 1px solid #334155;
            }
            
            .info-label {
              font-size: 9px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 3px;
            }
            
            .info-value {
              font-size: 12px;
              color: #f1f5f9;
              font-weight: 500;
            }
            
            /* Stats Cards */
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            
            .stat-card {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 12px;
              text-align: center;
            }
            
            .stat-icon {
              width: 28px;
              height: 28px;
              background: linear-gradient(135deg, #22d3ee20 0%, #0ea5e920 100%);
              border-radius: 6px;
              margin: 0 auto 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
            }
            
            .stat-value {
              font-size: 20px;
              font-weight: 700;
              color: #22d3ee;
              margin-bottom: 2px;
            }
            
            .stat-label {
              font-size: 9px;
              color: #94a3b8;
            }
            
            .stat-change {
              font-size: 9px;
              color: #22c55e;
              margin-top: 4px;
            }
            
            /* Maturity Section */
            .maturity-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            }
            
            .maturity-card {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 12px;
            }
            
            .maturity-card h3 {
              font-size: 10px;
              color: #94a3b8;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .maturity-score-display {
              text-align: center;
              padding: 8px;
            }
            
            .score-circle {
              width: 80px;
              height: 80px;
              border-radius: 50%;
              background: conic-gradient(#22d3ee ${overallPercentage * 3.6}deg, #334155 0deg);
              margin: 0 auto 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              position: relative;
            }
            
            .score-circle-inner {
              width: 64px;
              height: 64px;
              border-radius: 50%;
              background: #1e293b;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            
            .score-number {
              font-size: 20px;
              font-weight: 700;
              color: #f1f5f9;
            }
            
            .score-max {
              font-size: 9px;
              color: #64748b;
            }
            
            .maturity-badge {
              display: inline-block;
              background: ${maturity.color}30;
              color: ${maturity.color};
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            }
            
            /* Level Bar */
            .level-bar-container {
              padding: 4px;
            }
            
            .level-item {
              display: flex;
              align-items: center;
              padding: 6px 8px;
              border-radius: 6px;
              margin-bottom: 4px;
              background: #1e293b;
            }
            
            .level-item.active {
              background: linear-gradient(90deg, #22d3ee20 0%, transparent 100%);
              border-left: 2px solid #22d3ee;
            }
            
            .level-number {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #334155;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 600;
              margin-right: 8px;
            }
            
            .level-item.active .level-number {
              background: #22d3ee;
              color: #0f172a;
            }
            
            .level-name {
              font-size: 10px;
              color: #94a3b8;
            }
            
            .level-item.active .level-name {
              color: #f1f5f9;
              font-weight: 500;
            }
            
            /* Categories Section */
            .section {
              background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 12px;
              margin-bottom: 12px;
            }
            
            .section-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            
            .section-title {
              font-size: 12px;
              font-weight: 600;
              color: #f1f5f9;
            }
            
            .category-list {
              margin-top: 8px;
            }
            
            .category-row {
              display: flex;
              align-items: center;
              padding: 8px 10px;
              background: #0f172a;
              border-radius: 8px;
              margin-bottom: 6px;
              border: 1px solid #334155;
            }
            
            .category-rank {
              width: 22px;
              height: 22px;
              border-radius: 6px;
              background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              font-weight: 600;
              color: #94a3b8;
              margin-right: 10px;
            }
            
            .category-info {
              flex: 1;
            }
            
            .category-name {
              font-size: 11px;
              font-weight: 500;
              color: #f1f5f9;
              margin-bottom: 4px;
            }
            
            .category-bar {
              height: 5px;
              background: #334155;
              border-radius: 3px;
              overflow: hidden;
            }
            
            .category-bar-fill {
              height: 100%;
              border-radius: 3px;
              background: linear-gradient(90deg, #22d3ee 0%, #0ea5e9 100%);
            }
            
            .category-score {
              font-size: 12px;
              font-weight: 600;
              color: #22d3ee;
              margin-left: 10px;
              min-width: 40px;
              text-align: right;
            }
            
            /* GAP Table */
            .gap-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              margin-top: 8px;
              font-size: 10px;
            }
            
            .gap-table th {
              background: #0f172a;
              padding: 8px 10px;
              text-align: left;
              font-size: 9px;
              font-weight: 600;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              border-bottom: 1px solid #334155;
            }
            
            .gap-table td {
              padding: 6px 10px;
              font-size: 10px;
              color: #e2e8f0;
              border-bottom: 1px solid #334155;
            }
            
            .gap-table tr:hover td {
              background: #1e293b;
            }
            
            .gap-table .category-row-main td {
              background: #0f172a;
              font-weight: 600;
            }
            
            .level-badge {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 8px;
              font-size: 9px;
              font-weight: 500;
            }
            
            /* Ironman Section */
            .ironman-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-top: 8px;
            }
            
            .ironman-axis {
              background: #0f172a;
              border-radius: 8px;
              padding: 10px;
              border: 1px solid #334155;
            }
            
            .axis-label {
              font-size: 9px;
              color: #94a3b8;
              margin-bottom: 4px;
            }
            
            .axis-value {
              font-size: 18px;
              font-weight: 700;
              color: #f1f5f9;
            }
            
            .axis-bar {
              height: 5px;
              background: #334155;
              border-radius: 3px;
              margin-top: 6px;
              overflow: hidden;
            }
            
            .axis-bar-fill.velocity {
              background: linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%);
            }
            
            .axis-bar-fill.endurance {
              background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
            }
            
            .quadrant-badge {
              display: inline-block;
              background: #22d3ee20;
              color: #22d3ee;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 10px;
              font-weight: 600;
              margin-top: 8px;
            }
            
            /* Recommendations Section */
            .recommendation-list {
              margin-top: 8px;
            }
            
            .recommendation-item {
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 8px;
              padding: 8px 10px;
              margin-bottom: 6px;
            }
            
            .recommendation-header {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;
            }
            
            .rec-type-badge {
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 8px;
              font-weight: 600;
              text-transform: uppercase;
            }
            
            .rec-type-badge.quick-win { background: #22c55e20; color: #22c55e; }
            .rec-type-badge.project { background: #eab30820; color: #eab308; }
            .rec-type-badge.big-bet { background: #ef444420; color: #ef4444; }
            
            .recommendation-title {
              font-size: 11px;
              font-weight: 600;
              color: #f1f5f9;
            }
            
            .recommendation-desc {
              font-size: 9px;
              color: #94a3b8;
              line-height: 1.4;
            }
            
            .rec-meta {
              display: flex;
              gap: 10px;
              margin-top: 6px;
              padding-top: 6px;
              border-top: 1px solid #334155;
            }
            
            .rec-meta-item {
              font-size: 8px;
              color: #64748b;
            }
            
            .rec-meta-item span {
              color: #94a3b8;
            }
            
            /* Footer */
            .footer {
              margin-top: 16px;
              padding: 12px;
              text-align: center;
              border-top: 1px solid #334155;
            }
            
            .footer-text {
              font-size: 9px;
              color: #64748b;
            }
            
            .footer-brand {
              color: #22d3ee;
              font-weight: 600;
            }
            
            /* Page Break */
            .page-break {
              page-break-before: always;
            }
            
            /* Avoid page break inside elements */
            .section, .recommendation-item, .category-row, .ironman-grid {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <!-- Header / Künye Section -->
            <div class="header-section">
              <div class="company-logo">
                <div class="logo-icon">${companyName.charAt(0).toUpperCase()}</div>
                <div>
                  <div class="company-name">${companyName}</div>
                  <div class="company-subtitle">Dönüşüm Değerlendirme Raporu</div>
                </div>
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Sektör</div>
                  <div class="info-value">${sectorName}${subSectorName ? ` / ${subSectorName}` : ''}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Değerlendirme</div>
                  <div class="info-value">${surveyName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Dolduran Kişi</div>
                  <div class="info-value">${userName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Rapor Tarihi</div>
                  <div class="info-value">${reportDate}</div>
                </div>
              </div>
            </div>
            
            <!-- Summary Stats -->
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${overallScore.toFixed(1)}</div>
                <div class="stat-label">Genel Puan</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-value">${completedQuestions}</div>
                <div class="stat-label">Cevaplanan Soru</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📈</div>
                <div class="stat-value">${completionPercentage}%</div>
                <div class="stat-label">Tamamlanma</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">💡</div>
                <div class="stat-value">${recommendations.length}</div>
                <div class="stat-label">Öneri Sayısı</div>
              </div>
            </div>
            
            <!-- Maturity Section -->
            <div class="maturity-section">
              <div class="maturity-card">
                <h3>Genel Olgunluk Puanı</h3>
                <div class="maturity-score-display">
                  <div class="score-circle">
                    <div class="score-circle-inner">
                      <div class="score-number">${overallScore.toFixed(1)}</div>
                      <div class="score-max">/ 5.0</div>
                    </div>
                  </div>
                  <div class="maturity-badge">${maturity.label}</div>
                </div>
              </div>
              
              <div class="maturity-card">
                <h3>Olgunluk Seviyesi</h3>
                <div class="level-bar-container">
                  ${['Lider', 'Olgun', 'Gelişen', 'Farkındalık', 'Başlangıç'].map((level, i) => {
                    const isActive = level === maturity.label;
                    return `
                      <div class="level-item ${isActive ? 'active' : ''}">
                        <div class="level-number">${5 - i}</div>
                        <div class="level-name">${level}</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            
            <!-- Categories Section -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">Kategori Bazlı Performans</div>
              </div>
              <div class="category-list">
                ${Object.entries(scoreData?.categoryScores ?? {}).map(([id, data], index) => `
                  <div class="category-row">
                    <div class="category-rank">${String(index + 1).padStart(2, '0')}</div>
                    <div class="category-info">
                      <div class="category-name">${data?.name ?? 'Kategori'}</div>
                      <div class="category-bar">
                        <div class="category-bar-fill" style="width: ${data?.percentage ?? 0}%;"></div>
                      </div>
                    </div>
                    <div class="category-score">${data?.percentage ?? 0}%</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            ${ironmanData ? `
            <!-- Ironman Analysis -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">Ironman Analizi</div>
              </div>
              <div class="ironman-grid">
                <div class="ironman-axis">
                  <div class="axis-label">⚡ Hız (Velocity)</div>
                  <div class="axis-value">${(ironmanData.velocity ?? 0).toFixed(2)}</div>
                  <div class="axis-bar">
                    <div class="axis-bar-fill velocity" style="width: ${((ironmanData.velocity ?? 0) / 5) * 100}%;"></div>
                  </div>
                </div>
                <div class="ironman-axis">
                  <div class="axis-label">🏃 Dayanıklılık (Endurance)</div>
                  <div class="axis-value">${(ironmanData.endurance ?? 0).toFixed(2)}</div>
                  <div class="axis-bar">
                    <div class="axis-bar-fill endurance" style="width: ${((ironmanData.endurance ?? 0) / 5) * 100}%;"></div>
                  </div>
                </div>
              </div>
              <div style="text-align: center; margin-top: 16px;">
                <div class="quadrant-badge">${ironmanData.quadrant ?? 'Belirsiz'}</div>
              </div>
            </div>
            ` : ''}
          </div>
          
          ${categoryData?.categories ? `
          <div class="page page-break">
            <!-- GAP Analysis Detail -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">GAP Analizi - Detaylı Görünüm</div>
              </div>
              <table class="gap-table">
                <thead>
                  <tr>
                    <th>Kategori / Alt Kategori</th>
                    <th>Mevcut Puan</th>
                    <th>Hedef</th>
                    <th>Fark</th>
                    <th>Seviye</th>
                  </tr>
                </thead>
                <tbody>
                  ${(categoryData.categories ?? []).map((cat: any) => `
                    <tr class="category-row-main">
                      <td><strong>${cat.name}</strong></td>
                      <td><strong>${cat.score?.toFixed(2) ?? '-'}</strong></td>
                      <td>5.00</td>
                      <td style="color: ${(5 - (cat.score ?? 0)) > 2 ? '#ef4444' : '#22c55e'};">${(5 - (cat.score ?? 0)).toFixed(2)}</td>
                      <td>
                        <span class="level-badge" style="background: ${getMaturityLevelFromScore(cat.score ?? 1).color}30; color: ${getMaturityLevelFromScore(cat.score ?? 1).color};">
                          ${getMaturityLevelFromScore(cat.score ?? 1).label}
                        </span>
                      </td>
                    </tr>
                    ${(cat.subCategories ?? []).map((sub: any) => `
                      <tr>
                        <td style="padding-left: 32px; color: #94a3b8;">└ ${sub.name}</td>
                        <td>${sub.score?.toFixed(2) ?? '-'}</td>
                        <td>5.00</td>
                        <td style="color: ${(5 - (sub.score ?? 0)) > 2 ? '#ef4444' : '#22c55e'};">${(5 - (sub.score ?? 0)).toFixed(2)}</td>
                        <td>
                          <span class="level-badge" style="background: ${getMaturityLevelFromScore(sub.score ?? 1).color}30; color: ${getMaturityLevelFromScore(sub.score ?? 1).color};">
                            ${getMaturityLevelFromScore(sub.score ?? 1).label}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            ${recommendations.length > 0 ? `
            <!-- Recommendations Section -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">Öneriler (İlk 10)</div>
              </div>
              <div class="recommendation-list">
                ${recommendations.slice(0, 10).map((rec: any) => `
                  <div class="recommendation-item">
                    <div class="recommendation-header">
                      <span class="rec-type-badge ${
                        rec.strategicType === 'QUICK_WIN' ? 'quick-win' : 
                        rec.strategicType === 'PROJECT' ? 'project' : 'big-bet'
                      }">
                        ${rec.strategicType === 'QUICK_WIN' ? 'Hızlı Kazanım' : 
                          rec.strategicType === 'PROJECT' ? 'Proje' : 'Büyük Yatırım'}
                      </span>
                      <span class="recommendation-title">${rec.title}</span>
                    </div>
                    <div class="recommendation-desc">${rec.description?.substring(0, 200) ?? ''}${(rec.description?.length ?? 0) > 200 ? '...' : ''}</div>
                    <div class="rec-meta">
                      <div class="rec-meta-item">Zaman: <span>${
                        rec.timeframe === 'SHORT_TERM' ? 'Kısa Vade' : 
                        rec.timeframe === 'MEDIUM_TERM' ? 'Orta Vade' : 'Uzun Vade'
                      }</span></div>
                      <div class="rec-meta-item">CAPEX: <span>${'$'.repeat(rec.capexLevel ?? 1)}</span></div>
                      <div class="rec-meta-item">OPEX: <span>${'$'.repeat(rec.opexLevel ?? 1)}</span></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="footer">
              <div class="footer-text">
                Bu rapor <span class="footer-brand">Dönüşüm Platformu</span> tarafından ${reportDate} tarihinde oluşturulmuştur.
              </div>
            </div>
          </div>
          ` : ''}
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
                      <Lightbulb size={12} className="text-amber-500" />
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{cat.recommendationCount}</span>
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
