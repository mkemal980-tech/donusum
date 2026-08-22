import {
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  Lightbulb,
  ListChecks,
  Target,
  Users,
  Zap,
} from "lucide-react";
import Panel from "@/components/ui/panel";
import { demoChamberDashboard as demo } from "@/lib/demo-chamber-dashboard";

const integer = new Intl.NumberFormat("tr-TR");
const decimal = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function DemoEsgAnalysis() {
  return (
    <Panel
      title="E–S–G değerlendirmesi"
      description="Çevresel, sosyal ve yönetişim sonuçlarının ağırlıklı oda görünümü"
      actions={<span className="badge badge-primary">Genel skor %{decimal.format(demo.results.overallScore)}</span>}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {demo.esgPillars.map((pillar) => (
          <article key={pillar.key} className="rounded-[var(--radius-md)] p-5" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-lg font-semibold"
                  style={{ background: "var(--surface-3)", color: pillar.color }}
                  aria-hidden="true"
                >
                  {pillar.key}
                </span>
                <div>
                  <h3 className="t-subhead">{pillar.name}</h3>
                  <p className="t-caption" style={{ color: "var(--ink-3)" }}>%{pillar.weight} değerlendirme ağırlığı</p>
                </div>
              </div>
              <div className="text-right">
                <p className="t-metric tabular">%{decimal.format(pillar.score)}</p>
                <p className="t-caption tabular" style={{ color: "var(--success)" }}>+{decimal.format(pillar.change)} puan</p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex justify-between gap-3 t-caption" style={{ color: "var(--ink-3)" }}>
                <span>{pillar.maturity}</span>
                <span className="tabular">Sektör kıyası %{decimal.format(pillar.benchmark)}</span>
              </div>
              <div
                className="relative h-2.5 rounded-full"
                style={{ background: "var(--surface-3)" }}
                role="progressbar"
                aria-label={`${pillar.name} puanı`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pillar.score}
              >
                <span className="block h-full rounded-full" style={{ width: `${pillar.score}%`, background: pillar.color }} />
                <span className="absolute top-[-3px] h-4 w-px" style={{ left: `${pillar.benchmark}%`, background: "var(--ink)" }} />
              </div>
            </div>

            <ul className="mt-5 space-y-2 t-sm">
              {pillar.topics.map((topic) => (
                <li key={topic} className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pillar.color }} />
                  {topic}
                </li>
              ))}
            </ul>
            <p className="mt-4 t-sm" style={{ color: "var(--ink-3)" }}>{pillar.finding}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--accent-faint)" }}>
        <ArrowUpRight size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <p className="t-sm" style={{ color: "var(--ink-2)" }}>
          Sosyal boyut <strong style={{ color: "var(--ink)" }}>%68,8</strong> ile lider. En hızlı toplam puan artışı için çevresel tarafta su ve karbon envanteri, yönetişim tarafında tedarikçi kriterleri birlikte ele alınmalı.
        </p>
      </div>
    </Panel>
  );
}

export function DemoIronmanAnalysis() {
  return (
    <Panel
      title="Ironman analizi"
      description="2.000 üyenin hız ve dayanıklılık eksenlerindeki toplu konumu · 1–5 ölçeği"
      actions={<span className="badge badge-success"><Gauge size={13} /> {demo.ironman.quadrantLabel}</span>}
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <IronmanQuadrantChart />

        <div>
          <div className="grid grid-cols-2 gap-3">
            <MetricBlock label="Hız" value={demo.ironman.current.velocity} note={`Kıyas ${decimal.format(demo.ironman.benchmark.velocity)}`} />
            <MetricBlock label="Dayanıklılık" value={demo.ironman.current.endurance} note={`Kıyas ${decimal.format(demo.ironman.benchmark.endurance)}`} />
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] p-4" style={{ background: "var(--success-bg)" }}>
            <div className="flex items-center justify-between gap-3">
              <span className="t-label" style={{ color: "var(--success-ink)" }}>Oda sınıfı</span>
              <span className="t-subhead" style={{ color: "var(--success-ink)" }}>{demo.ironman.quadrantLabel}</span>
            </div>
            <p className="mt-2 t-sm" style={{ color: "var(--ink-2)" }}>{demo.ironman.description}</p>
          </div>

          <h3 className="mt-6 t-label">Üye dağılımı</h3>
          <div className="mt-3 space-y-3">
            {demo.ironman.distribution.map((item) => (
              <div key={item.key}>
                <div className="mb-1.5 grid grid-cols-[1fr_auto_auto] items-center gap-3 t-sm">
                  <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="tabular">{integer.format(item.count)}</span>
                  <span className="w-12 text-right tabular" style={{ color: "var(--ink-3)" }}>%{decimal.format(item.percentage)}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: "var(--surface-3)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${item.percentage}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 t-caption" style={{ color: "var(--ink-3)" }}>
            Analiz kapsamı: {demo.ironman.questionMix.velocity} hız + {demo.ironman.questionMix.endurance} dayanıklılık sorusu. Kadran eşiği {decimal.format(demo.ironman.threshold)}.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export function DemoRecommendationPortfolio() {
  const summary = demo.recommendationSummary;
  return (
    <Panel
      title="Öneri portföyü"
      description="Anket sonuçlarından oda yönetimi için türetilen program ve destek önerileri"
      actions={<span className="badge badge-primary"><Lightbulb size={13} /> {summary.total} öneri</span>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBlock icon={<ListChecks size={18} />} label="Yüksek öncelik" value={summary.highPriority} note="yönetim gündemine alınmalı" />
        <SummaryBlock icon={<Users size={18} />} label="Potansiyel erişim" value={integer.format(summary.memberReach)} note="en az bir programdan yararlanabilir" />
        <SummaryBlock icon={<Zap size={18} />} label="Hızlı kazanım" value={summary.byStrategy.quickWins} note="ilk 6 ayda başlatılabilir" />
        <SummaryBlock icon={<Target size={18} />} label="Potansiyel artış" value={`+${decimal.format(summary.potentialScoreGain)}`} note="ESG puanı" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="t-label">Strateji türü</h3>
            <span className="t-caption" style={{ color: "var(--ink-3)" }}>{summary.total} öneri</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full" aria-label="Önerilerin strateji türüne göre dağılımı" role="img">
            <span style={{ width: `${(summary.byStrategy.quickWins / summary.total) * 100}%`, background: "var(--success)" }} />
            <span style={{ width: `${(summary.byStrategy.projects / summary.total) * 100}%`, background: "var(--accent)" }} />
            <span style={{ width: `${(summary.byStrategy.bigBets / summary.total) * 100}%`, background: "var(--series-4)" }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 t-sm">
            <PortfolioLegend color="var(--success)" label="Hızlı kazanım" value={summary.byStrategy.quickWins} />
            <PortfolioLegend color="var(--accent)" label="Proje" value={summary.byStrategy.projects} />
            <PortfolioLegend color="var(--series-4)" label="Büyük yatırım" value={summary.byStrategy.bigBets} />
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="t-label">Uygulama durumu</h3>
            <span className="t-caption" style={{ color: "var(--ink-3)" }}>{summary.byStatus.inProgress} aktif çalışma</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatusMetric label="Hazır" value={summary.byStatus.ready} color="var(--success)" />
            <StatusMetric label="Devam ediyor" value={summary.byStatus.inProgress} color="var(--warning)" />
            <StatusMetric label="Planlandı" value={summary.byStatus.planned} color="var(--accent)" />
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="theme-table">
          <thead>
            <tr>
              <th>Önerilen program</th>
              <th>ESG</th>
              <th>Tür / maliyet</th>
              <th>Üye erişimi</th>
              <th>Etki</th>
              <th>Vade</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {demo.recommendations.map((recommendation) => (
              <tr key={recommendation.id}>
                <td className="min-w-[300px]">
                  <p className="font-medium" style={{ color: "var(--ink)" }}>{recommendation.title}</p>
                  <p className="mt-1 t-caption" style={{ color: "var(--ink-3)" }}>{recommendation.description}</p>
                </td>
                <td><span className="badge badge-neutral">{recommendation.esg}</span></td>
                <td className="min-w-[130px]">
                  <span className={strategyBadge[recommendation.strategicType]}>{recommendation.strategicLabel}</span>
                  <p className="mt-1.5 flex items-center gap-1 t-caption" style={{ color: "var(--ink-3)" }}>
                    <CircleDollarSign size={13} /> {recommendation.cost}
                  </p>
                </td>
                <td className="tabular">{integer.format(recommendation.memberReach)}</td>
                <td>
                  <p className="font-medium tabular" style={{ color: "var(--ink)" }}>{decimal.format(recommendation.impact)}/10</p>
                  <p className="t-caption" style={{ color: recommendation.priority === "Çok yüksek" ? "var(--warning)" : "var(--ink-3)" }}>{recommendation.priority}</p>
                </td>
                <td className="whitespace-nowrap">{recommendation.timeframe}</td>
                <td><span className={statusBadge[recommendation.status]}>{recommendation.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MetricBlock({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
      <p className="t-label" style={{ color: "var(--ink-2)" }}>{label}</p>
      <p className="mt-1 t-metric tabular">{decimal.format(value)}/5</p>
      <p className="mt-1 t-caption" style={{ color: "var(--ink-3)" }}>{note}</p>
    </div>
  );
}

function SummaryBlock({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
      <div className="flex items-center justify-between gap-3">
        <p className="t-label" style={{ color: "var(--ink-2)" }}>{label}</p>
        <span style={{ color: "var(--accent)" }}>{icon}</span>
      </div>
      <p className="mt-2 t-metric tabular">{value}</p>
      <p className="mt-1 t-caption" style={{ color: "var(--ink-3)" }}>{note}</p>
    </div>
  );
}

function PortfolioLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label} <strong className="font-medium tabular" style={{ color: "var(--ink)" }}>{value}</strong>
    </span>
  );
}

function StatusMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="t-title tabular" style={{ color }}>{value}</p>
      <p className="mt-1 t-caption" style={{ color: "var(--ink-3)" }}>{label}</p>
    </div>
  );
}

function IronmanQuadrantChart() {
  const width = 620;
  const height = 430;
  const left = 70;
  const top = 34;
  const size = 320;
  const thresholdPosition = left + size / 2;
  const scoreX = (score: number) => left + ((score - 1) / 4) * size;
  const scoreY = (score: number) => top + size - ((score - 1) / 4) * size;
  const points = [
    { label: "Sektör kıyası", ...demo.ironman.benchmark, color: "var(--series-5)", radius: 6 },
    { label: "Oda ortalaması", ...demo.ironman.current, color: "var(--accent)", radius: 9 },
    { label: "2027 hedefi", ...demo.ironman.target, color: "var(--success)", radius: 8 },
  ];

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Ironman grafiği: oda ortalaması hız ${demo.ironman.current.velocity}, dayanıklılık ${demo.ironman.current.endurance}, Demir Adam bölgesinde`}
      >
        <rect x={left} y={top} width={size / 2} height={size / 2} fill="var(--surface-2)" />
        <rect x={thresholdPosition} y={top} width={size / 2} height={size / 2} fill="var(--accent-faint)" />
        <rect x={left} y={top + size / 2} width={size / 2} height={size / 2} fill="var(--surface-2)" />
        <rect x={thresholdPosition} y={top + size / 2} width={size / 2} height={size / 2} fill="var(--surface-2)" />

        {[1, 2, 3, 4, 5].map((tick) => {
          const x = scoreX(tick);
          const y = scoreY(tick);
          return (
            <g key={tick}>
              <line x1={x} y1={top} x2={x} y2={top + size} stroke="var(--chart-grid)" />
              <line x1={left} y1={y} x2={left + size} y2={y} stroke="var(--chart-grid)" />
              <text x={x} y={top + size + 22} textAnchor="middle" fontSize="12" fill="var(--chart-axis-text)">{tick}</text>
              <text x={left - 15} y={y + 4} textAnchor="middle" fontSize="12" fill="var(--chart-axis-text)">{tick}</text>
            </g>
          );
        })}

        <line x1={thresholdPosition} y1={top} x2={thresholdPosition} y2={top + size} stroke="var(--line-strong)" strokeWidth="2" />
        <line x1={left} y1={top + size / 2} x2={left + size} y2={top + size / 2} stroke="var(--line-strong)" strokeWidth="2" />

        <text x={left + size / 4} y={top + 20} textAnchor="middle" fontSize="12" fill="var(--ink-3)">Maraton Koşucusu</text>
        <text x={left + (size * 3) / 4} y={top + 20} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--accent)">Demir Adam</text>
        <text x={left + size / 4} y={top + size - 12} textAnchor="middle" fontSize="12" fill="var(--ink-3)">Yaya</text>
        <text x={left + (size * 3) / 4} y={top + size - 12} textAnchor="middle" fontSize="12" fill="var(--ink-3)">Sprinter</text>

        <line
          x1={scoreX(demo.ironman.current.velocity)}
          y1={scoreY(demo.ironman.current.endurance)}
          x2={scoreX(demo.ironman.target.velocity)}
          y2={scoreY(demo.ironman.target.endurance)}
          stroke="var(--success)"
          strokeWidth="2"
          strokeDasharray="6 5"
        />

        {points.map((point) => (
          <g key={point.label}>
            <circle cx={scoreX(point.velocity)} cy={scoreY(point.endurance)} r={point.radius + 3} fill="var(--surface)" />
            <circle cx={scoreX(point.velocity)} cy={scoreY(point.endurance)} r={point.radius} fill={point.color} />
          </g>
        ))}

        <text x={left + size / 2} y={height - 18} textAnchor="middle" fontSize="13" fontWeight="500" fill="var(--ink-2)">Hız →</text>
        <text x="18" y={top + size / 2} textAnchor="middle" fontSize="13" fontWeight="500" fill="var(--ink-2)" transform={`rotate(-90 18 ${top + size / 2})`}>Dayanıklılık →</text>

        <g transform="translate(430 82)">
          {points.map((point, index) => (
            <g key={point.label} transform={`translate(0 ${index * 54})`}>
              <circle cx="7" cy="7" r="6" fill={point.color} />
              <text x="22" y="5" fontSize="12" fill="var(--ink-3)">{point.label}</text>
              <text x="22" y="23" fontSize="13" fontWeight="600" fill="var(--ink)">
                {decimal.format(point.velocity)} / {decimal.format(point.endurance)}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

const strategyBadge = {
  QUICK_WIN: "badge badge-success",
  PROJECT: "badge badge-primary",
  BIG_BET: "badge badge-info",
} as const;

const statusBadge: Record<string, string> = {
  Hazır: "badge badge-success",
  "Devam ediyor": "badge badge-warning",
  Planlandı: "badge badge-primary",
};
