"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Gauge, Lightbulb, Send, Users } from "lucide-react";
import Panel from "./ui/panel";
import StatCard from "./ui/stat-card";
import { Button } from "./ui/button";
import { UnitRoadmapPanel } from "./unit-management-roadmap";
import { empty, Legend, Metric, Toggle, type MemberHref } from "./unit-management-shared";
import type { UnitManagementDashboard } from "@/lib/unit-management";
import { decimal, percentage, signed, ironmanInsight, LEVEL_COLORS, QUADRANT_LABELS } from "@/lib/unit-management-display";
import { unitDate, UNIT_RESULT_LABELS } from "@/lib/unit-dashboard-display";

type Analytics = UnitManagementDashboard["analytics"];
const statusLabel = (status: string | null) => status ? UNIT_RESULT_LABELS[status] ?? status : "Atanmadı";

/** Olgunluk seviyelerinin dağılımı: tek renkli rampa, seviye adı ve sayısı yanında. */
function LevelBar({ levels, total }: { levels: { label: string; count: number }[]; total: number }) {
  return <div>
    <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--canvas)]" role="img" aria-label={"Olgunluk seviyeleri: " + levels.map(level => level.label + " " + level.count).join(", ")}>
      {levels.map((level, i) => level.count > 0 && <span key={level.label} style={{ width: level.count / total * 100 + "%", background: LEVEL_COLORS[i] }} />)}
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{levels.map((level, i) => <Legend key={level.label} color={LEVEL_COLORS[i]} label={level.label} value={level.count} />)}</div>
  </div>;
}

/** Her üye bir nokta; ortalama dikey çizgi, sektör kıyası kesik çizgi. Ortalamanın gizlediği dağılımı gösterir. */
function StripPlot({ points, average, benchmark, label }: { points: { unitName: string; value: number }[]; average: number | null; benchmark: number | null; label: string }) {
  const x = (value: number) => 8 + Math.min(100, Math.max(0, value)) / 100 * 384;
  return <svg viewBox="0 0 400 52" className="h-12 w-full" role="img" aria-label={`${label}: ${points.length} üye, en düşük ${percentage(points.at(-1)?.value)}, en yüksek ${percentage(points[0]?.value)}, ortalama ${percentage(average)}`}>
    <line x1="8" x2="392" y1="20" y2="20" stroke="var(--line)" strokeWidth="2" />
    {[0, 40, 60, 80, 100].map(tick => <g key={tick}><line x1={x(tick)} x2={x(tick)} y1="15" y2="25" stroke="var(--line-strong)" /><text x={x(tick)} y="49" textAnchor={tick === 0 ? "start" : tick === 100 ? "end" : "middle"} fontSize="10" fill="var(--ink-3)">{tick}</text></g>)}
    {benchmark != null && <line x1={x(benchmark)} x2={x(benchmark)} y1="4" y2="36" stroke="var(--ink-3)" strokeDasharray="3 3"><title>Sektör kıyası {percentage(benchmark)}</title></line>}
    {points.map((point, i) => <circle key={point.unitName + i} cx={x(point.value)} cy="20" r="5" fill="var(--accent)" fillOpacity="0.55" stroke="var(--surface-2)"><title>{point.unitName}: {percentage(point.value)}</title></circle>)}
    {average != null && <line x1={x(average)} x2={x(average)} y1="6" y2="34" stroke="var(--ink)" strokeWidth="2"><title>Ortalama {percentage(average)}</title></line>}
  </svg>;
}

function AnswerStrip({ a }: { a: Analytics }) {
  const { answer } = a;
  const action = answer.nextAction;
  return <section aria-label="Özet" className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Birim puanı" value={percentage(answer.score)}
        note={answer.score === null ? "Gönderilmiş sonuç yok" : [answer.change !== null ? `Önceki döneme göre ${signed(answer.change)} (${answer.pairedCount} üye)` : "Önceki dönem yok", answer.benchmarkDifference !== null ? `Sektöre göre ${signed(answer.benchmarkDifference)}` : null].filter(Boolean).join(" · ")} />
      <StatCard label="En düşük puanlı kategori" value={answer.lowestCategory ? <span className="t-title">{answer.lowestCategory.name} <span className="tabular">{percentage(answer.lowestCategory.average)}</span></span> : "—"}
        note={answer.lowestCategory ? `${answer.lowestCategory.belowDeveloping}/${answer.lowestCategory.count} üye Gelişen seviyesinin altında` : "Sonuç oluşmadı"} />
      <StatCard label="Öncelikli eylem" value={action ? <span className="t-subhead block">{action.title}</span> : "—"}
        note={action ? (action.kind === "untouched" ? `${action.reach} üyeye uygulanabilir, henüz başlanmadı` : `${action.reach} üyede açık · ${action.overdue} gecikmiş`) : "Açık öneri yok"} />
      <StatCard label="Veri durumu" value={<span className="tabular">{answer.data.submitted}/{answer.data.assigned}</span>}
        note={"üye gönderdi" + (answer.data.evidenceRequired ? ` · belgeli cevap ${answer.data.evidenceDocumented}/${answer.data.evidenceRequired}` : "")} />
    </div>
    {a.summary.length > 0 && <Panel title="Bulgular" padding="sm"><ul className="space-y-1.5 t-sm text-[var(--ink-2)]">{a.summary.map(text => <li key={text} className="flex gap-2"><Lightbulb size={14} aria-hidden="true" className="mt-1 shrink-0 text-[var(--ink-3)]" />{text}</li>)}</ul></Panel>}
  </section>;
}

function ParticipationPanel({ a, memberHref, onRemind, reminding }: { a: Analytics; memberHref: MemberHref; onRemind?: () => void; reminding: boolean }) {
  const p = a.participation;
  return <Panel title="Katılım" description={`${p.assigned} üyeye atandı · ${p.submitted} gönderdi${p.overdue ? ` · ${p.overdue} üyenin süresi geçti` : ""}`}
    actions={<>{onRemind && p.pending.length > 0 && <Button variant="outline" size="sm" loading={reminding} onClick={onRemind}><Send size={14} aria-hidden="true" />Hatırlatma gönder</Button>}<span className="t-sm text-[var(--ink-2)]">Gönderim oranı</span><span className="t-metric tabular">{percentage(p.completionRate)}</span></>}>
    <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-2)]" role="img" aria-label={`${p.submitted} gönderdi, ${p.inProgress} devam ediyor, ${p.notStarted} başlamadı`}>
      {([[p.submitted, "var(--series-2)"], [p.inProgress, "var(--warning)"], [p.notStarted, "var(--ink-3)"]] as const).map(([count, color], i) => <span key={i} style={{ width: (p.assigned ? count / p.assigned * 100 : 0) + "%", background: color }} />)}
    </div>
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2"><Legend color="var(--series-2)" label="Gönderdi" value={p.submitted} /><Legend color="var(--warning)" label="Devam ediyor" value={p.inProgress} /><Legend color="var(--ink-3)" label="Başlamadı" value={p.notStarted} />{p.unassigned > 0 && <span className="t-sm text-[var(--ink-3)]">{p.unassigned} üyeye bu dönemde anket atanmadı</span>}</div>
    {p.pending.length === 0 ? <p className="mt-4 t-sm text-[var(--ink-2)]">{p.assigned ? "Atanan bütün üyeler gönderdi." : "Seçili dönemde atanmış değerlendirme yok."}</p> :
      <div className="mt-5 overflow-x-auto"><table className="theme-table"><caption className="sr-only">Bekleyen üyeler</caption><thead><tr><th>Üye</th><th>Durum</th><th className="!text-right">Tamamlanma</th><th>Bekleyen iş</th><th>Son tarih</th><th>Son işlem</th><th><span className="sr-only">İşlem</span></th></tr></thead><tbody>
        {p.pending.map(row => <tr key={row.unitId}><td className="font-medium text-[var(--ink)]">{row.unitName}</td><td>{statusLabel(row.status)}{row.overdue && <span className="ml-2 badge badge-warning">Süre geçti</span>}</td>
          <td className="text-right tabular">{row.completion === null ? "—" : "%" + row.completion}</td><td>{row.nextGap ? <>{row.nextGap.title}<span className="block t-sm text-[var(--ink-3)]">{row.nextGap.assigneeName}</span></> : "—"}</td>
          <td>{unitDate(row.deadline)}</td><td>{unitDate(row.lastActivityAt)}</td>
          <td><Button asChild variant="link"><Link href={row.assessmentId ? "/unit-manager/assignments?" + new URLSearchParams({ assessmentId: row.assessmentId, surveyId: row.surveyId ?? "", unitId: row.unitId }) : memberHref(row)}>{row.assessmentId ? "Görevleri aç" : "Üye panosu"}</Link></Button></td></tr>)}
      </tbody></table></div>}
  </Panel>;
}

function CategoryPanel({ a }: { a: Analytics }) {
  return <Panel title="Kategoriler" description="Gönderilen değerlendirmelerin kategori puanları · 100 üzerinden · her nokta bir üye">
    {!a.categories.length || a.results.count === 0 ? empty() : <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{a.categories.map(category => <article key={category.id} className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-5">
      <div className="flex items-start justify-between gap-4"><h3 className="t-subhead">{category.name}</h3><p className="t-metric tabular">{percentage(category.average)}</p></div>
      <p className="mt-1 t-sm text-[var(--ink-3)]">{[`Medyan ${percentage(category.median)}`, category.benchmark !== null ? `Sektör ${percentage(category.benchmark)}` : null, category.change !== null ? `Önceki döneme göre ${signed(category.change)} (${category.pairedCount} üye)` : null].filter(Boolean).join(" · ")}</p>
      <div className="mt-3"><StripPlot points={category.points} average={category.average} benchmark={category.benchmark} label={category.name + " dağılımı"} /></div>
      {category.count > 0 && <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 t-sm">
        <div><dt className="text-[var(--ink-3)]">En yüksek</dt><dd className="text-[var(--ink)]">{category.highest!.unitName} <span className="tabular">{percentage(category.highest!.value)}</span></dd></div>
        <div><dt className="text-[var(--ink-3)]">En düşük</dt><dd className="text-[var(--ink)]">{category.lowest!.unitName} <span className="tabular">{percentage(category.lowest!.value)}</span></dd></div>
        <div className="col-span-2"><dt className="sr-only">Ortalamaya göre</dt><dd className="text-[var(--ink-2)]">Ortalamanın üstünde {category.above} · altında {category.below} üye</dd></div>
      </dl>}
      <div className="mt-4"><LevelBar levels={category.levels} total={category.count || 1} /></div>
      {category.lowestQuestion && <p className="mt-4 border-t border-[var(--line)] pt-3 t-sm text-[var(--ink-2)]"><span className="text-[var(--ink-3)]">En düşük cevaplanan soru: </span>{category.lowestQuestion.text} <span className="tabular whitespace-nowrap text-[var(--ink-3)]">· alt yarıda {category.lowestQuestion.low}/{category.lowestQuestion.answered} üye</span></p>}
    </article>)}</div>}
  </Panel>;
}

type SortKey = "name" | "score" | "change" | "benchmark" | `category:${string}`;
function MemberTable({ a, memberHref, onEditProfile }: { a: Analytics; memberHref: MemberHref; onEditProfile: () => void }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });
  const [grouping, setGrouping] = useState<"none" | "sector" | "size">("none");
  const averages = Object.fromEntries(a.categories.map(category => [category.id, category.average]));
  const valueOf = (row: Analytics["members"][number]) => sort.key === "name" ? null : sort.key === "score" ? row.score : sort.key === "change" ? row.change
    : sort.key === "benchmark" ? row.benchmarkDifference : row.categories[sort.key.slice(9)];
  const rows = [...a.members].sort((x, y) => {
    if (sort.key === "name") return (sort.desc ? -1 : 1) * x.unitName.localeCompare(y.unitName, "tr");
    const vx = valueOf(x), vy = valueOf(y);
    if (vx === null || vy === null) return vx === null && vy === null ? x.unitName.localeCompare(y.unitName, "tr") : vx === null ? 1 : -1;
    return (sort.desc ? vy - vx : vx - vy) || x.unitName.localeCompare(y.unitName, "tr");
  });
  const groupOf = (row: Analytics["members"][number]) => grouping === "sector" ? row.sectorName ?? "Sektör belirtilmedi" : grouping === "size" ? row.sizeLabel : "";
  const groups = grouping === "none" ? [["", rows] as const] : [...new Set(rows.map(groupOf))].sort((x, y) => x.localeCompare(y, "tr")).map(name => [name, rows.filter(row => groupOf(row) === name)] as const);
  const header = (key: SortKey, label: string, align = "!text-right") => <th key={key} className={align} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}>
    <button type="button" className={"uppercase tracking-[0.06em] hover:text-[var(--ink)] " + (sort.key === key ? "text-[var(--ink)]" : "")} onClick={() => setSort(current => ({ key, desc: current.key === key ? !current.desc : key !== "name" }))}>{label}{sort.key === key ? (sort.desc ? " ↓" : " ↑") : ""}</button></th>;
  const cell = (value: number | null, average: number | null) => value === null ? <span className="text-[var(--ink-3)]">—</span>
    : <span className="inline-flex items-center gap-1">{percentage(value)}{average !== null && value < average && <span title="Birim ortalamasının altında"><ChevronDown size={14} className="text-[var(--ink-3)]" aria-hidden="true" /><span className="sr-only">birim ortalamasının altında</span></span>}</span>;
  const columns = 6 + a.categories.length;
  return <Panel title="Üyeler" description="Genel ve kategori puanları · ⌄ işareti birim ortalamasının altını gösterir · gönderilmeyen üyeler puansız listelenir" padding="none"
    actions={<><Toggle label="Gruplama" value={grouping} options={[["none", "Gruplama yok"], ["sector", "Sektör"], ["size", "Ölçek"]]} onChange={setGrouping} /><Button variant="outline" size="sm" onClick={onEditProfile}><Users size={14} aria-hidden="true" />Çalışan sayısı</Button></>}>
    <div className="overflow-x-auto"><table className="theme-table"><thead><tr>
      {header("name", "Üye", "text-left")}{header("score", "Genel")}{a.categories.map(category => header(`category:${category.id}`, category.name))}
      {header("change", "Önceki döneme göre")}{header("benchmark", "Sektöre göre")}<th className="!text-right">Belgeli cevap</th><th>Durum</th>
    </tr></thead><tbody>
      {groups.map(([name, list]) => <GroupRows key={name || "all"} name={name} columns={columns} rows={list.map(row => <tr key={row.unitId}>
        <td><Link href={memberHref(row)} className="font-medium text-[var(--ink)] hover:underline">{row.unitName}</Link>{row.level && <span className="block t-sm text-[var(--ink-3)]">{row.level}</span>}</td>
        <td className="text-right tabular">{cell(row.score, a.results.average)}</td>
        {a.categories.map(category => <td key={category.id} className="text-right tabular">{cell(row.categories[category.id], averages[category.id])}</td>)}
        <td className="text-right tabular">{signed(row.change)}</td><td className="text-right tabular">{signed(row.benchmarkDifference)}</td>
        <td className="text-right tabular">{row.evidence.required ? `${row.evidence.documented}/${row.evidence.required}` : "—"}</td>
        <td>{statusLabel(row.status)}</td>
      </tr>)} />)}
      <tr><td className="font-medium text-[var(--ink)]">Birim ortalaması</td><td className="text-right tabular font-medium text-[var(--ink)]">{percentage(a.results.average)}</td>
        {a.categories.map(category => <td key={category.id} className="text-right tabular font-medium text-[var(--ink)]">{percentage(category.average)}</td>)}
        <td className="text-right tabular">{signed(a.results.change)}</td><td className="text-right tabular">{signed(a.results.difference)}</td><td colSpan={2} /></tr>
    </tbody></table></div>
  </Panel>;
}
function GroupRows({ name, columns, rows }: { name: string; columns: number; rows: React.ReactNode[] }) {
  return <>{name && <tr><th colSpan={columns} scope="colgroup" className="text-left">{name} · {rows.length} üye</th></tr>}{rows}</>;
}

function CommonGaps({ a }: { a: Analytics }) {
  return <Panel title="Ortak gelişim alanları" description="Birden çok üyenin cevabı, sorunun puan ölçeğinin alt yarısında kalan sorular. Ortak alan, grup düzeyinde tek bir programla ele alınabilir.">
    {!a.commonGaps.length ? empty(a.results.count < 2 ? "Ortak alanlar en az iki üye gönderdiğinde oluşur." : "Birden çok üyenin alt yarıda kaldığı soru yok.") :
      <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Soru</th><th className="!text-right">Alt yarıdaki üye</th><th>İlgili öneri</th></tr></thead><tbody>
        {a.commonGaps.map(gap => <tr key={gap.id}><td className="min-w-[280px]"><p className="text-[var(--ink)]">{gap.text}</p><p className="t-sm text-[var(--ink-3)]">{gap.categoryName} · {gap.sectionName}</p></td>
          <td className="text-right tabular whitespace-nowrap"><span className="text-[var(--ink)]">{gap.low}/{gap.answered}</span><span className="ml-2 text-[var(--ink-3)]">%{gap.share}</span>
            <div className="ml-auto mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true"><span className="block h-full bg-[var(--accent)]" style={{ width: gap.share + "%" }} /></div></td>
          <td>{gap.recommendation?.title ?? "—"}</td></tr>)}
      </tbody></table></div>}
  </Panel>;
}

function PeriodChange({ a, memberHref }: { a: Analytics; memberHref: MemberHref }) {
  const c = a.change;
  return <Panel title="Dönemler arası değişim" description="Anket puanı yalnızca cevaplardan hesaplanır; mevcut puan buna tamamlanan önerilerin katkısını ekler. Önceki dönemde beyan edilen gelişim, bu dönemin anketiyle ölçülenle karşılaştırılır.">
    {!c.pairedCount ? empty("Önceki dönemde de gönderen üye yok; karşılaştırma bir sonraki dönemde oluşur.") : <>
      <p className="mb-4 t-sm text-[var(--ink-2)]">Aynı {c.pairedCount} üyede anketle ölçülen ortalama değişim <strong className="tabular text-[var(--ink)]">{signed(c.measured)}</strong> puan; önceki dönemde beyan edilen ortalama gelişim <strong className="tabular text-[var(--ink)]">{signed(c.declared)}</strong> puan.</p>
      <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Üye</th><th>Önceki dönem</th><th className="!text-right">Önceki anket puanı</th><th className="!text-right">Bu dönem anket puanı</th><th className="!text-right">Ölçülen değişim</th><th className="!text-right">Önceki dönemde beyan edilen</th><th className="!text-right">Beyan − ölçüm</th></tr></thead><tbody>
        {c.rows.map(row => <tr key={row.unitId}><td><Link href={memberHref(row, "history")} className="text-[var(--ink)] hover:underline">{row.unitName}</Link></td><td>{row.previousPeriod}</td>
          <td className="text-right tabular">{percentage(row.previousSurvey)}</td><td className="text-right tabular">{percentage(row.currentSurvey)}</td>
          <td className="text-right tabular text-[var(--ink)]">{signed(row.measured)}</td><td className="text-right tabular">{signed(row.declared)}</td><td className="text-right tabular">{signed(row.gap)}</td></tr>)}
      </tbody></table></div></>}
  </Panel>;
}

function IronmanPanel({ a }: { a: Analytics }) {
  const ironman = a.ironman;
  const insight = ironmanInsight(ironman);
  return <Panel title="Ironman analizi" description="Hız: aksiyon alma · Dayanıklılık: aksiyonları politika ve süreçle kalıcı kılma · 1–5 ölçeği · her nokta bir üye"
    actions={ironman.quadrant && <span className="badge badge-neutral"><Gauge size={13} aria-hidden="true" />Birim ortalaması: {QUADRANT_LABELS[ironman.quadrant]}</span>}>
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      <IronmanChart data={ironman} />
      <div>
        <div className="grid grid-cols-2 gap-3">
          <Metric label="Hız" value={decimal(ironman.velocity)} note={"Sektör " + decimal(ironman.benchmarkVelocity)} />
          <Metric label="Dayanıklılık" value={decimal(ironman.endurance)} note={"Sektör " + decimal(ironman.benchmarkEndurance)} />
        </div>
        <section className="mt-5" aria-label="Ironman yorumu"><h3 className="flex items-center gap-2 t-label"><Lightbulb size={14} aria-hidden="true" />Bu grafik ne söylüyor?</h3>
          <p className="mt-2 t-sm text-[var(--ink)]">{insight.headline}</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 t-sm text-[var(--ink-2)]">{insight.points.map(point => <li key={point}>{point}</li>)}</ul></section>
      </div>
    </div>
  </Panel>;
}
function IronmanChart({ data }: { data: Analytics["ironman"] }) {
  const x = (score: number) => 60 + (Math.min(5, Math.max(1, score)) - 1) / 4 * 400;
  const y = (score: number) => 430 - (Math.min(5, Math.max(1, score)) - 1) / 4 * 400;
  return <div><svg viewBox="0 0 520 490" className="h-auto w-full max-h-[440px]" role="img" aria-label={data.quadrant ? `Ironman kadranı: birim ortalaması ${QUADRANT_LABELS[data.quadrant]}, hız ${decimal(data.velocity)}, dayanıklılık ${decimal(data.endurance)}; ${data.points.length} üye` : "Ironman kadranı: iki eksende henüz sonuç yok"}>
    <rect x="60" y="30" width="400" height="400" rx="6" fill="var(--surface-2)" />
    {[1, 2, 3, 4, 5].map(tick => <g key={tick}><line x1={x(tick)} y1="30" x2={x(tick)} y2="430" stroke="var(--line)" strokeDasharray={tick === data.threshold ? "5 4" : undefined} /><line x1="60" y1={y(tick)} x2="460" y2={y(tick)} stroke="var(--line)" strokeDasharray={tick === data.threshold ? "5 4" : undefined} /><text x={x(tick)} y="450" textAnchor="middle" fontSize="12" fill="var(--ink-3)">{tick}</text><text x="42" y={y(tick) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)">{tick}</text></g>)}
    {([["Maraton Koşucusu", "kalıcı ama yavaş", 160, 60], ["Demir Adam", "hızlı ve kalıcı", 360, 60], ["Yaya", "yavaş, kalıcı değil", 160, 398], ["Sprinter", "hızlı ama kalıcı değil", 360, 398]] as const).map(([label, hint, px, py]) => <g key={label}><text x={px} y={py} textAnchor="middle" fill="var(--ink-3)" fontSize="12">{label}</text><text x={px} y={py + 15} textAnchor="middle" fill="var(--ink-3)" fontSize="10" opacity="0.8">{hint}</text></g>)}
    {data.points.map(point => <circle key={point.unitId} cx={x(point.velocity)} cy={y(point.endurance)} r="6" fill="var(--ink-2)" fillOpacity="0.55"><title>{point.unitName}: hız {decimal(point.velocity)}, dayanıklılık {decimal(point.endurance)}</title></circle>)}
    {data.benchmarkVelocity != null && data.benchmarkEndurance != null && <rect x={x(data.benchmarkVelocity) - 5} y={y(data.benchmarkEndurance) - 5} width="10" height="10" fill="var(--ink-3)"><title>Sektör ortalaması</title></rect>}
    {data.targetVelocity != null && data.targetEndurance != null && <circle cx={x(data.targetVelocity)} cy={y(data.targetEndurance)} r="8" fill="none" stroke="var(--ink)" strokeWidth="2"><title>Sektörün gelecek yıl için beklenen ortalaması</title></circle>}
    {data.velocity != null && data.endurance != null && <circle cx={x(data.velocity)} cy={y(data.endurance)} r="9" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="3"><title>Birim ortalaması</title></circle>}
    <text x="260" y="480" textAnchor="middle" fontSize="13" fill="var(--ink-2)">Hız (aksiyon alma)</text><text x="16" y="230" textAnchor="middle" transform="rotate(-90 16 230)" fontSize="13" fill="var(--ink-2)">Dayanıklılık (kalıcılık)</text>
  </svg><div className="flex flex-wrap gap-4 t-sm text-[var(--ink-2)]"><span><span aria-hidden="true" className="text-[var(--accent)]">●</span> Birim ortalaması</span><span><span aria-hidden="true" className="text-[var(--ink-2)] opacity-60">●</span> Üye</span><span>■ Sektör ortalaması</span><span>○ Sektörün gelecek yıl hedefi</span></div></div>;
}

export function UnitManagementPanels({ data, memberHref, onEditProfile, onRemind, reminding }: {
  data: UnitManagementDashboard; memberHref: MemberHref; onEditProfile: () => void; onRemind?: () => void; reminding: boolean;
}) {
  const a = data.analytics;
  return <div className="space-y-6">
    <AnswerStrip a={a} />
    <ParticipationPanel a={a} memberHref={memberHref} onRemind={onRemind} reminding={reminding} />
    <CategoryPanel a={a} />
    <MemberTable a={a} memberHref={memberHref} onEditProfile={onEditProfile} />
    <CommonGaps a={a} />
    <UnitRoadmapPanel data={data} memberHref={memberHref} />
    <PeriodChange a={a} memberHref={memberHref} />
    <IronmanPanel a={a} />
  </div>;
}
