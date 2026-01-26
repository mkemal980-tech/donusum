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
import { KPIDashboard } from "./kpi-dashboard";
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

      // HTML içeriği - Profesyonel Rapor Formatı
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&family=Open+Sans:wght@400;600;700&display=swap');
            
            @page {
              size: A4;
              margin: 20mm 25mm;
            }
            
            @page :first {
              margin: 0;
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body { 
              font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif; 
              background: #ffffff;
              color: #1f2937;
              line-height: 1.7;
              font-size: 11pt;
            }
            
            h1, h2, h3 {
              font-family: 'Merriweather', Georgia, serif;
              color: #111827;
            }
            
            /* ========== KAPAK SAYFASI ========== */
            .cover-page {
              height: 297mm;
              background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              color: white;
              padding: 40mm;
              page-break-after: always;
            }
            
            .cover-logo {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%);
              border-radius: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 36px;
              font-weight: 700;
              color: #0f172a;
              margin-bottom: 40px;
              box-shadow: 0 20px 60px rgba(34, 211, 238, 0.3);
            }
            
            .cover-title {
              font-size: 32pt;
              font-weight: 700;
              margin-bottom: 16px;
              letter-spacing: -0.5px;
            }
            
            .cover-subtitle {
              font-size: 14pt;
              color: #94a3b8;
              margin-bottom: 60px;
              font-weight: 400;
            }
            
            .cover-company {
              font-size: 24pt;
              font-weight: 600;
              color: #22d3ee;
              margin-bottom: 8px;
            }
            
            .cover-meta {
              font-size: 11pt;
              color: #64748b;
              margin-top: 80px;
            }
            
            .cover-meta-item {
              margin-bottom: 8px;
            }
            
            .cover-badge {
              display: inline-block;
              background: rgba(34, 211, 238, 0.15);
              border: 1px solid rgba(34, 211, 238, 0.3);
              color: #22d3ee;
              padding: 12px 32px;
              border-radius: 30px;
              font-size: 12pt;
              font-weight: 600;
              margin-top: 40px;
            }
            
            /* ========== İÇERİK SAYFALARI ========== */
            .content-page {
              padding: 0;
              page-break-after: always;
            }
            
            .page-header {
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 12px;
              margin-bottom: 24px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .page-header-title {
              font-size: 10pt;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            
            .page-header-company {
              font-size: 10pt;
              color: #0ea5e9;
              font-weight: 600;
            }
            
            .section-title {
              font-size: 18pt;
              color: #0f172a;
              margin-bottom: 20px;
              padding-bottom: 12px;
              border-bottom: 3px solid #0ea5e9;
              display: inline-block;
            }
            
            .section-intro {
              font-size: 11pt;
              color: #4b5563;
              margin-bottom: 24px;
              line-height: 1.8;
            }
            
            /* Özet Kutusu */
            .summary-box {
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              border-left: 4px solid #0ea5e9;
              padding: 20px 24px;
              margin-bottom: 28px;
              border-radius: 0 8px 8px 0;
            }
            
            .summary-box h3 {
              font-size: 12pt;
              color: #0369a1;
              margin-bottom: 12px;
            }
            
            .summary-box p {
              font-size: 11pt;
              color: #1e40af;
              line-height: 1.7;
            }
            
            /* KPI Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
              margin-bottom: 28px;
            }
            
            .kpi-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 20px;
              text-align: center;
            }
            
            .kpi-value {
              font-size: 28pt;
              font-weight: 700;
              color: #0f172a;
            }
            
            .kpi-value.highlight {
              color: #0ea5e9;
            }
            
            .kpi-label {
              font-size: 9pt;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 4px;
            }
            
            /* Tablo Stili */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 24px;
              font-size: 10pt;
            }
            
            .data-table th {
              background: #0f172a;
              color: white;
              padding: 12px 16px;
              text-align: left;
              font-weight: 600;
              font-size: 9pt;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .data-table td {
              padding: 12px 16px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .data-table tr:nth-child(even) {
              background: #f9fafb;
            }
            
            .data-table tr:hover {
              background: #f0f9ff;
            }
            
            /* Seviye Badge */
            .level-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 9pt;
              font-weight: 600;
            }
            
            .level-badge.baslangic { background: #fef2f2; color: #dc2626; }
            .level-badge.farkindalik { background: #fff7ed; color: #ea580c; }
            .level-badge.gelisen { background: #fefce8; color: #ca8a04; }
            .level-badge.olgun { background: #f0fdf4; color: #16a34a; }
            .level-badge.lider { background: #eff6ff; color: #2563eb; }
            
            /* Progress Bar */
            .progress-bar {
              height: 8px;
              background: #e5e7eb;
              border-radius: 4px;
              overflow: hidden;
            }
            
            .progress-fill {
              height: 100%;
              border-radius: 4px;
              transition: width 0.3s;
            }
            
            .progress-fill.low { background: linear-gradient(90deg, #ef4444, #f87171); }
            .progress-fill.medium { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
            .progress-fill.high { background: linear-gradient(90deg, #22c55e, #4ade80); }
            
            /* Öneri Kartları */
            .recommendation-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 16px;
              margin-bottom: 24px;
            }
            
            .rec-card {
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              padding: 16px 20px;
              border-left: 4px solid;
            }
            
            .rec-card.quick-win { border-left-color: #22c55e; }
            .rec-card.project { border-left-color: #f59e0b; }
            .rec-card.big-bet { border-left-color: #ef4444; }
            
            .rec-header {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 8px;
            }
            
            .rec-type {
              font-size: 8pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 3px 10px;
              border-radius: 4px;
            }
            
            .rec-type.quick-win { background: #dcfce7; color: #166534; }
            .rec-type.project { background: #fef3c7; color: #92400e; }
            .rec-type.big-bet { background: #fee2e2; color: #991b1b; }
            
            .rec-title {
              font-size: 11pt;
              font-weight: 600;
              color: #1f2937;
            }
            
            .rec-desc {
              font-size: 10pt;
              color: #6b7280;
              line-height: 1.6;
            }
            
            .rec-meta {
              display: flex;
              gap: 20px;
              margin-top: 10px;
              font-size: 9pt;
              color: #9ca3af;
            }
            
            /* İki Sütun Layout */
            .two-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 24px;
            }
            
            .column-box {
              background: #f8fafc;
              border-radius: 12px;
              padding: 20px;
            }
            
            .column-box h4 {
              font-size: 11pt;
              color: #374151;
              margin-bottom: 16px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;
            }
            
            .column-list {
              list-style: none;
            }
            
            .column-list li {
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            
            .column-list li:last-child {
              border-bottom: none;
            }
            
            /* Ironman Bölümü */
            .ironman-section {
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              border-radius: 12px;
              padding: 24px;
              color: white;
              margin-bottom: 24px;
            }
            
            .ironman-section h4 {
              font-size: 12pt;
              color: #22d3ee;
              margin-bottom: 16px;
            }
            
            .ironman-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 20px;
              text-align: center;
            }
            
            .ironman-stat {
              background: rgba(255,255,255,0.05);
              border-radius: 8px;
              padding: 16px;
            }
            
            .ironman-value {
              font-size: 24pt;
              font-weight: 700;
            }
            
            .ironman-value.velocity { color: #fbbf24; }
            .ironman-value.endurance { color: #60a5fa; }
            .ironman-value.quadrant { color: #22d3ee; font-size: 14pt; }
            
            .ironman-label {
              font-size: 9pt;
              color: #94a3b8;
              margin-top: 4px;
            }
            
            /* Sayfa Altı */
            .page-footer {
              position: fixed;
              bottom: 20mm;
              left: 25mm;
              right: 25mm;
              border-top: 1px solid #e5e7eb;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              color: #9ca3af;
            }
            
            /* Print ayarları */
            @media print {
              .page-break { page-break-before: always; }
            }
          </style>
        </head>
        <body>
          <!-- ========== KAPAK SAYFASI ========== -->
          <div class="cover-page">
            <div class="cover-logo">${companyName.charAt(0).toUpperCase()}</div>
            <div class="cover-title">Dönüşüm Olgunluk<br/>Değerlendirme Raporu</div>
            <div class="cover-subtitle">${surveyName}</div>
            <div class="cover-company">${companyName}</div>
            <div class="cover-badge">${maturity.label} Seviyesi</div>
            <div class="cover-meta">
              <div class="cover-meta-item"><strong>Sektör:</strong> ${sectorName}${subSectorName ? ` / ${subSectorName}` : ''}</div>
              <div class="cover-meta-item"><strong>Değerlendiren:</strong> ${userName}</div>
              <div class="cover-meta-item"><strong>Rapor Tarihi:</strong> ${reportDate}</div>
            </div>
          </div>

          <!-- ========== YÖNETİCİ ÖZETİ ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Yönetici Özeti</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Yönetici Özeti</h2>
            
            <div class="summary-box">
              <h3>Genel Değerlendirme</h3>
              <p>
                ${companyName}, gerçekleştirilen ${surveyName} değerlendirmesi sonucunda 
                <strong>${categoryCount} ana kategori</strong> üzerinden analiz edilmiştir. 
                Değerlendirme sonucunda kuruluşunuz <strong>%${overallPercentage.toFixed(0)}</strong> tamamlanma oranıyla 
                <strong>"${maturity.label}"</strong> olgunluk seviyesine ulaşmıştır. 
                Toplam <strong>${recommendations.length} öneri</strong> belirlenmiş olup, bunların 
                ${quickWinCount} tanesi hızlı kazanım, ${projectCount} tanesi proje ve ${bigBetCount} tanesi stratejik yatırım niteliğindedir.
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
              <div class="column-box" style="background: #fef2f2;">
                <h4 style="color: #dc2626;">⚠️ Gelişim Gerektiren Alanlar</h4>
                <ul class="column-list">
                  ${lowestCategories.length > 0 ? lowestCategories.map(([id, data]: any) => `
                    <li>
                      <span>${data?.name ?? 'Kategori'}</span>
                      <span style="color: #dc2626; font-weight: 600;">${data?.percentage?.toFixed(0) ?? 0}%</span>
                    </li>
                  `).join('') : '<li><span>Veri yok</span></li>'}
                </ul>
              </div>
              <div class="column-box" style="background: #f0fdf4;">
                <h4 style="color: #16a34a;">✓ Güçlü Alanlar</h4>
                <ul class="column-list">
                  ${highestCategories.length > 0 ? highestCategories.map(([id, data]: any) => `
                    <li>
                      <span>${data?.name ?? 'Kategori'}</span>
                      <span style="color: #16a34a; font-weight: 600;">${data?.percentage?.toFixed(0) ?? 0}%</span>
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

          <!-- ========== KATEGORİ ANALİZİ ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Kategori Analizi</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Kategori Bazlı Performans</h2>
            
            <p class="section-intro">
              Aşağıdaki tablo, değerlendirme kapsamındaki tüm kategorilerdeki performansınızı göstermektedir. 
              Her kategori için mevcut puan, hedef puan ve olgunluk seviyesi belirtilmiştir.
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
          <!-- ========== ÖNERİLER ========== -->
          <div class="content-page">
            <div class="page-header">
              <span class="page-header-title">Öneriler ve Eylem Planı</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Stratejik Öneriler</h2>
            
            <p class="section-intro">
              Değerlendirme sonucunda belirlenen öneriler, stratejik önem ve uygulama kolaylığına göre sınıflandırılmıştır. 
              Hızlı kazanımlar kısa vadede uygulanabilirken, büyük yatırımlar uzun vadeli planlama gerektirir.
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

          <!-- ========== SONUÇ ========== -->
          <div class="content-page" style="page-break-after: auto;">
            <div class="page-header">
              <span class="page-header-title">Sonuç ve Değerlendirme</span>
              <span class="page-header-company">${companyName}</span>
            </div>
            
            <h2 class="section-title">Sonuç</h2>
            
            <div class="summary-box">
              <h3>Değerlendirme Özeti</h3>
              <p>
                ${companyName} için gerçekleştirilen bu değerlendirme, kuruluşun dönüşüm yolculuğundaki mevcut konumunu 
                ortaya koymaktadır. <strong>"${maturity.label}"</strong> seviyesinde bulunan kuruluşun, belirlenen öneriler 
                doğrultusunda sistematik bir iyileştirme yaklaşımı benimsemesi önerilmektedir.
              </p>
            </div>
            
            <div class="two-column">
              <div class="column-box">
                <h4>📈 Öncelikli Eylemler</h4>
                <ul class="column-list">
                  <li>Hızlı kazanımları 3 ay içinde tamamlayın</li>
                  <li>Proje önceliklerini belirleyin</li>
                  <li>Büyük yatırımlar için bütçe planlayın</li>
                  <li>İlerlemeyi düzenli olarak ölçün</li>
                </ul>
              </div>
              <div class="column-box">
                <h4>🎯 Hedefler</h4>
                <ul class="column-list">
                  <li>6 ay sonra: Farkındalık seviyesine ulaşın</li>
                  <li>12 ay sonra: Gelişen seviyesine yükselin</li>
                  <li>24 ay sonra: Olgun seviyeyi hedefleyin</li>
                </ul>
              </div>
            </div>
            
            <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-top: 24px; text-align: center;">
              <p style="font-size: 10pt; color: #6b7280; margin-bottom: 8px;">
                Bu rapor ${reportDate} tarihinde
              </p>
              <p style="font-size: 12pt; color: #0ea5e9; font-weight: 600;">
                Dönüşüm Platformu
              </p>
              <p style="font-size: 10pt; color: #6b7280; margin-top: 8px;">
                tarafından otomatik olarak oluşturulmuştur.
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

        {/* KPI Dashboard */}
        <KPIDashboard surveyId={selectedSurveyId} />

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
                <p className="text-2xl font-bold text-[var(--text-primary)]">{scoreData?.totalScore ?? 0}%</p>
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
                      <Lightbulb size={12} className="text-amber-400" />
                      <span className="font-semibold text-amber-400 ">{cat.recommendationCount}</span>
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
            transition={{ delay: 0.5 }}
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