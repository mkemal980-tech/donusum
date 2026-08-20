"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AppShell from "@/components/ui/app-shell";
import PageHeader from "@/components/ui/page-header";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
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
import { Button } from "@/components/ui/button";

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

/* Puan renkle değil sayıyla okunur; tabloda renk yalnızca durum sütununda. */
const getMaturityLabel = (score: number) => {
  if (score >= 4.5) return { label: "Lider" };
  if (score >= 3.5) return { label: "Olgun" };
  if (score >= 2.5) return { label: "Gelişen" };
  if (score >= 1.5) return { label: "Farkındalık" };
  return { label: "Başlangıç" };
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

  const getUserName = (doc: Document) => {
    return [doc.user.firstName, doc.user.lastName].filter(Boolean).join(" ") || doc.user.email;
  };

  if (loading || status === "loading") {
    return (
      <>
        <AppShell />
        <main>
          <div className="skeleton mb-6 h-8 w-72" />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
          <div className="skeleton h-[320px]" />
        </main>
      </>
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
    <>
      <AppShell />

      <main>
        <PageHeader
          title="Birim takibi"
          subtitle="Birimlerinizdeki değerlendirmelerin ilerleyişi ve sonuçları."
          actions={
            /* Anketin hangi bölümünü kimin dolduracağı buradan belirlenir. */
            <Button onClick={() => router.push("/unit-manager/assignments")}>
              <ListChecks size={16} aria-hidden="true" />
              Görev dağılımı
            </Button>
          }
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Birim" value={units.length} />
          <StatCard label="Değerlendirme" value={totalAssessments} />
          <StatCard
            label="Başlanan"
            value={`${startedAssessments.length} / ${totalAssessments}`}
            note={totalAssessments > 0 ? "cevap girilmiş değerlendirme" : "henüz değerlendirme yok"}
          />
          <StatCard
            label="Ortalama puan"
            value={`${Math.round(avgScore)}%`}
            note="başlanmış değerlendirmelerin ortalaması"
          />
        </div>

        {/* Tabs */}
        <div className="theme-tabs mb-6" role="tablist" aria-label="Görünüm">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "team"}
            onClick={() => setActiveTab("team")}
            className={`theme-tab ${activeTab === "team" ? "active" : ""}`}
          >
            Değerlendirmeler
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "documents"}
            onClick={() => setActiveTab("documents")}
            className={`theme-tab ${activeTab === "documents" ? "active" : ""}`}
          >
            Yüklenen dosyalar
            {documents.length > 0 && (
              <span className="ml-1.5 tabular" style={{ color: "var(--ink-3)" }}>
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
              <div
                key={unit.id}
                className="overflow-hidden rounded-[var(--radius-lg)]"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                {/* Birim başlığı — tıklanınca değerlendirme tablosunu açar. */}
                <button
                  type="button"
                  className="w-full p-5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                  onClick={() => toggleUnit(unit.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown size={16} style={{ color: "var(--ink-3)" }} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={16} style={{ color: "var(--ink-3)" }} aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                          {unit.name}
                        </h3>
                        {unit.description && (
                          <p className="truncate t-sm" style={{ color: "var(--ink-3)" }}>
                            {unit.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <dl className="flex items-baseline gap-6 t-sm">
                      <div className="text-right">
                        <dt style={{ color: "var(--ink-3)" }}>Değerlendirme</dt>
                        <dd className="tabular font-medium" style={{ color: "var(--ink)" }}>
                          {unit.assessmentCount}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt style={{ color: "var(--ink-3)" }}>Başlanan</dt>
                        <dd className="tabular font-medium" style={{ color: "var(--ink)" }}>
                          {unit.startedCount}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt style={{ color: "var(--ink-3)" }}>Ort. puan</dt>
                        <dd className="tabular font-medium" style={{ color: "var(--ink)" }}>
                          %{unit.averageScore}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </button>

                {/* Team Members */}
                {isExpanded && unitAssessments.length > 0 && (
                  <div className="overflow-x-auto" style={{ borderTop: "1px solid var(--line)" }}>
                    <table className="theme-table">
                      <thead>
                        <tr>
                          <th>Değerlendirme</th>
                          <th>Katkı veren</th>
                          <th>Durum</th>
                          <th className="text-right">Puan</th>
                          <th className="text-right">Olgunluk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unitAssessments.map((row) => {
                          const maturity = getMaturityLabel(row.maturityScore);
                          return (
                            <tr key={row.id}>
                              <td>
                                <div>
                                  <p className="font-medium" style={{ color: "var(--ink)" }}>
                                    {row.surveyName}
                                  </p>
                                  <p className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
                                    {row.responseCount} cevap
                                    {row.lastActivityAt
                                      ? ` · son giriş ${new Date(
                                          row.lastActivityAt
                                        ).toLocaleDateString("tr-TR")}`
                                      : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="tabular">
                                {row.contributorCount > 0 ? `${row.contributorCount} kişi` : "—"}
                              </td>
                              <td>
                                {row.responseCount > 0 ? (
                                  <span className="badge badge-success">Başlandı</span>
                                ) : (
                                  <span className="badge badge-neutral">Bekliyor</span>
                                )}
                              </td>
                              <td className="text-right tabular font-medium" style={{ color: "var(--ink)" }}>
                                %{row.score}
                              </td>
                              <td className="text-right">
                                <span className="t-sm tabular" style={{ color: "var(--ink-2)" }}>
                                  {row.maturityScore > 0 ? (
                                    <>
                                      {row.maturityScore.toFixed(1)} · {maturity.label}
                                    </>
                                  ) : (
                                    "—"
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
                  <p
                    className="p-5 t-sm"
                    style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}
                  >
                    Bu birimde henüz değerlendirme başlatılmadı.
                  </p>
                )}
              </div>
            );
          })}

          {units.length === 0 && (
            <EmptyState
              title="Yönettiğiniz birim yok"
              description="Bir birime yönetici olarak atandığınızda o birimin değerlendirmeleri burada listelenir."
            />
          )}
        </div>
        ) : (
          /* Documents Tab */
          <div className="space-y-4">
            {loadingDocs ? (
              <div className="skeleton h-64" />
            ) : documents.length === 0 ? (
              <EmptyState
                title="Yüklenmiş dosya yok"
                description="Ekip üyeleri ankette belge yüklediğinde dosyalar burada listelenir."
              />
            ) : (
              <div
                className="overflow-x-auto rounded-[var(--radius-lg)]"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                <table className="theme-table">
                  <thead>
                    <tr>
                      <th>Dosya</th>
                      <th>Kullanıcı</th>
                      <th>Soru bağlamı</th>
                      <th>Tarih</th>
                      <th className="text-right">İndir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>
                          <p className="font-medium" style={{ color: "var(--ink)" }}>
                            {doc.fileName}
                          </p>
                          <p className="t-sm" style={{ color: "var(--ink-3)" }}>
                            {doc.fileType}
                          </p>
                        </td>
                        <td>
                          <p style={{ color: "var(--ink)" }}>{getUserName(doc)}</p>
                          <p className="t-sm" style={{ color: "var(--ink-3)" }}>
                            {doc.user.email}
                          </p>
                        </td>
                        <td>
                          <p className="max-w-xs truncate" title={getQuestionContext(doc)}>
                            {getQuestionContext(doc)}
                          </p>
                        </td>
                        <td className="tabular">
                          {new Date(doc.createdAt).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td className="text-right">
                          {doc.downloadUrl && (
                            <Button
                              onClick={() => handleDownload(doc)}
                              aria-label={`${doc.fileName} dosyasını indir`}
                              variant="ghost"
                              size="icon"
                            >
                              <Download size={16} aria-hidden="true" />
                            </Button>
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
    </>
  );
}
