"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  FileText,
  HelpCircle,
  Lightbulb,
  Activity,
  TrendingUp,
  ChevronDown,
  BarChart3,
  Trophy,
  ArrowDown,
  Clock,
  Building,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";

interface OverviewStats {
  totalUsers: number;
  totalSurveys: number;
  totalQuestions: number;
  totalRecommendations: number;
  activeUsers: number;
  recentActiveUsers: number;
  totalResponses: number;
}

interface Survey {
  id: string;
  name: string;
}

interface SurveyStats {
  name: string;
  questionCount: number;
  completedUsers: number;
  categoryCount: number;
}

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  average: number;
  best: number;
  lowest: number;
  userCount: number;
}

interface UserScore {
  userId: string;
  name: string;
  email: string;
  organization: string;
  sector: string;
  subSector: string;
  percentage: number;
  maturityScore: number;
  responseCount: number;
}

interface SectorStat {
  sector: string;
  average: number;
  best: number;
  lowest: number;
  userCount: number;
}

interface RecentActivity {
  id: string;
  userName: string;
  userEmail: string;
  organization: string;
  question: string;
  score: number;
  updatedAt: string;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string>("");
  const [surveyStats, setSurveyStats] = useState<SurveyStats | null>(null);
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [userScores, setUserScores] = useState<UserScore[]>([]);
  const [sectorStats, setSectorStats] = useState<SectorStat[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchData = async (surveyId?: string) => {
    try {
      const url = surveyId
        ? `/api/admin/dashboard?surveyId=${surveyId}`
        : "/api/admin/dashboard";
      const res = await fetch(url);
      const data = await res.json();

      setOverview(data.overview);
      setSurveys(data.surveys || []);
      setSurveyStats(data.surveyStats);
      setCategoryStats(data.categoryStats || []);
      setUserScores(data.userScores || []);
      setSectorStats(data.sectorStats || []);
      setRecentActivities(data.recentActivities || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSurvey) {
      setLoading(true);
      fetchData(selectedSurvey);
    }
  }, [selectedSurvey]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(selectedSurvey || undefined);
  };

  const filteredUsers = userScores.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.organization?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getScoreColor = (score: number) => {
    if (score >= 4) return "text-green-400";
    if (score >= 3) return "text-blue-400";
    if (score >= 2) return "text-yellow-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 4) return "bg-green-500/20";
    if (score >= 3) return "bg-blue-500/20";
    if (score >= 2) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent)]" />
          <p className="text-[var(--text-muted)]">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sistem panosu"
        subtitle="Platform genelindeki sayılar ve son hareketler."
        actions={
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
            Yenile
          </Button>
        }
      />

      {/* Sayı kartları: her biri kendi renginde bir kutuydu; renk burada
          bilgi taşımıyordu, hepsi tek yüzey diline indi. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam kullanıcı" value={overview?.totalUsers || 0}>
          <dl className="flex flex-col gap-1">
            {/* Cevaplar kişiye değil kuruluşun değerlendirmesine bağlı;
                "aktif" ölçüsü üzerinde çalışılmış değerlendirme sayısıdır. */}
            <div className="flex justify-between gap-3 t-sm">
              <dt style={{ color: "var(--ink-3)" }}>Çalışılan değerlendirme</dt>
              <dd className="tabular" style={{ color: "var(--ink-2)" }}>
                {overview?.activeUsers || 0}
              </dd>
            </div>
            <div className="flex justify-between gap-3 t-sm">
              <dt style={{ color: "var(--ink-3)" }}>Son 7 gün</dt>
              <dd className="tabular" style={{ color: "var(--ink-2)" }}>
                {overview?.recentActiveUsers || 0}
              </dd>
            </div>
          </dl>
        </StatCard>

        <StatCard label="Yayınlanan anket" value={overview?.totalSurveys || 0}>
          <div className="flex justify-between gap-3 t-sm">
            <span style={{ color: "var(--ink-3)" }}>Toplam yanıt</span>
            <span className="tabular" style={{ color: "var(--ink-2)" }}>
              {overview?.totalResponses || 0}
            </span>
          </div>
        </StatCard>

        <StatCard label="Toplam soru" value={overview?.totalQuestions || 0} />
        <StatCard label="Öneri sayısı" value={overview?.totalRecommendations || 0} />
      </div>

      {/* Survey Selector */}
      <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            Anket Bazlı Detaylar
          </h2>
        </div>

        <div className="relative">
          <Button
            onClick={() => setShowDropdown(!showDropdown)}
            variant="secondary"
            className="w-full text-[var(--text-main)]"
          >
            <span>
              {selectedSurvey
                ? surveys.find((s) => s.id === selectedSurvey)?.name
                : "Anket Seçin"}
            </span>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${
                showDropdown ? "rotate-180" : ""
              }`}
            />
          </Button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                exit={{ opacity: 0, y: -10 }}
                className="absolute z-10 mt-2 w-full md:w-80 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)] shadow-xl overflow-hidden"
              >
                {surveys.map((survey) => (
                  <button
                    key={survey.id}
                    onClick={() => {
                      setSelectedSurvey(survey.id);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-[var(--bg-card-2)] transition-colors ${
                      selectedSurvey === survey.id
                        ? "bg-[var(--accent-quiet)] text-[var(--accent)]"
                        : "text-[var(--text-main)]"
                    }`}
                  >
                    {survey.name}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Survey Stats & Category Stats */}
      {selectedSurvey && surveyStats && (
        <>
          {/* Survey Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                <Layers className="w-4 h-4" />
                <span className="text-sm">Kategori Sayısı</span>
              </div>
              <p className="text-xl font-semibold text-[var(--text-main)]">
                {surveyStats.categoryCount}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                <HelpCircle className="w-4 h-4" />
                <span className="text-sm">Soru Sayısı</span>
              </div>
              <p className="text-xl font-semibold text-[var(--text-main)]">
                {surveyStats.questionCount}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-soft)]">
              <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                <Users className="w-4 h-4" />
                <span className="text-sm">Tamamlayan Değerlendirme</span>
              </div>
              <p className="text-xl font-semibold text-[var(--text-main)]">
                {surveyStats.completedUsers}
              </p>
            </div>
          </div>

          {/* Category Statistics */}
          <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-lg font-semibold text-[var(--text-main)]">
                Kategori Bazlı Sektörel İstatistikler
              </h2>
            </div>

            {categoryStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="theme-table">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)]">
                      <th>
                        Kategori
                      </th>
                      <th className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Activity className="w-4 h-4" />
                          Ortalama
                        </div>
                      </th>
                      <th className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-400" />
                          En İyi
                        </div>
                      </th>
                      <th className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ArrowDown className="w-4 h-4 text-red-400" />
                          En Düşük
                        </div>
                      </th>
                      <th className="text-center">
                        Değerlendirme
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.map((cat, index) => (
                      <motion.tr
                        key={cat.categoryId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--bg-card-2)] transition-colors"
                      >
                        <td className="py-4 px-4 text-[var(--text-main)] font-medium">
                          {cat.categoryName}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${getScoreBg(
                              cat.average
                            )} ${getScoreColor(cat.average)}`}
                          >
                            {cat.average.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-green-400 font-medium">
                            {cat.best.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-red-400 font-medium">
                            {cat.lowest.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center text-[var(--text-muted)]">
                          {cat.userCount}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-center py-8">
                Bu anket için henüz veri bulunmuyor.
              </p>
            )}
          </div>

          {/* Sector Statistics */}
          {sectorStats.length > 0 && (
            <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
              <div className="flex items-center gap-3 mb-6">
                <Building className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-[var(--text-main)]">
                  Sektör Bazlı İstatistikler
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sectorStats.map((sector, index) => (
                  <motion.div
                    key={sector.sector}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]"
                  >
                    <h3 className="font-medium text-[var(--text-main)] mb-3">
                      {sector.sector}
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-muted)]">
                          Ortalama
                        </span>
                        <span
                          className={`font-medium ${getScoreColor(
                            sector.average
                          )}`}
                        >
                          {sector.average.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-muted)]">
                          En İyi
                        </span>
                        <span className="text-green-400 font-medium">
                          {sector.best.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-[var(--text-muted)]">
                          En Düşük
                        </span>
                        <span className="text-red-400 font-medium">
                          {sector.lowest.toFixed(1)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[var(--border-soft)]">
                        <div className="flex justify-between">
                          <span className="text-sm text-[var(--text-muted)]">
                            Değerlendirme
                          </span>
                          <span className="text-[var(--text-main)]">
                            {sector.userCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* User Scores */}
          <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold text-[var(--text-main)]">
                  Değerlendirme Puanları
                </h2>
                <span className="px-2 py-1 rounded-full bg-[var(--accent-quiet)] text-[var(--accent)] text-sm">
                  {userScores.length} değerlendirme
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] w-64"
                />
              </div>
            </div>

            {filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="theme-table">
                  <thead>
                    <tr className="border-b border-[var(--border-soft)]">
                      <th>
                        #
                      </th>
                      {/* Satır bir kuruluşun değerlendirmesi; ad olarak kuruluş,
                          tek kişilik değerlendirmede sahibi gösterilir. */}
                      <th>
                        Değerlendirme
                      </th>
                      <th>
                        Kuruluş
                      </th>
                      <th>
                        Sektör
                      </th>
                      <th className="text-center">
                        Olgunluk
                      </th>
                      <th className="text-center">
                        Yüzde
                      </th>
                      <th className="text-center">
                        Yanıt
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <motion.tr
                        key={user.userId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-[var(--border-soft)]/50 hover:bg-[var(--bg-card-2)] transition-colors"
                      >
                        <td className="py-3 px-4">
                          {index < 3 ? (
                            <span
                              className={`w-6 h-6 inline-flex items-center justify-center rounded-full text-sm font-semibold ${
                                index === 0
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : index === 1
                                  ? "bg-gray-400/20 text-gray-300"
                                  : "bg-amber-600/20 text-amber-500"
                              }`}
                            >
                              {index + 1}
                            </span>
                          ) : (
                            <span className="text-[var(--text-dim)]">
                              {index + 1}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-[var(--text-main)] font-medium">
                              {user.name}
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-main)]">
                          {user.organization || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <div>
                            <p className="text-[var(--text-main)]">
                              {user.sector}
                            </p>
                            {user.subSector !== "-" && (
                              <p className="text-sm text-[var(--text-muted)]">
                                {user.subSector}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-semibold ${getScoreBg(
                              user.maturityScore
                            )} ${getScoreColor(user.maturityScore)}`}
                          >
                            {user.maturityScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-[var(--bg-card-2)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--accent)]"
                                style={{ width: `${user.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-[var(--text-main)]">
                              %{user.percentage}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-[var(--text-muted)]">
                          {user.responseCount}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[var(--text-muted)] text-center py-8">
                {searchQuery
                  ? "Arama kriterine uygun değerlendirme bulunamadı."
                  : "Bu anket için henüz değerlendirme puanı bulunmuyor."}
              </p>
            )}
          </div>
        </>
      )}

      {/* Recent Activities */}
      <div className="p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-main)]">
            Son Aktiviteler
          </h2>
        </div>

        {recentActivities.length > 0 ? (
          <div className="space-y-3">
            {recentActivities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-main)]">
                      {activity.userName}
                    </span>
                    {activity.organization && (
                      <span className="text-sm text-[var(--text-muted)]">
                        ({activity.organization})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {activity.question}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded text-sm font-medium ${getScoreBg(
                      activity.score
                    )} ${getScoreColor(activity.score)}`}
                  >
                    {activity.score}/5
                  </span>
                  <span className="text-sm text-[var(--text-dim)]">
                    {new Date(activity.updatedAt).toLocaleDateString("tr-TR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-center py-8">
            Henüz aktivite bulunmuyor.
          </p>
        )}
      </div>
    </div>
  );
}
