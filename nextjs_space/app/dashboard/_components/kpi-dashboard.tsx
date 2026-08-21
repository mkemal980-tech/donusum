"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KPIData {
  overview: {
    totalQuestions: number;
    answeredQuestions: number;
    completionPercentage: number;
    overallScore: number;
    overallPercentage: number;
    maturityLevel: {
      level: number;
      label: string;
      color: string;
    };
  };
  ironman: {
    velocity: number;
    endurance: number;
    quadrant: string;
    quadrantInfo: {
      title: string;
      color: string;
    };
    velocityVsSector: number | null;
    enduranceVsSector: number | null;
  };
  categories: {
    total: number;
    completed: number;
    stats: Array<{
      id: string;
      name: string;
      total: number;
      answered: number;
      percentage: number;
    }>;
  };
  recommendations: {
    total: number;
    quickWins: number;
    projects: number;
    bigBets: number;
  };
  activity: {
    lastActivityDate: string | null;
    responsesToday: number;
  };
  user: {
    name: string;
    organization: string | null;
    sector: string | null;
    subSector: string | null;
  };
}

interface KPIDashboardProps {
  surveyId?: string;
}

export function KPIDashboard({ surveyId }: KPIDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const url = surveyId ? `/api/dashboard/kpi?surveyId=${surveyId}` : '/api/dashboard/kpi';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Error fetching KPI:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKPI();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[104px]" />
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[200px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Boş state kontrolü - hiç veri yoksa
  const hasNoData = data.overview.answeredQuestions === 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Henüz aktivite yok';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const renderTrend = (value: number | null) => {
    if (value === null || value === undefined) return null;
    if (value > 0) return <ArrowUpRight size={14} style={{ color: "var(--success)" }} aria-hidden="true" />;
    if (value < 0) return <ArrowDownRight size={14} style={{ color: "var(--error)" }} aria-hidden="true" />;
    return <Minus size={14} style={{ color: "var(--ink-3)" }} aria-hidden="true" />;
  };

  /* Hiç cevap yoksa gösterge yerine tek bir sonraki adım durur. */
  if (hasNoData) {
    return (
      <section
        className="rounded-[var(--radius-lg)] p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
      >
        <div className="max-w-[52ch]">
          <h2 className="t-subhead" style={{ color: "var(--ink)" }}>
            Değerlendirme henüz başlamadı
          </h2>
          <p className="mt-2 t-body" style={{ color: "var(--ink-2)" }}>
            {data.overview.totalQuestions} soru, {data.categories.total} kategori.
            İlk bölümü doldurduğunuzda puan, kıyaslama ve öneriler burada oluşmaya başlar.
          </p>
          <Button onClick={() => router.push('/survey')} className="mt-5">
            Ankete başla
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </section>
    );
  }

  /* Üstteki metrik şeridiyle çakışan kartlar (toplam soru, tamamlanan, puan,
     yüzde) buradan kaldırıldı; bu bölüm yalnızca Ironman eksenlerini anlatır. */
  const gaugeCards = [
    {
      title: 'Velocity (hız)',
      value: data.ironman.velocity.toFixed(1),
      suffix: '/5',
      description:
        'Aksiyon alma hızınız. Uygulamaya, projeye ve harekete geçmeye bakan sorulardan gelir. Yüksek puan çabuk hareket ettiğinizi gösterir; tek başına yüksek olması attığınız adımların kalıcı olduğu anlamına gelmez.',
      subtitle:
        data.ironman.velocityVsSector !== null
          ? `Sektöre göre ${data.ironman.velocityVsSector > 0 ? '+' : ''}${data.ironman.velocityVsSector}`
          : 'Sektör kıyaslaması yok',
      trend: data.ironman.velocityVsSector,
    },
    {
      title: 'Endurance (dayanıklılık)',
      value: data.ironman.endurance.toFixed(1),
      suffix: '/5',
      description:
        'Yaptığınız işin kalıcılığı. Politika, dokümantasyon, süreç ve süreklilik sorularından gelir. Yüksek puan, kişilere değil sisteme bağlı çalıştığınızı gösterir.',
      subtitle:
        data.ironman.enduranceVsSector !== null
          ? `Sektöre göre ${data.ironman.enduranceVsSector > 0 ? '+' : ''}${data.ironman.enduranceVsSector}`
          : 'Sektör kıyaslaması yok',
      trend: data.ironman.enduranceVsSector,
    },
    {
      title: 'Ironman kadranı',
      value: data.ironman.quadrantInfo.title,
      description:
        'İki eksenin kesişimi; eşik her iki eksende de 3.0. İkisi de 3.0 üstündeyse Demir Adam (hem hızlı hem kalıcı), yalnızca hız yüksekse Sprinter, yalnızca dayanıklılık yüksekse Maraton Koşucusu, ikisi de düşükse Yaya.',
      subtitle: 'Hız ve dayanıklılığın kesişimi',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        {gaugeCards.map((card) => (
          <div
            key={card.title}
            tabIndex={0}
            className="group relative rounded-[var(--radius-lg)] p-5 transition-colors duration-base ease-out-quart hover:border-[var(--line-strong)] focus:outline-none focus-visible:border-[var(--accent)]"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            {/* Sayının ne anlama geldiği. Kartın altına, kart genişliğinde
                açılır: yana taşarsa son sütunda ekrandan çıkardı. */}
            <div
              role="tooltip"
              className="chart-tooltip pointer-events-none absolute left-0 right-0 top-full mt-2 translate-y-1 opacity-0 transition-all duration-base ease-out-quart group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {card.description}
            </div>

            <p className="flex items-center gap-1.5 t-label" style={{ color: "var(--ink-2)" }}>
              {card.title}
              <Info size={12} className="shrink-0 opacity-40 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </p>

            <p className="mt-2 flex items-baseline gap-1 t-metric" style={{ color: "var(--ink)" }}>
              {card.value}
              {card.suffix && (
                <span className="t-sm" style={{ color: "var(--ink-3)" }}>
                  {card.suffix}
                </span>
              )}
            </p>

            <p className="mt-1.5 flex items-center gap-1 t-sm" style={{ color: "var(--ink-3)" }}>
              {renderTrend(card.trend ?? null)}
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Kategori ilerlemesi */}
        <section
          className="rounded-[var(--radius-lg)] p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          aria-labelledby="kpi-category-heading"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="kpi-category-heading" className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              Kategori ilerlemesi
            </h3>
            <span className="t-sm tabular" style={{ color: "var(--ink-3)" }}>
              {data.categories.completed}/{data.categories.total}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {data.categories.stats.slice(0, 5).map((cat) => (
              <div key={cat.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate t-sm" style={{ color: "var(--ink-2)" }} title={cat.name}>
                    {cat.name}
                  </span>
                  <span className="t-sm tabular font-medium" style={{ color: "var(--ink)" }}>
                    {cat.percentage}%
                  </span>
                </div>
                <div className="progress-bar mt-1.5">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${cat.percentage}%`,
                      /* Tamamlanan kategori ikinci veri serisiyle, devam eden
                         vurgu maviyle çizilir; renk durumu anlatır. */
                      background: cat.percentage === 100 ? "var(--series-2)" : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Öneri dağılımı */}
        <section
          className="rounded-[var(--radius-lg)] p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          aria-labelledby="kpi-recommendation-heading"
        >
          <h3 id="kpi-recommendation-heading" className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            Öneri dağılımı
          </h3>

          <dl className="mt-4">
            {[
              { label: 'Quick Win', value: data.recommendations.quickWins, hint: 'kısa sürede, düşük maliyetle' },
              { label: 'Proje', value: data.recommendations.projects, hint: 'planlama ve bütçe gerektirir' },
              { label: 'Big Bet', value: data.recommendations.bigBets, hint: 'stratejik, uzun soluklu' },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3 py-3"
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--line)" }}
              >
                <div>
                  <dt className="t-body" style={{ color: "var(--ink)" }}>
                    {row.label}
                  </dt>
                  <dd className="t-sm" style={{ color: "var(--ink-3)" }}>
                    {row.hint}
                  </dd>
                </div>
                <dd className="t-metric" style={{ color: "var(--ink)" }}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Aktivite */}
        <section
          className="rounded-[var(--radius-lg)] p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          aria-labelledby="kpi-activity-heading"
        >
          <h3 id="kpi-activity-heading" className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
            Aktivite
          </h3>

          <dl className="mt-4 flex flex-col">
            <div className="flex items-baseline justify-between gap-3 py-3">
              <dt className="t-sm" style={{ color: "var(--ink-2)" }}>
                Son aktivite
              </dt>
              <dd className="t-body" style={{ color: "var(--ink)" }}>
                {formatDate(data.activity.lastActivityDate)}
              </dd>
            </div>
            <div
              className="flex items-baseline justify-between gap-3 py-3"
              style={{ borderTop: "1px solid var(--line)" }}
            >
              <dt className="t-sm" style={{ color: "var(--ink-2)" }}>
                Bugün cevaplanan
              </dt>
              <dd className="t-body tabular" style={{ color: "var(--ink)" }}>
                {data.activity.responsesToday} soru
              </dd>
            </div>
            {data.user.sector && (
              <div
                className="flex items-baseline justify-between gap-3 py-3"
                style={{ borderTop: "1px solid var(--line)" }}
              >
                <dt className="t-sm" style={{ color: "var(--ink-2)" }}>
                  Sektör
                </dt>
                <dd className="text-right t-body" style={{ color: "var(--ink)" }}>
                  {data.user.sector}
                  {data.user.subSector && (
                    <span className="block t-sm" style={{ color: "var(--ink-3)" }}>
                      {data.user.subSector}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>
    </div>
  );
}
