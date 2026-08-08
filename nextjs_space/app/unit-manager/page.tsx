"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/ui/header";
import { getWithRetry } from "@/lib/retrying-fetch";
import { toast } from "sonner";
import {
  Users,
  Building2,
  TrendingUp,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Files,
  ListChecks,
  Download,
  User,
  FileText,
} from "lucide-react";

/**
 * Tablonun satırı kişi değil değerlendirme: cevaplar kuruluşun
 * değerlendirmesine bağlı ve amaç tek kurumsal puan. "Kim ne kadar doldurdu"
 * sorusu görev dağılımı ekranında cevaplanıyor.
 */
interface AssessmentRow {
  id: string;
  unitId: string;
  unitName: string;
  surveyId: string;
  surveyName: string;
  responseCount: number;
  contributorCount: number;
  lastActivityAt: string | null;
  score: number;
  maturityScore: number;
}

interface UnitSummary {
  id: string;
  name: string;
  description: string | null;
  assessmentCount: number;
  startedCount: number;
  averageScore: number;
}

interface Document {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  downloadUrl: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    unit?: { id: string; name: string } | null;
  };
  response?: {
    question: {
      text: string;
      category?: { name: string } | null;
      subLevel?: { name: string; subCategory: { name: string; category: { name: string } } } | null;
      subCategory?: { name: string; category: { name: string } } | null;
    };
  } | null;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-[var(--accent)] bg-[rgba(12,193,195,0.15)]";
  if (score >= 60) return "text-[var(--blue-main)] bg-[rgba(46,134,255,0.15)]";
  if (score >= 40) return "text-[var(--accent)] bg-[var(--accent)]/15";
  if (score >= 20) return "text-[var(--warning)] bg-[var(--warning-bg)]";
  return "text-[var(--error)] bg-[rgba(239,68,68,0.15)]";
};

const getMaturityLabel = (score: number) => {
  if (score >= 4.5) return { label: "Lider", color: "text-[var(--accent)]" };
  if (score >= 3.5) return { label: "Olgun", color: "text-[var(--blue-main)]" };
  if (score >= 2.5) return { label: "Gelişen", color: "text-[var(--accent)]" };
  if (score >= 1.5) return { label: "Farkındalık", color: "text-[var(--warning)]" };
  return { label: "Başlangıç", color: "text-[var(--error)]" };
};

export default function UnitManagerPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"team" | "documents">("team");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    const role = (session?.user as any)?.role;
    if (status === "authenticated" && role !== "UNIT_MANAGER" && role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }

    if (status === "authenticated") {
      fetchTeamData();
    }
  }, [status, session, router]);

  const fetchTeamData = async () => {
    try {
      const res = await getWithRetry("/api/unit-manager/team");
      if (res.ok) {
        const data = await res.json();
        setUnits(data.units || []);
        setAssessments(data.assessments || []);
        setExpandedUnits(new Set(data.units?.map((u: UnitSummary) => u.id) || []));
      }
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await getWithRetry("/api/unit-manager/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Dosya verisi çekme hatası:", error);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "documents" && documents.length === 0) {
      fetchDocuments();
    }
  }, [activeTab, documents.length, fetchDocuments]);

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  const handleDownload = (doc: Document) => {
    if (doc.downloadUrl) {
      const link = document.createElement("a");
      link.href = doc.downloadUrl;
      link.download = doc.fileName;
      link.click();
    } else {
      toast.error("Dosya indirilemedi");
    }
  };

  const getQuestionContext = (doc: Document) => {
    if (!doc.response?.question) return "Bağlantısız dosya";
    const q = doc.response.question;
    if (q.subLevel) {
      return `${q.subLevel.subCategory.category.name} > ${q.subLevel.subCategory.name} > ${q.subLevel.name}`;
    } else if (q.subCategory) {
      return `${q.subCategory.category.name} > ${q.subCategory.name}`;
    } else if (q.category) {
      return q.category.name;
    }
    return "";
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("image")) return "🖼️";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("excel") || fileType.includes("sheet")) return "📊";
    return "📎";
  };

  const getUserName = (doc: Document) => {
    return [doc.user.firstName, doc.user.lastName].filter(Boolean).join(" ") || doc.user.email;
  };

  if (loading || status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const totalAssessments = assessments.length;
  // Başlanmış olanlar: hiç cevabı olmayan değerlendirme ortalamayı aşağı çekmesin.
  const startedAssessments = assessments.filter((row) => row.responseCount > 0);
  const avgScore =
    startedAssessments.length > 0
      ? startedAssessments.reduce((sum, row) => sum + row.score, 0) / startedAssessments.length
      : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2 flex items-center gap-3">
                <Building2 className="text-[var(--accent)]" />
                Birim Yöneticisi Paneli
              </h1>
              <p className="text-[var(--text-muted)]">Biriminizdeki kullanıcıların anket ilerleme ve sonuçlarını takip edin</p>
            </div>

            {/* Anketin hangi bölümünü kimin dolduracağı buradan belirlenir. */}
            <button
              onClick={() => router.push("/unit-manager/assignments")}
              className="px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors flex items-center gap-2"
            >
              <ListChecks size={18} />
              Görev Dağılımı
            </button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[var(--bg-card)]  rounded-xl shadow-md p-6 border border-[var(--border-soft)] "
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[rgba(46,134,255,0.15)]  rounded-lg flex items-center justify-center">
                <Building2 className="text-[var(--accent)] " size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)] ">Birim Sayısı</p>
                <p className="text-2xl font-bold text-[var(--text-main)] ">{units.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[var(--bg-card)]  rounded-xl shadow-md p-6 border border-[var(--border-soft)] "
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--accent)]/15  rounded-lg flex items-center justify-center">
                <Users className="text-[var(--accent)] " size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)] ">Değerlendirme</p>
                <p className="text-2xl font-bold text-[var(--text-main)] ">{totalAssessments}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[var(--bg-card)]  rounded-xl shadow-md p-6 border border-[var(--border-soft)] "
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[rgba(12,193,195,0.15)]  rounded-lg flex items-center justify-center">
                <CheckCircle className="text-[var(--accent)] " size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)] ">Başlanan</p>
                <p className="text-2xl font-bold text-[var(--text-main)] ">
                  {startedAssessments.length} / {totalAssessments}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[var(--bg-card)]  rounded-xl shadow-md p-6 border border-[var(--border-soft)] "
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[var(--warning-bg)]  rounded-lg flex items-center justify-center">
                <TrendingUp className="text-[var(--warning)] " size={24} />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)] ">Ortalama Skor</p>
                <p className="text-2xl font-bold text-[var(--text-main)] ">%{Math.round(avgScore)}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[var(--bg-main)]  p-1 rounded-xl w-fit border border-[var(--border-soft)] ">
          <button
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "team"
                ? "bg-[var(--accent)] text-white shadow-md"
                : "text-[var(--text-muted)]  hover:bg-[var(--border-soft)] "
            }`}
          >
            <Users size={18} />
            Değerlendirmeler
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              activeTab === "documents"
                ? "bg-[var(--accent)] text-white shadow-md"
                : "text-[var(--text-muted)]  hover:bg-[var(--border-soft)] "
            }`}
          >
            <Files size={18} />
            Yüklenen Dosyalar
            {documents.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-[var(--bg-card)]/20 rounded-full text-xs">
                {documents.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "team" ? (
        <div className="space-y-6">
          {units.map((unit) => {
            const unitAssessments = assessments.filter((row) => row.unitId === unit.id);
            const isExpanded = expandedUnits.has(unit.id);

            return (
              <motion.div
                key={unit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden"
              >
                {/* Unit Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-[var(--bg-main)] transition-colors"
                  onClick={() => toggleUnit(unit.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronDown className="text-[var(--text-dim)]" size={20} />
                      ) : (
                        <ChevronRight className="text-[var(--text-dim)]" size={20} />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--text-main)]">{unit.name}</h3>
                        {unit.description && (
                          <p className="text-sm text-[var(--text-dim)]">{unit.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm text-[var(--text-dim)]">Değerlendirme</p>
                        <p className="font-semibold text-[var(--text-main)]">
                          {unit.assessmentCount}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-[var(--text-dim)]">Başlanan</p>
                        <p className="font-semibold text-[var(--accent)]">{unit.startedCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-[var(--text-dim)]">Ort. Skor</p>
                        <p className="font-semibold text-[var(--accent)]">%{unit.averageScore}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members */}
                {isExpanded && unitAssessments.length > 0 && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-[var(--bg-main)]">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">
                            Değerlendirme
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">
                            Katkı veren
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">
                            Durum
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">
                            Skor
                          </th>
                          <th className="px-6 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">
                            Olgunluk
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {unitAssessments.map((row) => {
                          const maturity = getMaturityLabel(row.maturityScore);
                          return (
                            <tr key={row.id} className="hover:bg-[var(--bg-main)]">
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-[var(--text-main)]">
                                    {row.surveyName}
                                  </p>
                                  <p className="text-sm text-[var(--text-dim)] tabular-nums">
                                    {row.responseCount} cevap
                                    {row.lastActivityAt
                                      ? ` · son giriş ${new Date(
                                          row.lastActivityAt
                                        ).toLocaleDateString("tr-TR")}`
                                      : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-[var(--text-muted)] tabular-nums">
                                {row.contributorCount > 0 ? `${row.contributorCount} kişi` : "-"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {row.responseCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[rgba(12,193,195,0.15)] text-[var(--accent)] rounded-full text-xs font-medium">
                                    <CheckCircle size={12} />
                                    Başlandı
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--warning-bg)] text-[var(--warning)] rounded-full text-xs font-medium">
                                    <Clock size={12} />
                                    Bekliyor
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(
                                    row.score
                                  )}`}
                                >
                                  <BarChart3 size={14} />
                                  %{row.score}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`font-medium ${maturity.color}`}>
                                  {row.maturityScore > 0 ? (
                                    <>
                                      {row.maturityScore.toFixed(1)} - {maturity.label}
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && unitAssessments.length === 0 && (
                  <div className="border-t p-8 text-center text-[var(--text-dim)]">
                    Bu birimde henüz değerlendirme başlatılmadı
                  </div>
                )}
              </motion.div>
            );
          })}

          {units.length === 0 && (
            <div className="bg-[var(--bg-card)]  rounded-xl shadow-md p-12 text-center border border-[var(--border-soft)] ">
              <Building2 size={48} className="mx-auto text-[var(--ui-passive)]  mb-4" />
              <h2 className="text-xl font-semibold text-[var(--text-muted)]  mb-2">
                Yönettiğiniz Birim Bulunamadı
              </h2>
              <p className="text-[var(--text-dim)] ">
                Henüz yöneticiniz olarak atandığınız bir birim bulunmuyor.
              </p>
            </div>
          )}
        </div>
        ) : (
          /* Documents Tab */
          <div className="space-y-4">
            {loadingDocs ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-[var(--bg-card)]  rounded-xl p-12 text-center border border-[var(--border-soft)] ">
                <FileText className="mx-auto text-[var(--ui-passive)]  mb-4" size={48} />
                <p className="text-[var(--text-dim)] ">Henüz yüklenmiş dosya bulunmuyor</p>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)]  rounded-xl shadow-md border border-[var(--border-soft)]  overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[var(--bg-main)] ">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-dim)]  uppercase tracking-wider">Dosya</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-dim)]  uppercase tracking-wider">Kullanıcı</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-dim)]  uppercase tracking-wider">Soru Bağlamı</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-[var(--text-dim)]  uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-[var(--text-dim)]  uppercase tracking-wider">İndir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 ">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-[var(--bg-main)]  transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getFileIcon(doc.fileType)}</span>
                            <div>
                              <p className="font-medium text-[var(--text-main)] ">{doc.fileName}</p>
                              <p className="text-xs text-[var(--text-dim)] ">{doc.fileType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-[var(--text-dim)]" />
                            <div>
                              <p className="text-[var(--text-main)] ">{getUserName(doc)}</p>
                              <p className="text-xs text-[var(--text-dim)] ">{doc.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-[var(--text-muted)]  max-w-xs truncate" title={getQuestionContext(doc)}>
                            {getQuestionContext(doc)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-[var(--text-dim)] ">
                            {new Date(doc.createdAt).toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {doc.downloadUrl && (
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-2 text-[var(--accent)]  hover:bg-[rgba(46,134,255,0.15)]  rounded-lg transition-colors"
                              title="İndir"
                            >
                              <Download size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
