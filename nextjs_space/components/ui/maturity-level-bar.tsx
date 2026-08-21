"use client";

interface MaturityLevelBarProps {
  score: number; // 0-100 percentage or 1-5 score
  isPercentage?: boolean; // if true, converts from percentage to 1-5
}

/**
 * Olgunluk basamakları.
 *
 * Önceki hâli dikey, degradeyle dolan bir çubuktu: yanına düşen sayı çubuğun
 * dışında kalıyor, degrade beş basamağı tek renge eritiyordu. Ölçek artık
 * yatay ve basamaklı — hangi basamakta olunduğu okumadan görülür, bir sonraki
 * basamağa ne kaldığı da aynı çizgide durur.
 */
const levels = [
  { label: "Başlangıç", value: 1, minPercent: 0 },
  { label: "Farkındalık", value: 2, minPercent: 20 },
  { label: "Gelişen", value: 3, minPercent: 40 },
  { label: "Olgun", value: 4, minPercent: 60 },
  { label: "Lider", value: 5, minPercent: 80 },
];

export function MaturityLevelBar({ score, isPercentage = true }: MaturityLevelBarProps) {
  const percentage = isPercentage ? score : ((score - 1) / 4) * 100;
  const scoreOn5 = isPercentage ? (score / 100) * 4 + 1 : score;
  const clamped = Math.min(100, Math.max(0, percentage));

  const currentIndex = levels.reduce(
    (acc, level, i) => (clamped >= level.minPercent ? i : acc),
    0,
  );
  const current = levels[currentIndex];
  const next = levels[currentIndex + 1];

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="t-label" style={{ color: "var(--ink-2)" }}>
          Seviyelendirme
        </h3>
        <p className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
          {scoreOn5.toFixed(1)} / 5
        </p>
      </div>

      <p className="mt-1.5 t-subhead" style={{ color: "var(--ink)" }}>
        {current.label}
      </p>

      {/* Beş basamak, beş kutu. Geçilen basamaklar dolu, bulunulan basamak
          vurgu rengiyle; kalanlar boş yüzey. */}
      <ol className="mt-4 flex gap-1.5" aria-label={`Olgunluk seviyesi: ${current.label}`}>
        {levels.map((level, i) => {
          const passed = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li
              key={level.value}
              className="h-2 flex-1 rounded-[var(--radius-pill)]"
              style={{
                background: isCurrent
                  ? "var(--accent)"
                  : passed
                    ? "var(--accent-quiet)"
                    : "var(--surface-2)",
              }}
            />
          );
        })}
      </ol>

      <ol className="mt-2.5 flex gap-1.5">
        {levels.map((level, i) => (
          <li
            key={level.value}
            className="flex-1 truncate t-caption"
            style={{
              color: i === currentIndex ? "var(--ink)" : "var(--ink-3)",
              letterSpacing: "0.02em",
            }}
            title={level.label}
          >
            {level.label}
          </li>
        ))}
      </ol>

      <p className="mt-5 t-sm" style={{ color: "var(--ink-2)" }}>
        {next ? (
          <>
            <span style={{ color: "var(--ink)" }}>{next.label}</span> basamağı için{" "}
            <span className="tabular" style={{ color: "var(--ink)" }}>
              {Math.max(0, Math.ceil(next.minPercent - clamped))} puan
            </span>{" "}
            gerekiyor.
          </>
        ) : (
          "En üst basamaktasınız; buradan sonrası korumak."
        )}
      </p>
    </div>
  );
}

export default MaturityLevelBar;
