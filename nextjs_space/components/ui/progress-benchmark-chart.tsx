"use client";

interface ProgressItem {
  id?: string;
  name: string;
  surveyScore: number;      // Ankette alınan taban puan
  progressScore: number;    // Öneriler tamamlandıkça ulaşılan puan
  delta: number;            // İkisi arasındaki fark
}

interface ProgressBenchmarkChartProps {
  title?: string;
  overall: ProgressItem;
  categories: ProgressItem[];
  maxScore?: number;
}

/**
 * Anket puanı ile gelişim puanını aynı çizgide gösteren yatay çubuk.
 *
 * İki seri: taban puan vurgu maviyle, kazanılan ek puan ikinci seri yeşiliyle
 * onun devamına eklenir. Sayılar çubuğun içine değil satırın sağına yazılır —
 * çubuk kısaldığında içerideki rakam kesiliyordu.
 */
export function ProgressBenchmarkChart({
  title = "İlerleme ve gelişim",
  overall,
  categories,
  maxScore = 5
}: ProgressBenchmarkChartProps) {
  const scaleToPercent = (score: number) => Math.min(Math.max((score / maxScore) * 100, 0), 100);

  const renderRow = (item: ProgressItem, isOverall = false) => {
    const surveyPercent = scaleToPercent(item.surveyScore);
    const progressPercent = scaleToPercent(item.progressScore);
    const hasProgress = item.delta > 0;

    return (
      <div
        key={item.name}
        className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-4 py-2.5"
        style={{ borderTop: isOverall ? undefined : "1px solid var(--line)" }}
      >
        <span
          className="truncate t-sm"
          style={{ color: isOverall ? "var(--ink)" : "var(--ink-2)", fontWeight: isOverall ? 600 : 400 }}
          title={item.name}
        >
          {item.name}
        </span>

        <div className="relative h-2">
          <div className="absolute inset-0 rounded-[var(--radius-pill)]" style={{ background: "var(--surface-2)" }} />

          {/* Ölçek çentikleri: 1–5 arasını okunur kılar. */}
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className="absolute top-0 h-2 w-px"
              style={{ left: `${(n / maxScore) * 100}%`, background: "var(--canvas)" }}
              aria-hidden="true"
            />
          ))}

          <div
            className="absolute inset-y-0 left-0 rounded-l-[var(--radius-pill)]"
            style={{
              width: `${surveyPercent}%`,
              background: "var(--accent)",
              borderRadius: hasProgress ? undefined : "var(--radius-pill)",
              transition: "width 600ms var(--ease-out-quart)",
            }}
          />

          {hasProgress && (
            <div
              className="absolute inset-y-0 rounded-r-[var(--radius-pill)]"
              style={{
                left: `${surveyPercent}%`,
                width: `${Math.max(progressPercent - surveyPercent, 0)}%`,
                background: "var(--series-2)",
                transition: "width 600ms var(--ease-out-quart)",
              }}
            />
          )}
        </div>

        <span className="w-24 text-right t-sm tabular" style={{ color: "var(--ink-2)" }}>
          {item.surveyScore.toFixed(2)}
          {hasProgress && (
            <span style={{ color: "var(--series-2)" }}> +{item.delta.toFixed(2)}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <section
      className="rounded-[var(--radius-lg)] p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      aria-labelledby="progress-benchmark-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h3 id="progress-benchmark-heading" className="t-subhead" style={{ color: "var(--ink)" }}>
          {title}
        </h3>

        <div className="flex items-center gap-4 t-sm">
          <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
            Anket puanı
          </span>
          <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-2)" }} aria-hidden="true" />
            Önerilerden kazanılan
          </span>
        </div>
      </div>

      <p className="mt-1.5 t-sm tabular" style={{ color: "var(--ink-3)" }}>
        Genel: {overall.surveyScore.toFixed(2)} → {overall.progressScore.toFixed(2)} / {maxScore}
      </p>

      <div className="mt-5">
        {categories.length > 0 ? (
          categories.map((cat, i) => renderRow(cat, i === 0))
        ) : (
          <p className="t-sm" style={{ color: "var(--ink-3)" }}>
            Bu kırılımda gösterilecek satır yok.
          </p>
        )}
      </div>

      {/* Ölçek: satırların altında bir kez, her satırda değil. */}
      <div className="mt-4 grid grid-cols-[minmax(0,11rem)_1fr_auto] gap-4 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
        <span />
        <span className="flex justify-between t-caption" style={{ letterSpacing: "0.02em" }}>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </span>
        <span className="w-24" />
      </div>
    </section>
  );
}
