"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import {
  AlertCircle,
  ArrowLeft,
  Info,
  Loader2,
  Lock,
  Mail,
  Send,
  Unlock,
  Users,
} from "lucide-react";
import { type SectionStatus, rollupByAssignee, sectionStatus } from "@/lib/section-assignment";
import { readinessSummary, submissionReadiness } from "@/lib/submission";
import { getWithRetry } from "@/lib/retrying-fetch";

/**
 * Görev dağılımı ve ilerleme panosu.
 *
 * Büyük bir kuruluşta anketi tek kişi dolduramaz: atık çevre biriminde,
 * enerji teknikte, sosyal başlıklar İK'dadır. Bu ekran hangi bölümün kimde
 * olduğunu belirler; katkıcı ankette yalnızca kendi bölümlerini görür.
 *
 * Dağıtımdan sonra koordinatörün tek sorusu kalıyor — "kimi arayayım" — bu
 * yüzden pano ayrı bir ekran değil, dağıtım tablosunun üzerine binen bir
 * sütun: sorumlu ve ilerleme yan yana durmadıkça soru cevaplanmıyor.
 *
 * Dağıtım isteğe bağlıdır — hiç atama yapılmazsa anket bugünkü gibi herkese
 * açık kalır. Bu yüzden ekran "önce dağıtım yap" diye dayatmaz.
 */

type Survey = { id: string; name: string };
type Member = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};
type Section = {
  id: string;
  name: string;
  questionCount: number;
  answeredCount: number;
  lastAnsweredAt: string | null;
  assigneeId: string | null;
};
type Category = {
  id: string;
  name: string;
  directQuestionCount: number;
  directAnsweredCount: number;
  sections: Section[];
};

const memberLabel = (member: Member) => {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
  return name || member.email;
};

const STATUS_LABEL: Record<SectionStatus, string> = {
  EMPTY: "Başlanmadı",
  IN_PROGRESS: "Devam ediyor",
  DONE: "Bitti",
};

const STATUS_STYLE: Record<SectionStatus, string> = {
  EMPTY: "bg-[var(--bg-card-2)] text-[var(--text-dim)] border-[var(--border-soft)]",
  IN_PROGRESS: "bg-[var(--warning-bg)] text-[var(--warning)] border-[var(--warning)]/30",
  DONE: "bg-[rgba(12,193,195,0.15)] text-[var(--accent)] border-[var(--accent)]/50",
};

/** İnce ilerleme çubuğu — satır yüksekliğini büyütmeden doluluk göstersin. */
function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-[var(--border-soft)] overflow-hidden">
      <span
        className="block h-full bg-[var(--accent)] transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </span>
  );
}

export default function SectionAssignmentsPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyId, setSurveyId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isCoordinator, setIsCoordinator] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  /** Gönderim iki adımlı: düğme önce neyin eksik olduğunu gösterir. */
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    // Anket seçilirse yükleme göstergesini loadSections devralır; anket yoksa
    // burada kapatılır, aksi hâlde ekran sonsuza kadar dönerdi.
    const load = async () => {
      try {
        const res = await getWithRetry("/api/survey/assigned");
        if (!res.ok) {
          setError("Anket listesi alınamadı. Sayfayı yenilemeyi deneyin.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setSurveys(list);
        if (list.length === 0) {
          setLoading(false);
          return;
        }
        setSurveyId((current) => current || list[0].id);
      } catch (loadError) {
        console.error("Error loading surveys:", loadError);
        setError("Anket listesi alınırken hata oluştu.");
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadSections = useCallback(async () => {
    if (!surveyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getWithRetry(`/api/assessment/sections?surveyId=${surveyId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Görev dağılımı alınamadı");
        return;
      }
      setCategories(data.categories ?? []);
      setMembers(data.members ?? []);
      setIsCoordinator(Boolean(data.isCoordinator));
      setLocked(Boolean(data.locked));
      setSubmittedAt(data.submittedAt ?? null);
      setConfirmingSubmit(false);
    } catch (loadError) {
      console.error("Error loading section assignments:", loadError);
      setError("Görev dağılımı alınırken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSections();
  }, [loadSections]);

  const assign = async (sectionId: string, assigneeId: string | null) => {
    const previous = categories;
    // İyimser güncelleme: seçim anında görünsün, hata olursa geri alınsın.
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        sections: category.sections.map((section) =>
          section.id === sectionId ? { ...section, assigneeId } : section
        ),
      }))
    );
    setSavingSection(sectionId);

    try {
      const res = await fetch("/api/assessment/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, subCategoryId: sectionId, assigneeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCategories(previous);
        toast.error(data?.error || "Görev ataması kaydedilemedi");
        return;
      }
      toast.success(assigneeId ? "Bölüm atandı" : "Atama kaldırıldı", { duration: 1500 });
    } catch (saveError) {
      console.error("Error saving assignment:", saveError);
      setCategories(previous);
      toast.error("Görev ataması kaydedilirken hata oluştu");
    } finally {
      setSavingSection(null);
    }
  };

  const sections = useMemo(
    () => categories.flatMap((category) => category.sections),
    [categories]
  );
  const assignedCount = sections.filter((section) => section.assigneeId).length;
  const directQuestionCount = categories.reduce(
    (sum, category) => sum + category.directQuestionCount,
    0
  );

  /** Anketin tamamı — bölümler ve bölüme bağlı olmayan sorular birlikte. */
  const overall = useMemo(() => {
    const total =
      sections.reduce((sum, section) => sum + section.questionCount, 0) +
      categories.reduce((sum, category) => sum + category.directQuestionCount, 0);
    const answered =
      sections.reduce((sum, section) => sum + section.answeredCount, 0) +
      categories.reduce((sum, category) => sum + category.directAnsweredCount, 0);

    return {
      total,
      answered,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0,
    };
  }, [categories, sections]);

  /**
   * Kim ne kadar doldurdu. Atanmamış bölümler tek satırda toplanır —
   * koordinatörün üzerinde kalan yük en çok orada birikiyor.
   */
  const workload = useMemo(() => {
    const memberById = new Map(members.map((member) => [member.id, member]));

    return rollupByAssignee(sections)
      .map((row) => ({
        ...row,
        label: row.assigneeId
          ? memberLabel(
              memberById.get(row.assigneeId) ?? {
                id: row.assigneeId,
                email: "Ayrılmış kullanıcı",
                firstName: null,
                lastName: null,
              }
            )
          : "Atanmamış (sizde)",
      }))
      .sort((a, b) => {
        // Atanmamış satır en sonda; gerisi en az dolandan başlayarak —
        // koordinatörün ilk bakacağı yer geride kalanlar.
        if (a.assigneeId === null) return 1;
        if (b.assigneeId === null) return -1;
        return a.percentage - b.percentage;
      });
  }, [members, sections]);

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("tr-TR") : null;

  /**
   * Gönderime hazırlık. Bölüme bağlı olmayan sorular da sayıya girer; onlar
   * cevaplanmadan da değerlendirme tam sayılmaz.
   */
  const readiness = useMemo(
    () =>
      submissionReadiness([
        ...sections.map((section) => ({
          name: section.name,
          questionCount: section.questionCount,
          answeredCount: section.answeredCount,
        })),
        ...categories
          .filter((category) => category.directQuestionCount > 0)
          .map((category) => ({
            name: `${category.name} (kategori soruları)`,
            questionCount: category.directQuestionCount,
            answeredCount: category.directAnsweredCount,
          })),
      ]),
    [categories, sections]
  );

  /**
   * Hatırlatma. Alıcı listesi "eksiği kalanlar" olduğu için aynı düğme hem
   * ilk duyuru hem sonraki hatırlatmalar için çalışıyor; işini bitiren kimse
   * ikinci kez rahatsız edilmiyor.
   */
  const notifyContributors = async () => {
    setNotifying(true);
    try {
      const res = await fetch("/api/assessment/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Hatırlatma gönderilemedi");
        return;
      }
      toast.success(data?.message || "Hatırlatma gönderildi");
    } catch (notifyError) {
      console.error("Error notifying contributors:", notifyError);
      toast.error("Hatırlatma gönderilirken hata oluştu");
    } finally {
      setNotifying(false);
    }
  };

  const submitAssessment = async (action: "submit" | "reopen") => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/assessment/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "İşlem tamamlanamadı");
        return;
      }
      toast.success(action === "submit" ? "Değerlendirme gönderildi" : "Gönderim geri alındı");
      await loadSections();
    } catch (submitError) {
      console.error("Error submitting assessment:", submitError);
      toast.error("İşlem sırasında hata oluştu");
    } finally {
      setSubmitting(false);
      setConfirmingSubmit(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 py-8">
        <button
          onClick={() => router.push("/unit-manager")}
          className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-main)] mb-4"
        >
          <ArrowLeft size={16} />
          Birim Yönetimi
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-1">Görev Dağılımı</h1>
          <p className="text-[var(--text-muted)]">
            Anketin hangi bölümünü kimin dolduracağını belirleyin, nerede kalındığını takip edin.
          </p>
        </div>

        <div className="mb-4 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-soft)] flex items-start gap-2">
          <Info size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--text-muted)]">
            <p>
              Bir bölüm <strong>tek kişiye</strong> atanır. Atanan kişi ankette yalnızca kendi
              bölümlerini görür; puan yine kuruluşun tamamı için tek bir puan olarak hesaplanır.
            </p>
            <p className="mt-1">
              Atanmamış bölümler <strong>sizde</strong> kalır. Hiç atama yapmazsanız anket ekibin
              tamamına açık kalmayı sürdürür.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={surveyId}
            onChange={(event) => setSurveyId(event.target.value)}
            className="px-4 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card)] text-[var(--text-main)]"
          >
            {surveys.length === 0 && <option value="">Anket yok</option>}
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.name}
              </option>
            ))}
          </select>

          {sections.length > 0 && (
            <span className="text-sm text-[var(--text-muted)] tabular-nums">
              {sections.length} bölümün {assignedCount} tanesi atandı
            </span>
          )}

          {savingSection && (
            <span className="flex items-center gap-1.5 text-sm text-[var(--text-dim)]">
              <Loader2 size={14} className="animate-spin" />
              Kaydediliyor
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--error-bg,rgba(239,68,68,0.1))] border border-[var(--error)]/30 flex items-center gap-2 text-sm text-[var(--error)]">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Kilit bandı en üstte: ekranın geri kalanı neden donuk, önce o
            anlaşılsın. */}
        {!loading && locked && (
          <div className="mb-4 p-4 rounded-lg bg-[rgba(12,193,195,0.1)] border border-[var(--accent)]/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lock size={18} className="text-[var(--accent)] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-[var(--text-main)] font-medium">
                  Değerlendirme gönderildi
                  {formatDate(submittedAt) ? ` · ${formatDate(submittedAt)}` : ""}
                </p>
                <p className="text-[var(--text-muted)]">
                  Cevaplar ve görev dağılımı kilitli, puan kesinleşti. Düzeltme gerekiyorsa
                  gönderimi geri alın.
                </p>
              </div>
            </div>
            {isCoordinator && (
              <button
                onClick={() => submitAssessment("reopen")}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] text-sm text-[var(--text-main)] hover:border-[var(--accent)]/50 disabled:opacity-60 flex items-center gap-2"
              >
                <Unlock size={16} />
                Gönderimi geri al
              </button>
            )}
          </div>
        )}

        {!loading && !isCoordinator && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]/30 text-sm text-[var(--warning)]">
            Görev dağıtma yetkiniz yok; bu tablo yalnızca bilgi amaçlıdır. Değişiklik için birim
            yöneticinizle görüşün.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sections.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-8 text-center">
            <Users size={48} className="mx-auto text-[var(--ui-passive)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--text-muted)] mb-2">
              Dağıtılacak bölüm yok
            </h2>
            <p className="text-[var(--text-dim)] text-sm">
              Bu ankette sektörünüze sorulan bir bölüm bulunmuyor.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Kuruluşun bu anketteki durumu — panonun tek satırlık özeti. */}
            <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-[var(--text-main)]">Anketin durumu</h2>
                <span className="text-sm text-[var(--text-muted)] tabular-nums">
                  {overall.answered}/{overall.total} soru · %{overall.percentage}
                </span>
              </div>
              <ProgressBar percentage={overall.percentage} />
            </div>

            {categories.map((category) => {
              const categoryTotal =
                category.sections.reduce((sum, section) => sum + section.questionCount, 0) +
                category.directQuestionCount;
              const categoryAnswered =
                category.sections.reduce((sum, section) => sum + section.answeredCount, 0) +
                category.directAnsweredCount;

              return (
              <div
                key={category.id}
                className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[var(--border-soft)] flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-[var(--text-main)]">{category.name}</h2>
                  <span className="text-xs text-[var(--text-dim)] tabular-nums">
                    {category.sections.filter((section) => section.assigneeId).length}/
                    {category.sections.length} atandı · {categoryAnswered}/{categoryTotal} soru
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-soft)]">
                  {category.sections.map((section) => {
                    const status = sectionStatus(section);
                    const percentage =
                      section.questionCount > 0
                        ? Math.round((section.answeredCount / section.questionCount) * 100)
                        : 100;
                    const lastDate = formatDate(section.lastAnsweredAt);

                    return (
                    <div
                      key={section.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-[220px] flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[var(--text-main)]">{section.name}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full border text-[11px] ${STATUS_STYLE[status]}`}
                          >
                            {STATUS_LABEL[status]}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-dim)] tabular-nums mt-0.5">
                          {section.answeredCount}/{section.questionCount} soru
                          {lastDate ? ` · son giriş ${lastDate}` : ""}
                        </p>
                        <span className="block mt-1.5 max-w-[280px]">
                          <ProgressBar percentage={percentage} />
                        </span>
                      </div>

                      <select
                        value={section.assigneeId ?? ""}
                        disabled={!isCoordinator || locked || savingSection === section.id}
                        onChange={(event) => assign(section.id, event.target.value || null)}
                        className={`px-3 py-2 rounded-lg border bg-[var(--bg-card-2)] text-sm disabled:opacity-60 ${
                          section.assigneeId
                            ? "border-[var(--accent)]/50 text-[var(--text-main)]"
                            : "border-[var(--border-soft)] text-[var(--text-dim)]"
                        }`}
                      >
                        <option value="">Atanmadı (sizde)</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {memberLabel(member)}
                          </option>
                        ))}
                      </select>
                    </div>
                    );
                  })}

                  {category.directQuestionCount > 0 && (
                    // Bu sorular bir bölüme bağlı olmadığı için atanamaz.
                    <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[var(--bg-card-2)]">
                      <div>
                        <p className="text-[var(--text-muted)]">Kategori Soruları</p>
                        <p className="text-xs text-[var(--text-dim)] tabular-nums">
                          {category.directAnsweredCount}/{category.directQuestionCount} soru —
                          bölüme bağlı değil
                        </p>
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">Sizde kalır</span>
                    </div>
                  )}
                </div>
              </div>
              );
            })}

            {workload.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h2 className="font-semibold text-[var(--text-main)] mb-1">
                      Kim ne kadar doldurdu
                    </h2>
                    <p className="text-xs text-[var(--text-dim)]">
                      En geride kalan üstte; kimi arayacağınız listenin başında.
                    </p>
                  </div>

                  {/* Aramak yerine tek hamlede hatırlatmak. Yalnızca eksiği
                      kalanlara gider; bitirenler ikinci kez rahatsız edilmez. */}
                  {isCoordinator && !locked && (
                    <button
                      onClick={notifyContributors}
                      disabled={notifying}
                      className="px-3 py-2 rounded-lg border border-[var(--border-soft)] text-sm text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text-main)] disabled:opacity-60 flex items-center gap-2"
                    >
                      {notifying ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Mail size={15} />
                      )}
                      Eksiği kalanlara hatırlat
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {workload.map((row) => (
                    <div key={row.assigneeId ?? "atanmamis"}>
                      <div className="flex items-center justify-between text-sm mb-1 gap-3">
                        <span
                          className={
                            row.assigneeId
                              ? "text-[var(--text-main)]"
                              : "text-[var(--text-muted)] italic"
                          }
                        >
                          {row.label}
                        </span>
                        <span className="tabular-nums text-[var(--text-dim)] text-xs shrink-0">
                          {row.doneSections}/{row.sections} bölüm bitti ·{" "}
                          {row.answeredCount}/{row.questionCount} soru · %{row.percentage}
                        </span>
                      </div>
                      <ProgressBar percentage={row.percentage} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {directQuestionCount > 0 && (
              <p className="text-xs text-[var(--text-dim)]">
                Bölüme bağlı olmayan {directQuestionCount} soru dağıtılamaz; bunları koordinatör
                olarak siz doldurursunuz.
              </p>
            )}

            {/* Gönderim: akışın sonu, o yüzden ekranın da sonunda. */}
            {isCoordinator && !locked && (
              <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-4">
                <h2 className="font-semibold text-[var(--text-main)] mb-1">
                  Değerlendirmeyi gönder
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {readinessSummary(readiness)} Gönderdiğinizde cevaplar kilitlenir ve puan
                  taslak olmaktan çıkar.
                </p>

                {confirmingSubmit && !readiness.complete && (
                  <div className="mb-3 p-3 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]/30 text-sm">
                    <p className="text-[var(--warning)] font-medium mb-2">
                      Boş sorularla gönderiyorsunuz:
                    </p>
                    <ul className="space-y-1 text-[var(--text-muted)]">
                      {readiness.incompleteSections.slice(0, 8).map((section) => (
                        <li key={section.name} className="flex justify-between gap-3">
                          <span>{section.name}</span>
                          <span className="tabular-nums text-[var(--text-dim)]">
                            {section.missing} soru boş
                          </span>
                        </li>
                      ))}
                      {readiness.incompleteSections.length > 8 && (
                        <li className="text-[var(--text-dim)]">
                          ve {readiness.incompleteSections.length - 8} bölüm daha
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      confirmingSubmit || readiness.complete
                        ? submitAssessment("submit")
                        : setConfirmingSubmit(true)
                    }
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-60 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {confirmingSubmit && !readiness.complete
                      ? "Yine de gönder"
                      : "Değerlendirmeyi gönder"}
                  </button>

                  {confirmingSubmit && (
                    <button
                      onClick={() => setConfirmingSubmit(false)}
                      className="px-4 py-2.5 rounded-lg border border-[var(--border-soft)] text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    >
                      Vazgeç
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
