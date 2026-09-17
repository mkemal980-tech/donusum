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
  /**
   * Gezinmenin tek hedefi soru. Bölüm satırları yalnızca açıp kapatıyor;
   * bir bölüme gitmek zaten ilk sorusuna gitmek demek.
   */
  onSelectQuestion: (stepIndex: number, questionId: string) => void;
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
   * Bulunulan bölüm ve alt seviye — ikisi de kendiliğinden açılır.
   *
   * Adım bilgisi olmayan kullanım için (önizlemenin gözden geçirme modunda
   * anketin tamamı tek sayfada) aktif soruya da bakılır; yoksa ağaç tamamen
   * kapalı açılır ve konumu hiç göstermez.
   */
  const currentKeys = useMemo(() => {
    const empty = { subCategory: null as string | null, section: null as string | null };

    for (const category of outline) {
      for (const subCategory of category.subCategories) {
        const byStep = subCategory.sections.find((item) => item.stepIndex === currentStepIndex);
        if (byStep) return { subCategory: subCategory.key, section: byStep.key };
      }
    }

    if (!activeQuestionId) return empty;

    for (const category of outline) {
      for (const subCategory of category.subCategories) {
        const byQuestion = subCategory.sections.find((item) =>
          item.questions.some((question) => question.id === activeQuestionId),
        );
        if (byQuestion) return { subCategory: subCategory.key, section: byQuestion.key };
      }
    }

    return empty;
  }, [outline, currentStepIndex, activeQuestionId]);

  /**
   * Açık düğümler — kategori, bölüm ve alt seviye aynı listede tutulur;
   * anahtarları birbirine karışmayacak biçimde üretiliyor.
   *
   * Yalnızca bulunulan yolun üstü açık gelir. Her şey açık gelirse harita
   * kendi başına bir duvar olur ve çözdüğü sorunu yeniden yaratır.
   * Kullanıcının açtığı ya da kapattığı düğümler öyle kalır — gezinirken
   * kendiliğinden kapanan bir ağaç en can sıkıcı davranış.
   */
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    const wanted = [currentCategoryId, currentKeys.subCategory, currentKeys.section].filter(
      (key): key is string => Boolean(key),
    );
    if (wanted.length === 0) return;

    setExpanded((current) => {
      const missing = wanted.filter((key) => !current.includes(key));
      return missing.length === 0 ? current : [...current, ...missing];
    });
  }, [currentCategoryId, currentKeys]);

  const toggle = (key: string) =>
    setExpanded((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );

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

  const questionRow = (question: OutlineQuestion) => {
    const answered = isAnswered(responses, question.id);
    const isActive = activeQuestionId === question.id;

    return (
      <li key={question.id}>
        <button
          ref={isActive ? activeRef : undefined}
          type="button"
          onClick={() => onSelectQuestion(question.stepIndex, question.id)}
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
                  onClick={() => toggle(category.categoryId)}
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
                      /* Alt seviyesiz bölümde sorular doğrudan bu satırın
                         altında durur; ara bir satır daha çizmek adı iki kez
                         yazdırırdı. */
                      const flat =
                        subCategory.sections.length === 1 && subCategory.sections[0].name === null;
                      const subAnswered = subCategory.sections
                        .flatMap((section) => section.questions)
                        .filter((question) => isAnswered(responses, question.id)).length;
                      const isCurrentSub = subCategory.sections.some(
                        (section) => section.stepIndex === currentStepIndex,
                      );
                      const isSubOpen = expanded.includes(subCategory.key);

                      return (
                        <li key={subCategory.key}>
                          {/* Bölüm satırı açıp kapatır, gezinmez: altındaki
                              sorular zaten gezinme hedefi ve altı soruluk bir
                              bölüm açıkken harita okunmaz uzunlukta oluyordu. */}
                          <button
                            type="button"
                            onClick={() => toggle(subCategory.key)}
                            aria-expanded={isSubOpen}
                            className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                            style={isCurrentSub ? { background: "var(--accent-quiet)" } : undefined}
                          >
                            <ChevronRight
                              size={13}
                              aria-hidden="true"
                              className="shrink-0 transition-transform duration-fast ease-out-quart"
                              style={{
                                color: "var(--accent)",
                                transform: isSubOpen ? "rotate(90deg)" : undefined,
                              }}
                            />
                            {/* Bölüm adı vurgu renginde: kategori ile soru
                                arasındaki seviyeyi renk ayırıyor, girinti tek
                                başına yetmiyordu. */}
                            <span
                              className="min-w-0 flex-1 truncate t-sm"
                              style={{
                                color: "var(--accent)",
                                fontWeight: isCurrentSub ? 600 : 500,
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

                          {isSubOpen &&
                            (flat ? (
                              <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                                {subCategory.sections[0].questions.map(questionRow)}
                              </ul>
                            ) : (
                              <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                                {subCategory.sections.map((section) => {
                                  const sectionDone = stepProgress(steps[section.stepIndex], responses);
                                  const isCurrentSection = section.stepIndex === currentStepIndex;
                                  const isSectionOpen = expanded.includes(section.key);

                                  return (
                                    <li key={section.key}>
                                      <button
                                        type="button"
                                        onClick={() => toggle(section.key)}
                                        aria-expanded={isSectionOpen}
                                        className="flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1.5 text-left transition-colors duration-fast ease-out-quart hover:bg-[var(--surface-2)]"
                                        style={
                                          isCurrentSection
                                            ? { background: "var(--surface-2)" }
                                            : undefined
                                        }
                                      >
                                        <ChevronRight
                                          size={12}
                                          aria-hidden="true"
                                          className="shrink-0 transition-transform duration-fast ease-out-quart"
                                          style={{
                                            color: "var(--ink-3)",
                                            transform: isSectionOpen ? "rotate(90deg)" : undefined,
                                          }}
                                        />
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

                                      {isSectionOpen && (
                                        <ul className="ml-2 flex flex-col gap-0.5 pl-2">
                                          {section.questions.map(questionRow)}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ))}
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
