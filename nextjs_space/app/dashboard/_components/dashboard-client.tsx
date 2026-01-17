"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Header from "@/components/ui/header";
import ScoreCard from "@/components/ui/score-card";
import ProgressBar from "@/components/ui/progress-bar";
import { BenchmarkSection } from "./benchmark-section";
import { 
  ClipboardList, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight,
  BarChart3,
  Lightbulb,
  Map
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

const categoryColors = [
  "#1e3a8a",
  "#a78bfa",
  "#7c3aed",
  "#3b5998",
  "#c4b5fd"
];

export default function DashboardClient() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scoreRes, responsesRes, structureRes] = await Promise.all([
          fetch("/api/survey/score"),
          fetch("/api/survey/responses"),
          fetch("/api/survey/structure")
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
          (structure ?? []).forEach((cat: any) => {
            (cat?.subCategories ?? []).forEach((sub: any) => {
              (sub?.subLevels ?? []).forEach((level: any) => {
                count += (level?.questions?.length ?? 0);
              });
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
  }, []);

  const completedQuestions = responses?.length ?? 0;
  const completionPercentage = totalQuestions > 0 
    ? Math.round((completedQuestions / totalQuestions) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dönüşüm Panosu</h1>
          <p className="text-gray-600">Kuruluşunuzun olgunluk değerlendirmesi ilerlemesini ve içgörülerini takip edin</p>
        </motion.div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6 card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="text-[#1e3a8a]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Anket İlerlemesi</p>
                <p className="text-2xl font-bold text-gray-900">{completionPercentage}%</p>
              </div>
            </div>
            <div className="mt-4">
              <ProgressBar value={completionPercentage} label="" color="#1e3a8a" />
              <p className="text-xs text-gray-500 mt-2">{totalQuestions} sorudan {completedQuestions} tanesi tamamlandı</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6 card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[#a78bfa]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Mevcut Puan</p>
                <p className="text-2xl font-bold text-gray-900">{scoreData?.totalScore ?? 0}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6 card-hover"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Değerlendirilen Kategoriler</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.keys(scoreData?.categoryScores ?? {})?.length ?? 0}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Score Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-8 flex flex-col items-center justify-center"
          >
            <h3 className="text-lg font-semibold text-gray-700 mb-6">Genel Olgunluk Puanı</h3>
            <ScoreCard 
              score={scoreData?.totalScore ?? 0} 
              label="Başlangıç Puanı" 
              color="#1e3a8a" 
              size="large" 
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="text-[#a78bfa]" size={20} />
              <h3 className="text-lg font-semibold text-gray-700">Kategorilere Göre Puan Dağılımı</h3>
            </div>
            
            <div className="space-y-5">
              {Object.entries(scoreData?.categoryScores ?? {})?.map(([id, data], index) => (
                <ProgressBar
                  key={id}
                  value={data?.percentage ?? 0}
                  label={data?.name ?? 'Bilinmeyen Kategori'}
                  color={categoryColors[index % categoryColors.length]}
                />
              ))}
              
              {Object.keys(scoreData?.categoryScores ?? {})?.length === 0 && (
                <div className="text-center py-8 text-gray-500">
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

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <button
            onClick={() => router.push("/survey")}
            className="bg-gradient-to-br from-[#1e3a8a] to-[#3b5998] text-white rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
          >
            <ClipboardList size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ankete Devam Et</h3>
            <p className="text-sm text-blue-100 mb-4">Olgunluk değerlendirmenizi tamamlayın</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              Başla <ArrowRight size={16} />
            </span>
          </button>

          <button
            onClick={() => router.push("/recommendations")}
            className="bg-gradient-to-br from-[#a78bfa] to-[#7c3aed] text-white rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
          >
            <Lightbulb size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Önerileri Görüntüle</h3>
            <p className="text-sm text-purple-100 mb-4">Geliştirme fırsatlarını keşfedin</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              İncele <ArrowRight size={16} />
            </span>
          </button>

          <button
            onClick={() => router.push("/roadmap")}
            className="bg-gradient-to-br from-[#059669] to-[#047857] text-white rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
          >
            <Map size={32} className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Yol Haritası Oluştur</h3>
            <p className="text-sm text-green-100 mb-4">Dönüşüm yolculuğunuzu planlayın</p>
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              Planla <ArrowRight size={16} />
            </span>
          </button>
        </motion.div>
      </main>
    </div>
  );
}
