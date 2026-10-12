"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Gauge, Lightbulb } from "lucide-react";
import Panel from "./ui/panel";
import StatCard from "./ui/stat-card";
import { Button } from "./ui/button";
import type { UnitManagementDashboard } from "@/lib/unit-management";
import { decimal, percentage, signed, esgSymbol, QUADRANT_LABELS, STRATEGY_LABELS, PORTFOLIO_STATUS_LABELS, TIMEFRAME_LABELS } from "@/lib/unit-management-display";
import { unitDate, UNIT_RESULT_LABELS } from "@/lib/unit-dashboard-display";

const COLORS = ["var(--ink-3)", "var(--warning)", "var(--accent)", "var(--series-2)", "var(--series-4)"];
const AXIS_COLORS = ["var(--series-2)", "var(--warning)", "var(--accent)", "var(--ink-3)"];
const n = (value: number) => value.toLocaleString("tr-TR");
const empty = (text = "Seçili kapsamda henüz sonuç yok.") => <p className="t-sm text-[var(--ink-2)]">{text}</p>;
export const assessmentLink = (row: { unitId: string; assessmentId: string | null; id?: string; surveyId: string }, tab = "results") => {
  const params = new URLSearchParams({ unitId: row.unitId, surveyId: row.surveyId, tab });
  if (row.assessmentId) params.set("assessmentId", row.assessmentId);
  else if (row.id) params.set("selection", row.id);
  return "/dashboard?" + params.toString();
};
function Bar({ label, value, benchmark, color = "var(--accent)" }: { label: string; value: number | null; benchmark?: number | null; color?: string }) {
  return <div className="relative h-2.5 rounded-full bg-[var(--surface-2)]" role={value === null ? "img" : "progressbar"} aria-label={label + (value === null ? ": veri yok" : " puanı")} aria-valuemin={value === null ? undefined : 0} aria-valuemax={value === null ? undefined : 100} aria-valuenow={value ?? undefined}>
    {value !== null && <span className="block h-full rounded-full" style={{ width: Math.min(100, Math.max(0, value)) + "%", background: color }} />}
    {benchmark != null && <span className="absolute -top-1 h-4 w-px bg-[var(--ink)]" style={{ left: benchmark + "%" }} title={"Sektör kıyası " + percentage(benchmark)} />}
  </div>;
}
function Legend({ color, label, value }: { color: string; label: string; value: number | string }) {
  return <span className="flex items-center gap-2 t-sm text-[var(--ink-2)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />{label}<strong className="tabular font-medium text-[var(--ink)]">{value}</strong></span>;
}

export function UnitManagementPanels({ data }: { data: UnitManagementDashboard }) {
  const { analytics: a, selection: s } = data;
  const esg = a.results.categories.some(category => esgSymbol(category.name));
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Atanmış birim" value={n(a.participation.total)} note={n(a.scope.unitCount) + " birim · " + n(a.scope.activeUserCount) + " kayıtlı kullanıcı"} />
      <StatCard label="Tamamlanan yanıt" value={n(a.participation.submitted)} note="Kesinleşmiş gönderim" tone="success" />
      <StatCard label="Gönderim oranı" value={percentage(a.participation.completionRate)} note="Gönderilmiş değerlendirme / atama" tone="accent" />
      <StatCard label="Devam eden" value={n(a.participation.inProgress)} note={n(a.participation.notStarted) + " birim başlamadı · " + n(a.participation.readyToSubmit) + " gönderime hazır"} tone="warning" />
    </div>
    <Panel title="Katılım durumu" description={n(a.participation.total) + " atanmış birimin değerlendirme durumu"} actions={<span className="t-metric tabular">{percentage(a.participation.completionRate)}</span>}>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={`${a.participation.submitted} tamamlandı, ${a.participation.inProgress} devam ediyor, ${a.participation.notStarted} başlamadı`}>
        {[[a.participation.submitted, "var(--series-2)"], [a.participation.inProgress, "var(--warning)"], [a.participation.notStarted, "var(--ink-3)"]].map(([count, color], i) => <span key={i} style={{ width: (a.participation.total ? Number(count) / a.participation.total * 100 : 0) + "%", background: String(color) }} />)}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2"><Legend color="var(--series-2)" label="Tamamlandı" value={n(a.participation.submitted)} /><Legend color="var(--warning)" label="Devam ediyor" value={n(a.participation.inProgress)} /><Legend color="var(--ink-3)" label="Başlamadı" value={n(a.participation.notStarted)} /></div>
      {a.participation.overdue > 0 && <p className="mt-3 t-sm text-[var(--warning)]">{a.participation.overdue} değerlendirmenin son tarihi geçti.</p>}
    </Panel>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Ortalama olgunluk" value={percentage(a.results.average)} note={n(a.results.count) + (s.basis === "submitted" ? " gönderilmiş sonuç" : " cevap girilen değerlendirme · taslaklar dahil")} tone="accent" />
      <StatCard label="Medyan puan" value={percentage(a.results.median)} note={"Taban ortalaması " + percentage(a.results.baseline)} />
      <StatCard label="En yaygın seviye" value={a.results.leadingMaturity ?? "—"} note={a.results.count ? a.results.leadingCount + " değerlendirme · " + percentage(a.results.leadingCount / a.results.count * 100) : "Sonuç oluşmadı"} />
      <StatCard label="Sektör kıyası farkı" value={signed(a.results.difference)} note={a.results.benchmarkCount ? a.results.benchmarkCount + " eşleşen sektör kıyası · puan" : "Kayıtlı sektör kıyası yok"} tone={a.results.difference !== null && a.results.difference >= 0 ? "success" : "neutral"} />
    </div>
    <Panel title={esg ? "E–S–G değerlendirmesi" : "Kategori değerlendirmesi"} description={esg ? "Çevresel, sosyal ve yönetişim sonuçları ile sektör kıyasları" : "Kategori sonuçları ve değerlendirme ağırlıkları"} actions={<span className="badge badge-primary">Genel skor {percentage(a.results.average)}</span>}>
      {!a.results.categories.length ? empty() : <div className="grid gap-4 lg:grid-cols-3">{a.results.categories.map((category, i) => <article key={category.id} className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-5">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="t-subhead">{esgSymbol(category.name) && <span className="mr-2" style={{ color: AXIS_COLORS[i % 4] }}>{esgSymbol(category.name)}</span>}{category.name}</h3><p className="mt-1 t-caption text-[var(--ink-3)]">{percentage(category.weight)} soru ağırlığı · {category.count} sonuç</p></div><div className="text-right"><p className="t-metric tabular">{percentage(category.average)}</p><p className="t-caption text-[var(--series-2)]">Gelişim {signed(category.gain)} puan</p></div></div>
        <div className="mt-5 mb-2 flex flex-wrap justify-between gap-2 t-caption text-[var(--ink-3)]"><span>Taban {percentage(category.baseline)}</span><span>Sektör kıyası {percentage(category.benchmark)}</span></div>
        <Bar label={category.name} value={category.average} benchmark={category.benchmark} color={AXIS_COLORS[i % 4]} />
        <ul className="mt-5 space-y-2 t-sm text-[var(--ink-2)]">{category.sections.slice(0, 4).map(section => <li key={section.id ?? "direct"} className="flex justify-between gap-3"><span>{section.name}</span><span className="tabular whitespace-nowrap">{percentage(section.average)}</span></li>)}</ul>
        {category.sections.length > 4 && <p className="mt-3 t-caption text-[var(--ink-3)]">{category.sections.length - 4} bölüm daha · detaylar birim sonuçlarında</p>}
      </article>)}</div>}
    </Panel>
    <div className="grid gap-6 xl:grid-cols-5">
      <Panel className="xl:col-span-3" title="Yanıtların gelişimi" description="Başlatılan değerlendirmeler ve kesinleşen gönderimlerin kümülatif sayısı"><ResponseTrend data={a.trend} /></Panel>
      <Panel className="xl:col-span-2" title="Olgunluk dağılımı" description={a.results.count + " değerlendirme · seçili sonuç kapsamı"}>
        {a.results.count === 0 ? empty() : <><div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={a.results.distribution.map(item => `${item.label} ${item.count}`).join(", ")}>{a.results.distribution.map((item, i) => <span key={item.label} style={{ width: item.count / a.results.count * 100 + "%", background: COLORS[i] }} />)}</div><div className="mt-6 space-y-3">{a.results.distribution.map((item, i) => <div key={item.label} className="flex justify-between gap-3"><Legend color={COLORS[i]} label={item.label} value={n(item.count)} /><span className="t-sm tabular text-[var(--ink-3)]">{percentage(item.count / a.results.count * 100)}</span></div>)}</div></>}
      </Panel>
    </div>
    <Panel title="Ironman analizi" description="Hız ve dayanıklılık eksenlerindeki toplu konum · 1–5 ölçeği" actions={a.ironman.quadrant && <span className="badge badge-success"><Gauge size={13} />{QUADRANT_LABELS[a.ironman.quadrant]}</span>}>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <IronmanChart data={a.ironman} />
        <div><div className="grid grid-cols-2 gap-3"><Metric label="Hız" value={decimal(a.ironman.velocity)} note={"Kıyas " + decimal(a.ironman.benchmarkVelocity)} /><Metric label="Dayanıklılık" value={decimal(a.ironman.endurance)} note={"Kıyas " + decimal(a.ironman.benchmarkEndurance)} /></div>
          <p className="mt-4 t-sm text-[var(--ink-2)]">{a.ironman.count} değerlendirmede iki eksen birlikte ölçüldü. Kadran eşiği {decimal(a.ironman.threshold)}.</p>
          <p className="mt-2 t-caption text-[var(--ink-3)]">Ortalama soru kapsamı: {decimal(a.ironman.questionMix.velocity)} hız + {decimal(a.ironman.questionMix.endurance)} dayanıklılık sorusu.</p>
          <h3 className="mt-6 t-label">Birim dağılımı</h3><div className="mt-3 space-y-3">{a.ironman.distribution.map((item, i) => <div key={item.key}><div className="mb-2 flex justify-between gap-3"><Legend color={AXIS_COLORS[i]} label={QUADRANT_LABELS[item.key]} value={item.count} /><span className="t-caption tabular text-[var(--ink-3)]">{a.ironman.count ? percentage(item.count / a.ironman.count * 100) : "—"}</span></div><Bar label={QUADRANT_LABELS[item.key] + " dağılımı"} value={a.ironman.count ? item.count / a.ironman.count * 100 : null} color={AXIS_COLORS[i]} /></div>)}</div>
        </div>
      </div>
    </Panel>
    <div className="grid gap-6 xl:grid-cols-5">
      <Panel className="xl:col-span-3" title="Sürdürülebilirlik başlıkları" description="Kategori ortalaması ve kayıtlı sektör kıyası · 100 üzerinden">
        {!a.results.categories.length ? empty() : <div className="space-y-5">{a.results.categories.map(category => <div key={category.id}><div className="mb-2 flex justify-between gap-3 t-sm"><span>{category.name}</span><span className="tabular whitespace-nowrap">{percentage(category.average)} · kıyas {percentage(category.benchmark)}</span></div><Bar label={category.name + " karşılaştırması"} value={category.average} benchmark={category.benchmark} /></div>)}</div>}
      </Panel>
      <Panel className="xl:col-span-2" title="Şirket ölçeğine göre" description="Kuruluş profilindeki çalışan sayısına göre karşılaştırma">
        <div className="space-y-3">{a.companySizes.filter(item => item.unitCount || ["Mikro (1–9)", "Küçük (10–49)", "Orta (50–249)", "Büyük (250+)"].includes(item.label)).map(item => <div key={item.label} className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><div className="flex justify-between gap-3"><span className="t-sm">{item.label}</span><strong className="tabular">{percentage(item.average)}</strong></div><p className="mt-1 t-caption text-[var(--ink-3)]">{item.unitCount} birim · {item.count} sonuç</p></div>)}</div>
        {a.companySizes.some(item => item.label === "Belirtilmedi" && item.unitCount) && <p className="mt-4 t-sm text-[var(--ink-2)]">Çalışan sayısını “Kuruluş profili” alanından girerek ölçek karşılaştırmasını tamamlayabilirsiniz.</p>}
      </Panel>
    </div>
    <Panel title="Sektör karşılaştırması" description="Seçili birimlerin sektörlerine göre sonuçlar ve kayıtlı kıyaslar">
      <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Sektör</th><th>Birim</th><th>Sonuç</th><th>Gönderim</th><th>Ortalama puan</th><th>Sektör kıyası</th><th>Fark</th></tr></thead><tbody>{a.sectors.map(item => <tr key={item.id}><td>{item.name}</td><td className="tabular">{item.unitCount}</td><td className="tabular">{item.count}</td><td className="tabular">{item.assigned ? percentage(item.submitted / item.assigned * 100) : "—"}</td><td className="tabular">{percentage(item.average)}</td><td className="tabular">{percentage(item.benchmark)}</td><td className="tabular">{signed(item.difference)}</td></tr>)}</tbody></table></div>
    </Panel>
    <RecommendationPortfolio data={data} />
    <Panel title="Yönetici içgörüleri" description="Seçili kapsamın sonuçlarından ve bekleyen işlerden öne çıkan bulgular">
      {!a.insights.length ? empty("Cevaplar ve yol haritası işleri oluştuğunda içgörüler burada görünür.") : <div className="grid gap-4 md:grid-cols-2">{a.insights.map(insight => <article key={insight.title} className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><ArrowUpRight size={18} aria-hidden="true" className="mt-1 shrink-0" style={{ color: insight.tone === "warning" ? "var(--warning)" : insight.tone === "success" ? "var(--series-2)" : "var(--accent)" }} /><div><h3 className="t-label">{insight.title}</h3><p className="mt-1 t-sm text-[var(--ink-2)]">{insight.description}</p></div></article>)}</div>}
    </Panel>
    <Panel title="Birim değerlendirmeleri" description="Sonuç, görev dağılımı ve yol haritasına birim bazında geçin">
      <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Birim</th><th>Durum</th><th>Tamamlanma</th><th>Puan</th><th>Son tarih</th><th>İşlem</th></tr></thead><tbody>{a.members.map(row => <tr key={row.id}><td>{row.unitName}</td><td>{UNIT_RESULT_LABELS[row.status]}</td><td className="tabular">{row.assessmentId ? row.responseCount + "/" + row.totalQuestions + " · " + percentage(row.completionPercentage) : "Henüz başlamadı"}</td><td className="tabular">{percentage(row.score)}</td><td>{unitDate(row.deadline)}</td><td><Button asChild variant="link"><Link href={assessmentLink(row)}>{row.assessmentId ? "Sonucu görüntüle" : "Değerlendirmeyi aç"}</Link></Button></td></tr>)}{!a.members.length && <tr><td colSpan={6}>Bu birim ve dönemde atanmış değerlendirme yok.</td></tr>}</tbody></table></div>
    </Panel>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><p className="t-label text-[var(--ink-2)]">{label}</p><p className="mt-2 t-metric tabular">{value}</p><p className="mt-1 t-caption text-[var(--ink-3)]">{note}</p></div>;
}
function ResponseTrend({ data }: { data: UnitManagementDashboard["analytics"]["trend"] }) {
  if (!data.length) return empty("Henüz başlatılmış değerlendirme veya kesinleşmiş gönderim yok.");
  const left = 45, top = 18, width = 670, height = 175;
  const max = Math.max(1, ...data.map(item => Math.max(item.started, item.submitted)));
  const first = new Date(data[0].date + "T00:00:00Z").getTime();
  const last = new Date(data.at(-1)!.date + "T00:00:00Z").getTime();
  const x = (date: string) => left + (last === first ? 0.5 : (new Date(date + "T00:00:00Z").getTime() - first) / (last - first)) * width;
  const y = (value: number) => top + height - value / max * height;
  return <><svg viewBox="0 0 750 240" role="img" aria-label={`Değerlendirme gelişimi: ${data.at(-1)!.started} başlatıldı, ${data.at(-1)!.submitted} gönderildi`} className="h-auto w-full">
    {[0, Math.ceil(max / 2), max].filter((tick, i, arr) => arr.indexOf(tick) === i).map(tick => <g key={tick}><line x1={left} y1={y(tick)} x2={left + width} y2={y(tick)} stroke="var(--line)" /><text x={left - 10} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)">{tick}</text></g>)}
    {(["started", "submitted"] as const).map((key, index) => <g key={key}><polyline points={data.map(item => `${x(item.date)},${y(item[key])}`).join(" ")} stroke={index ? "var(--series-2)" : "var(--accent)"} strokeDasharray={index ? "5 3" : undefined} strokeWidth="3" fill="none" />{data.map(item => <circle key={item.date} cx={x(item.date)} cy={y(item[key])} r="3" fill={index ? "var(--series-2)" : "var(--accent)"}><title>{item.date}: {item[key]} {index ? "gönderilmiş" : "başlatılmış"}</title></circle>)}</g>)}
    {[data[0], ...(data.length > 1 ? [data.at(-1)!] : [])].map(item => <text key={item.date} x={x(item.date)} y="226" textAnchor="middle" fill="var(--ink-3)" fontSize="12">{unitDate(item.date + "T00:00:00Z")}</text>)}
  </svg><div className="mt-3 flex flex-wrap gap-5"><Legend color="var(--accent)" label="Başlatılan" value={data.at(-1)!.started} /><Legend color="var(--series-2)" label="Gönderilen" value={data.at(-1)!.submitted} /></div></>;
}
function IronmanChart({ data }: { data: UnitManagementDashboard["analytics"]["ironman"] }) {
  const x = (score: number) => 60 + (score - 1) / 4 * 400;
  const y = (score: number) => 430 - (score - 1) / 4 * 400;
  return <div><svg viewBox="0 0 520 490" className="h-auto w-full max-h-[450px]" role="img" aria-label={data.quadrant ? `Ironman kadranı: ${QUADRANT_LABELS[data.quadrant]}, hız ${decimal(data.velocity)}, dayanıklılık ${decimal(data.endurance)}` : "Ironman kadranı: iki eksende henüz sonuç yok"}>
    <rect x="60" y="30" width="400" height="400" rx="6" fill="var(--surface-2)" />
    {[1, 2, 3, 4, 5].map(tick => <g key={tick}><line x1={x(tick)} y1="30" x2={x(tick)} y2="430" stroke="var(--line)" strokeDasharray={tick === data.threshold ? "5 4" : undefined} /><line x1="60" y1={y(tick)} x2="460" y2={y(tick)} stroke="var(--line)" strokeDasharray={tick === data.threshold ? "5 4" : undefined} /><text x={x(tick)} y="450" textAnchor="middle" fontSize="12" fill="var(--ink-3)">{tick}</text><text x="42" y={y(tick) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)">{tick}</text></g>)}
    {[["Maraton Koşucusu", 160, 60], ["Demir Adam", 360, 60], ["Yaya", 160, 407], ["Sprinter", 360, 407]].map(([label, px, py]) => <text key={label} x={Number(px)} y={Number(py)} textAnchor="middle" fill="var(--ink-3)" fontSize="12">{label}</text>)}
    {data.benchmarkVelocity != null && data.benchmarkEndurance != null && <rect x={x(data.benchmarkVelocity) - 5} y={y(data.benchmarkEndurance) - 5} width="10" height="10" fill="var(--ink-3)"><title>Sektör kıyası</title></rect>}
    {data.targetVelocity != null && data.targetEndurance != null && <circle cx={x(data.targetVelocity)} cy={y(data.targetEndurance)} r="8" fill="none" stroke="var(--ink)" strokeWidth="2"><title>Kayıtlı referans hedef</title></circle>}
    {data.velocity != null && data.endurance != null && <circle cx={x(data.velocity)} cy={y(data.endurance)} r="8" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="3"><title>Seçili kapsamın mevcut konumu</title></circle>}
    <text x="260" y="480" textAnchor="middle" fontSize="13" fill="var(--ink-2)">Hız</text><text x="16" y="230" textAnchor="middle" transform="rotate(-90 16 230)" fontSize="13" fill="var(--ink-2)">Dayanıklılık</text>
  </svg><div className="flex flex-wrap gap-4 t-caption text-[var(--ink-2)]"><span>● Mevcut konum</span><span>■ Kayıtlı sektör kıyası</span><span>○ Referans hedef</span></div></div>;
}
function RecommendationPortfolio({ data }: { data: UnitManagementDashboard }) {
  const p = data.analytics.portfolio;
  const [limit, setLimit] = useState(10);
  const [strategy, setStrategy] = useState("all");
  const rows = p.rows.filter(rec => strategy === "all" || rec.strategicType === strategy);
  return <Panel title="Öneri portföyü" description="Birimlerin cevaplarından türetilen öneriler ve yol haritasındaki uygulama durumu" actions={<span className="badge badge-primary"><Lightbulb size={13} />{p.total} öneri</span>}>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Yüksek öncelik" value={n(p.highPriority)} note="Etki 8+ ve uygulanabilir" /><Metric label="Potansiyel erişim" value={n(p.memberReach)} note="Uygulanabilir önerisi olan birim" /><Metric label="Hızlı kazanım" value={n(p.byStrategy.find(item => item.key === "QUICK_WIN")?.count ?? 0)} note="0–6 ay" /><Metric label="Potansiyel artış" value={signed(p.potentialGain)} note="Birim başına en yüksek katkılı tek adım · puan" /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><h3 className="mb-3 t-label">Strateji türü</h3><div className="flex h-3 overflow-hidden rounded-full bg-[var(--canvas)]" role="img" aria-label={p.byStrategy.map(item => `${STRATEGY_LABELS[item.key]} ${item.count}`).join(", ")}>{p.byStrategy.map((item, i) => <span key={item.key} style={{ width: (p.total ? item.count / p.total * 100 : 0) + "%", background: AXIS_COLORS[i] }} />)}</div><div className="mt-3 flex flex-wrap gap-4">{p.byStrategy.map((item, i) => <Legend key={item.key} color={AXIS_COLORS[i]} label={STRATEGY_LABELS[item.key]} value={item.count} />)}</div></div><div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4"><h3 className="mb-3 t-label">Uygulama durumu</h3><div className="grid grid-cols-3 gap-3">{p.byStatus.map(item => <div key={item.key}><p className="t-caption text-[var(--ink-3)]">{PORTFOLIO_STATUS_LABELS[item.key]}</p><p className="mt-1 t-subhead tabular">{item.count}</p></div>)}</div><p className="mt-3 t-caption text-[var(--ink-3)]">Durumlar birim ve öneri eşleşmesi başına sayılır.</p></div></div>
    <div className="mt-5 flex justify-end"><label className="sr-only" htmlFor="portfolio-strategy">Öneri türüne göre filtrele</label><select id="portfolio-strategy" className="theme-select" value={strategy} onChange={event => { setStrategy(event.target.value); setLimit(10); }}><option value="all">Bütün öneri türleri</option>{Object.entries(STRATEGY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div className="mt-4 overflow-x-auto"><table className="theme-table"><thead><tr><th>Önerilen adım</th><th>Kategori</th><th>Tür / maliyet</th><th>Birim erişimi</th><th>Etki</th><th>Vade</th><th>Durum</th></tr></thead><tbody>{rows.slice(0, limit).map(rec => <tr key={rec.id}><td className="min-w-[260px]"><p className="font-medium text-[var(--ink)]">{rec.title}</p><p className="mt-1 t-caption text-[var(--ink-3)]">{rec.description}</p></td><td>{rec.categoryName ?? "Genel"}</td><td><span className="badge badge-neutral">{STRATEGY_LABELS[rec.strategicType]}</span><p className="mt-2 t-caption">{rec.costType === "CAPEX" ? "Yatırım" : "İşletme"} · seviye {rec.costType === "CAPEX" ? rec.capexLevel : rec.opexLevel}</p></td><td><details><summary className="cursor-pointer whitespace-nowrap">{rec.units.length} birim</summary><ul className="mt-2 space-y-2">{rec.units.map(unit => <li key={unit.unitId}><Link className="text-[var(--accent)] underline" href={assessmentLink({ ...unit, surveyId: data.selection.surveyId! }, "recommendations")}>{unit.unitName}</Link></li>)}</ul></details></td><td className="tabular">{decimal(rec.estimatedImpact)}/10</td><td className="whitespace-nowrap">{TIMEFRAME_LABELS[rec.timeframe]}</td><td><ul className="space-y-1">{[...new Set(rec.units.map(unit => unit.status))].map(status => <li key={status} className="t-caption">{PORTFOLIO_STATUS_LABELS[status]} · {rec.units.filter(unit => unit.status === status).length}</li>)}</ul></td></tr>)}{!rows.length && <tr><td colSpan={7}>Bu kapsamda uygulanabilir öneri veya yol haritası işi yok.</td></tr>}</tbody></table></div>
    {rows.length > limit && <Button className="mt-4" variant="outline" onClick={() => setLimit(value => value + 10)}>Daha fazla göster ({rows.length - limit})</Button>}
  </Panel>;
}
