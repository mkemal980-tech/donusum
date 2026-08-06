"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SurveyQuestion from "@/components/survey/survey-question";

type Question = {
  id: string;
  text: string;
  type: string;
  options?: { value: string; label: string; score: number }[] | null;
  conditionalOptions?: {
    thresholdQuestion?: string;
    yesLabel?: string;
    noLabel?: string;
    options?: { value: string; label: string; score: number }[];
  } | null;
  requiresEvidence: boolean;
  order: number;
  weight: number;
  axisType: string;
};

type SubLevel = { id: string; name: string; questions: Question[] };

type SubCategory = {
  id: string;
  name: string;
  hasSubLevels: boolean;
  subLevels: SubLevel[];
  questions: Question[];
};

type Category = {
  id: string;
  name: string;
  description?: string | null;
  questions: Question[];
  subCategories: SubCategory[];
  survey?: { id: string; name: string } | null;
};

/** Soru grubu: başlığı ve altındaki sorular. */
type Section = {
  key: string;
  categoryId: string;
  categoryName: string;
  subCategoryName: string | null;
  subLevelName: string | null;
  questions: Question[];
};

const TYPE_LABELS: Record<string, string> = {
  SCALE: "Ölçek 1-5",
  YES_NO: "Evet / Hayır",
  MULTIPLE_CHOICE: "Çoktan seçmeli",
  CONDITIONAL_CHOICE: "Kademeli puanlama",
};

const AXIS_LABELS: Record<string, string> = {
  VELOCITY: "Hız",
  ENDURANCE: "Olgunluk",
};

function buildSections(categories: Category[]): Section[] {
  const sections: Section[] = [];

  for (const category of categories) {
    if (category.questions?.length) {
      sections.push({
        key: `${category.id}-direct`,
        categoryId: category.id,
        categoryName: category.name,
        subCategoryName: null,
        subLevelName: null,
        questions: [...category.questions].sort((a, b) => a.order - b.order),
      });
    }

    for (const subCategory of category.subCategories ?? []) {
      const hasSubLevels = subCategory.hasSubLevels && subCategory.subLevels?.length > 0;

      if (hasSubLevels) {
        for (const subLevel of subCategory.subLevels) {
          if (!subLevel.questions?.length) continue;
          sections.push({
            key: subLevel.id,
            categoryId: category.id,
            categoryName: category.name,
            subCategoryName: subCategory.name,
            subLevelName: subLevel.name,
            questions: [...subLevel.questions].sort((a, b) => a.order - b.order),
          });
        }
      } else if (subCategory.questions?.length) {
        sections.push({
          key: subCategory.id,
          categoryId: category.id,
          categoryName: category.name,
          subCategoryName: subCategory.name,
          subLevelName: null,
          questions: [...subCategory.questions].sort((a, b) => a.order - b.order),
        });
      }
    }
  }

  return sections;
}

/** Sorunun alabileceği en yüksek ham puan — yönetici detaylarında gösterilir. */
function maxScoreOf(question: Question): number {
  if (question.type === "SCALE") return 5;
  if (question.type === "YES_NO" || question.type === "MULTIPLE_CHOICE") {
    const scores = (question.options ?? []).map((option) => Number(option.score) || 0);
    return scores.length ? Math.max(...scores) : 0;
  }
  if (question.type === "CONDITIONAL_CHOICE") {
    const total = (question.conditionalOptions?.options ?? []).reduce(
      (sum, option) => sum + (Number(option.score) || 0),
      0
    );
    return Math.min(total, 5);
  }
  return 0;
}

export default function SurveyPreviewClient({ surveyId }: { surveyId: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [surveyName, setSurveyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showAdminDetails, setShowAdminDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [structureRes, surveysRes] = await Promise.all([
          fetch(`/api/survey/structure?surveyId=${surveyId}`),
          fetch("/api/admin/surveys"),
        ]);

        if (!structureRes.ok) throw new Error("Anket yapısı alınamadı");

        const structure: Category[] = await structureRes.json();
        const surveys = surveysRes.ok ? await surveysRes.json() : [];

        if (cancelled) return;

        setCategories(Array.isArray(structure) ? structure : []);
        const named = Array.isArray(surveys) ? surveys.find((s: { id: string }) => s.id === surveyId) : null;
        setSurveyName(named?.name || structure?.[0]?.survey?.name || "Anket");
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Bir hata oluştu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  const sections = useMemo(() => buildSections(categories), [categories]);
  const totalQuestions = sections.reduce((total, section) => total + section.questions.length, 0);
  const answeredCount = Object.keys(answers).length;

  // Soru numaraları anket boyunca kesintisiz akar — kullanıcının gördüğü sıra.
  const questionNumbers = useMemo(() => {
    const numbers = new Map<string, number>();
    let counter = 0;
    for (const section of sections) {
      for (const question of section.questions) {
        counter += 1;
        numbers.set(question.id, counter);
      }
    }
    return numbers;
  }, [sections]);

  const categoryAnchors = useMemo(
    () => categories.map((category) => ({ id: category.id, name: category.name })),
    [categories]
  );

  /**
   * Sorusu olmayan kategoriler kullanıcıya hiç görünmez; yönetici bunu
   * fark edemezse eksik kategoriyi yayına almış olur, o yüzden burada
   * ayrıca belirtilir.
   */
  const emptyCategories = useMemo(
    () => categories.filter((category) => !sections.some((section) => section.categoryId === category.id)),
    [categories, sections]
  );

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      {/* Önizleme şeridi — her zaman görünür kalır */}
      <div className="sticky top-0 z-40 bg-[var(--warning)]/15 border-b border-[var(--warning)]/40 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--warning)] text-black">ÖNİZLEME</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-main)] truncate">{surveyName}</p>
            <p className="text-xs text-[var(--text-dim)]">
              Kullanıcının gördüğü ekran. Verdiğiniz cevaplar kaydedilmez, kimsenin puanını etkilemez.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAdminDetails}
                onChange={(event) => setShowAdminDetails(event.target.checked)}
                className="accent-[var(--accent)]"
              />
              Yönetici detayları
            </label>
            <Link
              href={`/admin/categories?surveyId=${surveyId}`}
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:bg-[var(--bg-card-2)]"
            >
              Düzenlemeye dön
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-center text-[var(--text-dim)] py-16">Anket yükleniyor...</p>
        ) : error ? (
          <p className="text-center text-[var(--error)] py-16">{error}</p>
        ) : totalQuestions === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-muted)]">Bu ankette henüz soru yok.</p>
            <Link
              href={`/admin/categories?surveyId=${surveyId}`}
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-[var(--accent-dark)] text-white text-sm"
            >
              Soru ekle
            </Link>
          </div>
        ) : (
          <>
            {/* Özet ve kategori kısayolları */}
            <div className="mb-6 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
                <span className="text-[var(--text-muted)]">
                  <strong className="text-[var(--text-main)]">{totalQuestions}</strong> soru
                </span>
                <span className="text-[var(--text-muted)]">
                  <strong className="text-[var(--text-main)]">{categoryAnchors.length}</strong> kategori
                </span>
                <span className="text-[var(--text-muted)]">
                  <strong className="text-[var(--text-main)]">{sections.length}</strong> bölüm
                </span>
                {answeredCount > 0 && (
                  <span className="text-[var(--accent)]">
                    {answeredCount} soruyu denediniz (kaydedilmiyor)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {categoryAnchors.map((anchor) => (
                  <a
                    key={anchor.id}
                    href={`#kategori-${anchor.id}`}
                    className="px-3 py-1 rounded-full text-xs bg-[var(--bg-card-2)] text-[var(--text-muted)] border border-[var(--border-soft)] hover:border-[var(--accent)]"
                  >
                    {anchor.name}
                  </a>
                ))}
              </div>

              {emptyCategories.length > 0 && (
                <p className="mt-3 pt-3 border-t border-[var(--border-soft)] text-xs text-[var(--warning)]">
                  Soru içermediği için kullanıcıya <strong>hiç görünmeyecek</strong> kategoriler:{" "}
                  {emptyCategories.map((category) => category.name).join(", ")}
                </p>
              )}
            </div>

            {sections.map((section, sectionIndex) => {
              const isNewCategory =
                sectionIndex === 0 || sections[sectionIndex - 1].categoryId !== section.categoryId;

              return (
                <section key={section.key} className="mb-10">
                  {isNewCategory && (
                    <h2
                      id={`kategori-${section.categoryId}`}
                      className="scroll-mt-24 text-2xl font-bold text-[var(--text-main)] mb-4 pb-2 border-b-2 border-[var(--accent)]"
                    >
                      {section.categoryName}
                    </h2>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-[var(--accent)]">
                      {section.subCategoryName ?? "Doğrudan Sorular"}
                    </h3>
                    {section.subLevelName && (
                      <p className="text-sm text-[var(--text-muted)]">{section.subLevelName}</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {section.questions.map((question) => (
                      <div key={question.id}>
                        <div className="flex items-center gap-2 mb-1.5 text-xs text-[var(--text-dim)]">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-card-2)]">
                            Soru {questionNumbers.get(question.id)} / {totalQuestions}
                          </span>
                        </div>

                        <SurveyQuestion
                          question={question}
                          value={answers[question.id]}
                          onAnswer={handleAnswer}
                          previewMode
                        />

                        {showAdminDetails && (
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card-2)] text-[var(--text-muted)]">
                              {TYPE_LABELS[question.type] ?? question.type}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card-2)] text-[var(--text-muted)]">
                              Ağırlık {question.weight}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card-2)] text-[var(--text-muted)]">
                              {AXIS_LABELS[question.axisType] ?? question.axisType}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-card-2)] text-[var(--text-muted)]">
                              En yüksek puan {maxScoreOf(question)}
                            </span>
                            {question.requiresEvidence && (
                              <span className="px-2 py-0.5 rounded bg-[#a78bfa]/20 text-[#a78bfa]">
                                Kanıt zorunlu
                              </span>
                            )}
                            {question.type === "MULTIPLE_CHOICE" && (question.options?.length ?? 0) > 0 && (
                              <span className="px-2 py-0.5 rounded bg-[var(--bg-card-2)] text-[var(--text-muted)]">
                                Şık puanları:{" "}
                                {question.options!.map((option) => `${option.label} (${option.score})`).join(", ")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            <div className="py-8 text-center text-sm text-[var(--text-dim)] border-t border-[var(--border-soft)]">
              Anketin sonu. Gerçek kullanıcı burada anketi tamamlar; önizlemede kayıt yapılmaz.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
