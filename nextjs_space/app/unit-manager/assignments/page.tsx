"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import { AlertCircle, ArrowLeft, Info, Loader2, Users } from "lucide-react";

/**
 * Bölüm bazlı görev dağılımı ekranı.
 *
 * Büyük bir kuruluşta anketi tek kişi dolduramaz: atık çevre biriminde,
 * enerji teknikte, sosyal başlıklar İK'dadır. Bu ekran hangi bölümün kimde
 * olduğunu belirler; katkıcı ankette yalnızca kendi bölümlerini görür.
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
  assigneeId: string | null;
};
type Category = {
  id: string;
  name: string;
  directQuestionCount: number;
  sections: Section[];
};

const memberLabel = (member: Member) => {
  const name = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
  return name || member.email;
};

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

  useEffect(() => {
    // Anket seçilirse yükleme göstergesini loadSections devralır; anket yoksa
    // burada kapatılır, aksi hâlde ekran sonsuza kadar dönerdi.
    const load = async () => {
      try {
        const res = await fetch("/api/survey/assigned");
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
      const res = await fetch(`/api/assessment/sections?surveyId=${surveyId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Görev dağılımı alınamadı");
        return;
      }
      setCategories(data.categories ?? []);
      setMembers(data.members ?? []);
      setIsCoordinator(Boolean(data.isCoordinator));
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

  const sections = categories.flatMap((category) => category.sections);
  const assignedCount = sections.filter((section) => section.assigneeId).length;
  const directQuestionCount = categories.reduce(
    (sum, category) => sum + category.directQuestionCount,
    0
  );

  /** Kişi başına yük — dağıtımın dengesi tek bakışta görünsün. */
  const workload = useMemo(() => {
    const byMember = new Map<string, { sections: number; questions: number }>();
    for (const section of sections) {
      if (!section.assigneeId) continue;
      const current = byMember.get(section.assigneeId) ?? { sections: 0, questions: 0 };
      current.sections += 1;
      current.questions += section.questionCount;
      byMember.set(section.assigneeId, current);
    }
    return members
      .map((member) => ({ member, ...(byMember.get(member.id) ?? { sections: 0, questions: 0 }) }))
      .filter((row) => row.sections > 0);
  }, [members, sections]);

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
            Anketin hangi bölümünü kimin dolduracağını belirleyin.
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
            {categories.map((category) => (
              <div
                key={category.id}
                className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[var(--border-soft)] flex items-center justify-between">
                  <h2 className="font-semibold text-[var(--text-main)]">{category.name}</h2>
                  <span className="text-xs text-[var(--text-dim)] tabular-nums">
                    {category.sections.filter((section) => section.assigneeId).length}/
                    {category.sections.length} atandı
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-soft)]">
                  {category.sections.map((section) => (
                    <div
                      key={section.id}
                      className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-[200px]">
                        <p className="text-[var(--text-main)]">{section.name}</p>
                        <p className="text-xs text-[var(--text-dim)] tabular-nums">
                          {section.questionCount} soru
                        </p>
                      </div>

                      <select
                        value={section.assigneeId ?? ""}
                        disabled={!isCoordinator || savingSection === section.id}
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
                  ))}

                  {category.directQuestionCount > 0 && (
                    // Bu sorular bir bölüme bağlı olmadığı için atanamaz.
                    <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[var(--bg-card-2)]">
                      <div>
                        <p className="text-[var(--text-muted)]">Kategori Soruları</p>
                        <p className="text-xs text-[var(--text-dim)] tabular-nums">
                          {category.directQuestionCount} soru — bölüme bağlı değil
                        </p>
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">Sizde kalır</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {workload.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-4">
                <h2 className="font-semibold text-[var(--text-main)] mb-3">Kişi başına yük</h2>
                <div className="space-y-2">
                  {workload.map((row) => (
                    <div
                      key={row.member.id}
                      className="flex items-center justify-between text-sm text-[var(--text-muted)]"
                    >
                      <span>{memberLabel(row.member)}</span>
                      <span className="tabular-nums text-[var(--text-dim)]">
                        {row.sections} bölüm · {row.questions} soru
                      </span>
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
          </div>
        )}
      </main>
    </div>
  );
}
