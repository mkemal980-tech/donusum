"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  categoryProgress,
  stepProgress,
  type OutlineCategory,
  type OutlineQuestion,
  type SurveyStep,
} from "@/lib/survey-navigation";

/**
 * Anket haritası — "neredeyim ve daha ne kadar var" sorusunun tek cevabı.
 *
 * Uzun ankette (13 bölüm, 71 soru) kullanıcı bulunduğu yeri yalnızca kırıntı
 * yolundan çıkarabiliyor ve bir bölümden diğerine ancak sırayla geçebiliyordu.
 * Harita konumu gösterir ve her satırı doğrudan gezilebilir kılar.
 *
 * Gerçek anket ekranı ile yönetici önizlemesi aynı bileşeni kullanır; ikisi
 * ayrı yazıldığında önizleme kullanıcının gördüğünden farklı davranıyordu.
 *
 * Harita kendi ağacını kurmaz: `buildOutline` adım dizisini gruplar, yani
 * buradaki her satırın karşılığı bir adım indeksidir. Tıklama tek bir adım
 * değişimine iner ve haritayla ekranın ayrışması mümkün olmaz.
 */

type Props = {
  outline: OutlineCategory[];
  steps: SurveyStep[];
  responses: Record<string, string>;
  /** Bulunulan adım — bölüm vurgusu buradan gelir. */
  currentStepIndex: number;
  /** Kaydırmayla belirlenen soru; verilmezse yalnızca bölüm vurgulanır. */
  activeQuestionId?: string | null;
  onSelectStep: (stepIndex: number) => void;
  /** Verilmezse soru satırı da adıma atlar. */
  onSelectQuestion?: (stepIndex: number, questionId: string) => void;
  /** Başlığın altına düşen açıklama (örn. "Size atanan 3 bölüm"). */
  note?: string;
};

function isAnswered(responses: Record<string, string>, questionId: string): boolean {
  const value = responses[questionId];
  return value !== undefined && value !== null && value !== "";
}

export default function SurveyOutline({
  outline,
  steps,
  responses,
  currentStepIndex,
  activeQuestionId = null,
  onSelectStep,
  onSelectQuestion,
  note,
}: Props) {
  const currentStep = steps[currentStepIndex];

  /**
   * Hangi kategorinin açık geleceği.
   *
   * Adım bilgisi olmayan bir kullanım da var: önizlemenin gözden geçirme
   * modunda anketin tamamı tek sayfada ve "bulunulan adım" diye bir şey yok.
   * Orada konum yalnızca kaydırmadan geliyor, o yüzden aktif soru da kabul
   * edilir. İkisi de yoksa ilk kategori açılır — harita tamamen kapalı
   * açılırsa çözdüğü sorunu yeniden yaratır.
   */
  const currentCategoryId = useMemo(() => {
    if (currentStep) return currentStep.categoryId;

    if (activeQuestionId) {
      const found = outline.find((category) =>
        category.subCategories.some((subCategory) =>
          subCategory.sections.some((section) =>
            section.questions.some((question) => question.id === activeQuestionId),
          ),
        ),
      );
      if (found) return found.categoryId;
    }

    return outline[0]?.categoryId ?? null;
  }, [currentStep, activeQuestionId, outline]);

  /**
   * Varsayılan olarak yalnızca bulunulan kategori açık.
   *
   * 13 bölümün tamamı açık gelirse harita kendi başına bir duvar olur ve
   * çözdüğü sorunu yeniden yaratır. Kullanıcının açtığı kategoriler açık
   * kalır — gezinirken sürekli kapanan bir ağaç en can sıkıcı davranış.
   */
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!currentCategoryId) return;
    setExpanded((current) =>
      current.includes(currentCategoryId) ? current : [...current, currentCategoryId],
    );
  }, [currentCategoryId]);

  /* Aktif satır haritanın görünmeyen kısmına kayabilir; `nearest` yalnızca
     gerçekten dışarıda kaldığında kaydırır, kullanıcının kendi gezinmesini
     bozmaz. */
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeQuestionId, currentStepIndex]);

  const totals = useMemo(() => {
    const ids = steps.flatMap((step) => step.questionIds);
    return {
      total: ids.length,
      answered: ids.filter((id) => isAnswered(responses, id)).length,
    };
  }, [steps, responses]);

  if (outline.length === 0) return null;

  const selectQuestion = (question: OutlineQuestion) => {
    if (onSelectQuestion) onSelectQuestion(question.stepIndex, question.id);
    else onSelectStep(question.stepIndex);
  };

  const questionRow = (question: OutlineQuestion) => {
    const answered = isAnswered(responses, question.id);
    const isActive = activeQuestionId === question.id;

    return (
      <li key={question.id}>
        <button
          ref={isActive ? activeRef : undefined}
          type="button"
          onClick={() => selectQuestion(question)}
          aria-current={isActive ? "true" : undefined}
          className="flex w-full items-start gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
          style={isActive ? { background: "var(--accent-quiet)" } : undefined}
        >
          {/* Dolu nokta cevaplandı, boş halka cevaplanmadı demek. Renk tek
              başına taşımasın diye biçim de değişiyor (WCAG 1.4.1). */}
          <span
            aria-hidden="true"
            className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
            style={{
              background: answered ? "var(--series-2)" : "transparent",
              border: answered ? "none" : "1.5px solid var(--ink-3)",
            }}
          />
          <span className="min-w-0 flex-1">
            <span
              className="block t-sm tabular"
              style={{ color: isActive ? "var(--ink)" : "var(--ink-3)" }}
            >
              Soru {question.number}
              <span className="sr-only">{answered ? " — cevaplandı" : " — cevaplanmadı"}</span>
            </span>
            <span
              className="mt-0.5 block line-clamp-2 t-sm"
              style={{
                color: isActive ? "var(--ink)" : "var(--ink-2)",
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {question.text}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label="Anket haritası"
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)]"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <div className="shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="t-sm font-medium" style={{ color: "var(--ink)" }}>
            Anket haritası
          </h2>
          <span className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
            {totals.answered}/{totals.total}
          </span>
        </div>
        {note && (
          <p className="mt-1 t-sm" style={{ color: "var(--ink-3)" }}>
            {note}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          {outline.map((category) => {
            const progress = categoryProgress(steps, category.categoryId, responses);
            const isOpen = expanded.includes(category.categoryId);
            const isCurrent = category.categoryId === currentCategoryId;
            const isDone = progress.percentage === 100;

            return (
              <li key={category.categoryId}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(category.categoryId)
                        ? current.filter((id) => id !== category.categoryId)
                        : [...current, category.categoryId],
                    )
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-xs)] px-2 py-2 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                >
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 transition-transform duration-fast ease-out-quart"
                    style={{
                      color: "var(--ink-3)",
                      transform: isOpen ? "rotate(90deg)" : undefined,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className="min-w-0 flex-1 truncate t-sm"
                        style={{
                          color: isCurrent ? "var(--ink)" : "var(--ink-2)",
                          fontWeight: isCurrent ? 600 : 500,
                        }}
                      >
                        {category.categoryName}
                      </span>
                      <span className="shrink-0 t-sm tabular" style={{ color: "var(--ink-3)" }}>
                        {progress.answered}/{progress.total}
                      </span>
                    </span>
                    <span className="progress-bar mt-1.5 block" style={{ height: 3 }}>
                      <span
                        className="progress-bar-fill block"
                        style={{
                          width: `${progress.percentage}%`,
                          background: isDone ? "var(--series-2)" : "var(--accent)",
                        }}
                      />
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <ul className="ml-3 flex flex-col gap-0.5 pl-2" style={{ borderLeft: "1px solid var(--line)" }}>
                    {category.subCategories.map((subCategory) => {
                      /* Alt seviyesiz bölümde alt kategori satırının kendisi
                         gezilebilir hedeftir; ara bir satır daha çizmek adı
                         iki kez yazdırırdı. */
                      const flat =
                        subCategory.sections.length === 1 && subCategory.sections[0].name === null;
                      const subAnswered = subCategory.sections
                        .flatMap((section) => section.questions)
                        .filter((question) => isAnswered(responses, question.id)).length;
                      const isCurrentSub = subCategory.sections.some(
                        (section) => section.stepIndex === currentStepIndex,
                      );

                      return (
                        <li key={subCategory.key}>
                          <button
                            type="button"
                            onClick={() => onSelectStep(subCategory.firstStepIndex)}
                            aria-current={isCurrentSub && flat ? "step" : undefined}
                            className="flex w-full items-baseline gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                            style={
                              isCurrentSub && flat ? { background: "var(--surface-2)" } : undefined
                            }
                          >
                            <span
                              className="min-w-0 flex-1 truncate t-sm"
                              style={{
                                color: isCurrentSub ? "var(--ink)" : "var(--ink-2)",
                                fontWeight: isCurrentSub ? 500 : 400,
                              }}
                            >
                              {subCategory.name}
                            </span>
                            <span
                              className="shrink-0 t-sm tabular"
                              style={{ color: "var(--ink-3)" }}
                            >
                              {subAnswered}/{subCategory.questionCount}
                            </span>
                          </button>

                          {flat ? (
                            <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                              {subCategory.sections[0].questions.map(questionRow)}
                            </ul>
                          ) : (
                            <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                              {subCategory.sections.map((section) => {
                                const sectionDone = stepProgress(steps[section.stepIndex], responses);
                                const isCurrentSection = section.stepIndex === currentStepIndex;

                                return (
                                  <li key={section.key}>
                                    <button
                                      type="button"
                                      onClick={() => onSelectStep(section.stepIndex)}
                                      aria-current={isCurrentSection ? "step" : undefined}
                                      className="flex w-full items-baseline gap-2 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                                      style={
                                        isCurrentSection
                                          ? { background: "var(--surface-2)" }
                                          : undefined
                                      }
                                    >
                                      <span
                                        className="min-w-0 flex-1 truncate t-sm"
                                        style={{
                                          color: isCurrentSection ? "var(--ink)" : "var(--ink-2)",
                                          fontWeight: isCurrentSection ? 500 : 400,
                                        }}
                                      >
                                        {section.name}
                                      </span>
                                      <span
                                        className="shrink-0 t-sm tabular"
                                        style={{ color: "var(--ink-3)" }}
                                      >
                                        {sectionDone.answered}/{sectionDone.total}
                                      </span>
                                    </button>

                                    <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                                      {section.questions.map(questionRow)}
                                    </ul>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
