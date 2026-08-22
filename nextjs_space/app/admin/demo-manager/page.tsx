import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  EyeOff,
  Info,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { authOptions } from "@/lib/auth-options";
import { demoChamberDashboard as demo } from "@/lib/demo-chamber-dashboard";
import PageHeader from "@/components/ui/page-header";
import Panel from "@/components/ui/panel";
import StatCard from "@/components/ui/stat-card";

export const dynamic = "force-dynamic";

const integer = new Intl.NumberFormat("tr-TR");
const decimal = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Kurgu yönetici demosu yalnızca en yüksek mevcut rol olan ADMIN'e açılır.
 * Menü görünürlüğü tek başına güvenlik sınırı değildir; sunucu bu kontrolü
 * sayfa içeriği oluşturulmadan önce tekrar yapar.
 */
export default async function DemoManagerPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) {
    redirect("/login?callbackUrl=/admin/demo-manager");
  }
  if (role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6" data-testid="demo-manager-dashboard">
      <PageHeader
        title="Demo yönetici alanı"
        subtitle="Bir ticaret odasının 2.000 tamamlanmış üye yanıtıyla göreceği örnek sürdürülebilirlik panosu."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-primary"><ShieldCheck size={14} /> Yalnızca süper admin</span>
            <span className="badge badge-neutral"><Sparkles size={14} /> Kurgu demo verisi</span>
          </div>
        }
      />

      <section
        className="rounded-[var(--radius-lg)] p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        aria-labelledby="demo-campaign-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
              style={{ background: "var(--accent-quiet)", color: "var(--accent)" }}
              aria-hidden="true"
            >
              <Building2 size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="demo-campaign-heading" className="t-title">{demo.organization.name}</h2>
                <span className="badge badge-success">{demo.campaign.status}</span>
                <span className="badge badge-neutral"><EyeOff size={13} /> {demo.campaign.privacyMode}</span>
              </div>
              <p className="mt-1 t-body" style={{ color: "var(--ink-2)" }}>{demo.campaign.name}</p>
              <p className="mt-2 t-sm" style={{ color: "var(--ink-3)" }}>
                {demo.organization.type} · {demo.campaign.questionCount} soru · Son güncelleme {demo.campaign.lastUpdatedAt}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 t-sm sm:items-end" style={{ color: "var(--ink-2)" }}>
            <span className="flex items-center gap-2"><CalendarDays size={15} /> {demo.campaign.launchedAt} – {demo.campaign.deadline}</span>
            <span className="flex items-center gap-2"><Target size={15} /> {integer.format(demo.organization.memberCount)} davetli üye</span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Davet edilen üye" value={integer.format(demo.participation.invited)} note="kampanya kapsamındaki üyeler" />
        <StatCard label="Tamamlanan yanıt" value={integer.format(demo.participation.submitted)} note="kesinleşmiş gönderim" tone="success" />
        <StatCard label="Katılım oranı" value={`%${decimal.format(demo.participation.completionRate)}`} note="oda genelinde" tone="accent" />
        <StatCard label="Devam eden" value={integer.format(demo.participation.inProgress)} note={`${integer.format(demo.participation.notStarted)} üye başlamadı`} tone="warning" />
      </div>

      <Panel
        title="Katılım durumu"
        description="Davet edilen 2.480 üyenin güncel yanıt durumu"
        actions={<span className="t-metric tabular">%{decimal.format(demo.participation.completionRate)}</span>}
      >
        <div
          className="flex h-3 overflow-hidden rounded-full"
          style={{ background: "var(--surface-3)" }}
          role="img"
          aria-label={`${integer.format(demo.participation.submitted)} tamamlandı, ${integer.format(demo.participation.inProgress)} devam ediyor, ${integer.format(demo.participation.notStarted)} başlamadı`}
        >
          <span style={{ width: `${(demo.participation.submitted / demo.participation.invited) * 100}%`, background: "var(--success)" }} />
          <span style={{ width: `${(demo.participation.inProgress / demo.participation.invited) * 100}%`, background: "var(--warning)" }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 t-sm">
          <LegendDot color="var(--success)" label="Tamamlandı" value={demo.participation.submitted} />
          <LegendDot color="var(--warning)" label="Devam ediyor" value={demo.participation.inProgress} />
          <LegendDot color="var(--series-5)" label="Başlamadı" value={demo.participation.notStarted} />
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ortalama olgunluk" value={`%${decimal.format(demo.results.overallScore)}`} note="Gelişen seviye" tone="accent" />
        <StatCard label="Medyan puan" value={`%${integer.format(demo.results.medianScore)}`} note="2.000 kesinleşmiş sonuç" />
        <StatCard label="En yaygın seviye" value={demo.results.leadingMaturity} note="704 üye · %35,2" />
        <StatCard label="Sektör kıyasının üstü" value={`+${decimal.format(demo.results.benchmarkDifference)}`} note="puan" tone="success" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Yanıtların gelişimi"
          description="Kümülatif tamamlanan üye yanıtı"
          actions={<span className="badge badge-success"><CheckCircle2 size={13} /> 2.000 tamamlandı</span>}
        >
          <ResponseTrendChart />
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Olgunluk dağılımı"
          description="Tamamlanan 2.000 yanıt"
        >
          <div
            className="flex h-5 overflow-hidden rounded-[var(--radius-pill)]"
            role="img"
            aria-label={demo.maturityDistribution.map((item) => `${item.label} ${item.count}`).join(", ")}
          >
            {demo.maturityDistribution.map((item) => (
              <span key={item.label} style={{ width: `${item.percentage}%`, background: item.color }} />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {demo.maturityDistribution.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 t-sm">
                <span className="flex min-w-0 items-center gap-2" style={{ color: "var(--ink-2)" }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
                <span className="tabular" style={{ color: "var(--ink)" }}>{integer.format(item.count)}</span>
                <span className="w-12 text-right tabular" style={{ color: "var(--ink-3)" }}>%{decimal.format(item.percentage)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Sürdürülebilirlik başlıkları"
          description="Oda ortalaması ve sektör kıyası · 100 üzerinden"
        >
          <div className="space-y-5">
            {demo.categories.map((category) => (
              <div key={category.name}>
                <div className="mb-2 flex items-center justify-between gap-4 t-sm">
                  <span style={{ color: "var(--ink-2)" }}>{category.name}</span>
                  <span className="whitespace-nowrap tabular" style={{ color: "var(--ink)" }}>
                    <strong className="font-semibold">{category.score}</strong>
                    <span style={{ color: "var(--ink-3)" }}> · kıyas {category.benchmark}</span>
                  </span>
                </div>
                <div
                  className="relative h-2.5 overflow-visible rounded-full"
                  style={{ background: "var(--surface-3)" }}
                  role="progressbar"
                  aria-label={`${category.name} puanı`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={category.score}
                >
                  <span className="block h-full rounded-full" style={{ width: `${category.score}%`, background: "var(--accent)" }} />
                  <span
                    className="absolute top-[-3px] h-4 w-px"
                    style={{ left: `${category.benchmark}%`, background: "var(--ink)" }}
                    title={`Sektör kıyası: ${category.benchmark}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          className="xl:col-span-2"
          title="Şirket ölçeğine göre"
          description="Yanıt sayısı ve ortalama puan"
        >
          <div className="space-y-4">
            {demo.companySizes.map((size) => (
              <div key={size.label} className="rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="t-sm" style={{ color: "var(--ink-2)" }}>{size.label}</span>
                  <span className="t-subhead tabular">%{decimal.format(size.score)}</span>
                </div>
                <p className="mt-1 t-caption tabular" style={{ color: "var(--ink-3)" }}>{integer.format(size.count)} yanıt</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Sektör karşılaştırması"
        description="Anonim toplu sonuçlar; hiçbir üyenin tekil yanıtı gösterilmez"
      >
        <div className="overflow-x-auto">
          <table className="theme-table">
            <thead>
              <tr><th>Sektör</th><th>Yanıt</th><th>Katılım</th><th>Ortalama puan</th><th>Oda ortalamasına göre</th></tr>
            </thead>
            <tbody>
              {demo.sectors.map((sector) => {
                const difference = sector.score - demo.results.overallScore;
                return (
                  <tr key={sector.name}>
                    <td className="font-medium" style={{ color: "var(--ink)" }}>{sector.name}</td>
                    <td className="tabular">{integer.format(sector.responses)}</td>
                    <td className="tabular">%{integer.format(sector.participation)}</td>
                    <td className="tabular font-medium">%{decimal.format(sector.score)}</td>
                    <td className="tabular" style={{ color: difference >= 0 ? "var(--success)" : "var(--ink-3)" }}>
                      {difference >= 0 ? "+" : ""}{decimal.format(difference)} puan
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Yönetici içgörüleri"
        description="Oda programlarını ve üye desteklerini planlamak için öne çıkan bulgular"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {demo.insights.map((insight) => (
            <div key={insight.title} className="flex items-start gap-3 rounded-[var(--radius-md)] p-4" style={{ background: "var(--surface-2)" }}>
              <span className="mt-0.5 shrink-0" style={{ color: insightColor[insight.tone] }} aria-hidden="true">
                {insight.tone === "success" ? <ArrowUpRight size={18} /> : <Info size={18} />}
              </span>
              <div>
                <h3 className="t-label">{insight.title}</h3>
                <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div
        className="flex items-start gap-3 rounded-[var(--radius-lg)] p-4 t-sm"
        style={{ background: "var(--accent-faint)", border: "1px solid var(--line)", color: "var(--ink-2)" }}
      >
        <EyeOff size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
        <p>
          Bu ekran yalnızca ürün gösterimi için hazırlanmış kurgu veriler içerir. Gerçek oda, üye, cevap veya müşteri kaydı oluşturulmamıştır.
        </p>
      </div>
    </div>
  );
}

const insightColor = {
  success: "var(--success)",
  warning: "var(--warning)",
  accent: "var(--accent)",
  danger: "var(--error)",
} as const;

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label} <strong className="font-medium tabular" style={{ color: "var(--ink)" }}>{integer.format(value)}</strong>
    </span>
  );
}

function ResponseTrendChart() {
  const width = 760;
  const height = 220;
  const left = 38;
  const right = 16;
  const top = 16;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = demo.participation.submitted;
  const points = demo.responseTrend.map((item, index) => ({
    ...item,
    x: left + (index / (demo.responseTrend.length - 1)) * plotWidth,
    y: top + plotHeight - (item.cumulative / max) * plotHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`;

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="3 Ağustos'ta 118 yanıtla başlayıp 22 Ağustos'ta 2.000 yanıta ulaşan kümülatif yanıt grafiği"
      >
        {[0, 500, 1000, 1500, 2000].map((tick) => {
          const y = top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--chart-axis-text)">{tick === 0 ? "0" : integer.format(tick)}</text>
            </g>
          );
        })}
        <polygon points={area} fill="var(--accent-faint)" />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3} fill="var(--accent)" stroke="var(--chart-point-ring)" strokeWidth="2" />
            {(index % 2 === 0 || index === points.length - 1) && (
              <text x={point.x} y={height - 10} textAnchor="middle" fontSize="11" fill="var(--chart-axis-text)">{point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
