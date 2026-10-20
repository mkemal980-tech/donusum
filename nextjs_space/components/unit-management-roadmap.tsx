"use client";
import { useState } from "react";
import Link from "next/link";
import Panel from "./ui/panel";
import { Button } from "./ui/button";
import { empty, Metric, n, Toggle, type MemberHref } from "./unit-management-shared";
import type { UnitManagementDashboard } from "@/lib/unit-management";
import { rankRoadmapMembers, ROADMAP_RANK_LABELS, type RoadmapRankKey } from "@/lib/unit-management-roadmap";
import { percentage, signed, PORTFOLIO_STATUS_LABELS, STRATEGY_LABELS, TIMEFRAME_LABELS } from "@/lib/unit-management-display";
import { unitDate } from "@/lib/unit-dashboard-display";

type Roadmap = UnitManagementDashboard["analytics"]["roadmap"];
type Rec = Roadmap["recommendations"][number];
type ListKey = "untouched" | "stuck" | "adopted" | "all";
const LISTS: [ListKey, string][] = [["untouched", "Dokunulmamış fırsatlar"], ["stuck", "Takılanlar"], ["adopted", "En çok benimsenenler"], ["all", "Tüm öneriler"]];
const LIST_NOTES: Record<ListKey, string> = {
  untouched: "Birden çok üyeye uygulanabilir ama hiçbir üyenin yol haritasında olmayan öneriler. Grup düzeyinde tek bir programla ele alınabilir.",
  stuck: "Birden çok üyede yol haritasına alınmış ama tamamlanmamış öneriler; ortak bir engele işaret edebilir.",
  adopted: "En çok üyenin yol haritasına aldığı öneriler.",
  all: "Üyelere uygulanabilir veya yol haritasında olan bütün öneriler, etkiye göre.",
};
const monthLabel = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });

function Units({ rec, memberHref }: { rec: Rec; memberHref: MemberHref }) {
  return <details><summary className="cursor-pointer whitespace-nowrap">{rec.units.length} üye</summary><ul className="mt-2 space-y-1.5">
    {rec.units.map(unit => <li key={unit.unitId} className="t-sm"><Link className="text-[var(--accent)] underline" href={memberHref(unit, "recommendations")}>{unit.unitName}</Link><span className="text-[var(--ink-3)]"> · {PORTFOLIO_STATUS_LABELS[unit.status] ?? unit.status}</span></li>)}
  </ul></details>;
}
function Title({ rec }: { rec: Rec }) {
  return <td className="min-w-[240px]"><p className="font-medium text-[var(--ink)]">{rec.title}</p><p className="mt-1 t-sm text-[var(--ink-3)]">{rec.categoryName ?? "Genel"} · {STRATEGY_LABELS[rec.strategicType]}</p></td>;
}

function RecommendationList({ roadmap, list, memberHref }: { roadmap: Roadmap; list: ListKey; memberHref: MemberHref }) {
  const [limit, setLimit] = useState(10);
  const rows = list === "all" ? roadmap.recommendations : roadmap[list];
  if (!rows.length) return empty(list === "untouched" ? "Birden çok üyeye uygulanabilir olup hiç başlanmamış öneri yok." : list === "stuck" ? "Birden çok üyede açık kalan öneri yok." : "Bu kapsamda öneri yok.");
  return <>
    <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Öneri</th>
      {list === "untouched" && <><th className="!text-right">Etki</th><th>Vade</th><th>Uygulanabilir</th></>}
      {list === "stuck" && <><th className="!text-right">Açık</th><th className="!text-right">Geciken</th><th className="!text-right">Tamamlanan</th><th>Üyeler</th></>}
      {list === "adopted" && <><th className="!text-right">Yol haritasına alan</th><th className="!text-right">Tamamlanan</th><th className="!text-right">Açık</th><th>Üyeler</th></>}
      {list === "all" && <><th>Maliyet</th><th className="!text-right">Etki</th><th>Vade</th><th className="!text-right">Yol haritasında</th><th className="!text-right">Tamamlanan</th><th>Uygulanabilir</th></>}
    </tr></thead><tbody>
      {rows.slice(0, limit).map(rec => <tr key={rec.id}><Title rec={rec} />
        {list === "untouched" && <><td className="text-right tabular">{n(rec.estimatedImpact)}/10</td><td className="whitespace-nowrap">{TIMEFRAME_LABELS[rec.timeframe]}</td><td><Units rec={rec} memberHref={memberHref} /></td></>}
        {list === "stuck" && <><td className="text-right tabular">{rec.open}</td><td className="text-right tabular">{rec.overdue}</td><td className="text-right tabular">{rec.completed}</td><td><Units rec={rec} memberHref={memberHref} /></td></>}
        {list === "adopted" && <><td className="text-right tabular">{rec.adopted}/{rec.eligible}</td><td className="text-right tabular">{rec.completed}</td><td className="text-right tabular">{rec.open}</td><td><Units rec={rec} memberHref={memberHref} /></td></>}
        {list === "all" && <><td className="whitespace-nowrap">{rec.costType === "CAPEX" ? "Yatırım" : "İşletme"} · seviye {rec.costType === "CAPEX" ? rec.capexLevel : rec.opexLevel}</td><td className="text-right tabular">{n(rec.estimatedImpact)}/10</td>
          <td className="whitespace-nowrap">{TIMEFRAME_LABELS[rec.timeframe]}</td><td className="text-right tabular">{rec.adopted}</td><td className="text-right tabular">{rec.completed}</td><td><Units rec={rec} memberHref={memberHref} /></td></>}
      </tr>)}
    </tbody></table></div>
    {rows.length > limit && <Button className="mt-4" variant="outline" onClick={() => setLimit(value => value + 10)}>Daha fazla göster ({rows.length - limit})</Button>}
  </>;
}

/** Ay ay tamamlanan iş sayısı; değer yalnızca sıfırdan büyük çubuklarda yazılır. */
function MonthlyChart({ monthly }: { monthly: Roadmap["monthly"] }) {
  const max = Math.max(1, ...monthly.map(row => row.completed));
  const width = 560 / monthly.length;
  return <svg viewBox="0 0 600 170" className="h-auto w-full" role="img" aria-label={"Aylık tamamlanan iş: " + (monthly.filter(row => row.completed).map(row => monthLabel(row.month) + " " + row.completed).join(", ") || "son 12 ayda tamamlanan iş yok")}>
    <line x1="20" x2="580" y1="130" y2="130" stroke="var(--line)" />
    {monthly.map((row, i) => {
      const height = row.completed / max * 100;
      return <g key={row.month}>
        {row.completed > 0 && <><rect x={20 + i * width + 6} y={130 - height} width={width - 12} height={height} rx="3" fill="var(--accent)"><title>{monthLabel(row.month)}: {row.completed} iş</title></rect>
          <text x={20 + i * width + width / 2} y={124 - height} textAnchor="middle" fontSize="12" fill="var(--ink-2)">{row.completed}</text></>}
        <text x={20 + i * width + width / 2} y="150" textAnchor="middle" fontSize="11" fill="var(--ink-3)">{monthLabel(row.month)}</text>
      </g>;
    })}
  </svg>;
}

export function UnitRoadmapPanel({ data, memberHref }: { data: UnitManagementDashboard; memberHref: MemberHref }) {
  const r = data.analytics.roadmap;
  const [rank, setRank] = useState<RoadmapRankKey>("completed");
  const [list, setList] = useState<ListKey>(r.untouched.length ? "untouched" : r.stuck.length ? "stuck" : "all");
  const ranked = rankRoadmapMembers(r.members, rank);
  return <Panel title="Öneri uygulaması" description="Yol haritasındaki ilerleme üyelerin beyanına dayanır: bir öneri tamamlandı diye işaretlenince puan artar, kanıt o anda istenmez. Ölçülen değişim bir sonraki dönemin anketinden gelir.">
    {!r.members.length ? empty() : <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Yol haritasında" value={n(r.totals.inRoadmap) + " iş"} note={r.totals.notStarted ? `${r.totals.notStarted} üye henüz yol haritası oluşturmadı` : "Bütün üyelerin yol haritası var"} />
        <Metric label="Tamamlanan" value={n(r.totals.completed)} note="Beyan edilen" />
        <Metric label="Açık" value={n(r.totals.open)} note="Planlanan ve devam eden" />
        <Metric label="Hedef tarihi geçen" value={n(r.totals.overdue)} note={r.totals.overdue ? "Aşağıda sorumlusuyla listelenir" : "Geciken iş yok"} />
      </div>

      <section aria-label="Üyelerin öneri uygulaması">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="t-subhead">Üye sıralaması</h3>
          <Toggle label="Üye sıralaması" value={rank} options={Object.entries(ROADMAP_RANK_LABELS) as [RoadmapRankKey, string][]} onChange={setRank} /></div>
        {!ranked.length ? empty(rank === "notStarted" ? "Uygulanabilir önerisi olup yol haritası boş kalan üye yok." : "Tamamlanmış iş yok.") :
          <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Üye</th><th className="!text-right">Yol haritasında</th><th className="!text-right">Tamamlanan</th><th className="!text-right">Devam eden</th><th className="!text-right">Planlanan</th><th className="!text-right">Geciken</th><th className="!text-right">Beyan edilen gelişim</th><th className="!text-right" title="Beyan edilen gelişimin, açık önerilerle ulaşılabilecek toplam içindeki payı">Gerçekleşme</th><th className="!text-right">Son 90 gün</th><th className="!text-right">İş başına puan</th></tr></thead><tbody>
            {ranked.map(row => <tr key={row.unitId}><td><Link href={memberHref(row, "roadmap")} className="font-medium text-[var(--ink)] hover:underline">{row.unitName}</Link></td>
              <td className="text-right tabular">{row.inRoadmap}</td><td className="text-right tabular">{row.completed}</td><td className="text-right tabular">{row.inProgress}</td><td className="text-right tabular">{row.planned}</td><td className="text-right tabular">{row.overdue}</td>
              <td className="text-right tabular">{signed(row.declaredGain)}</td><td className="text-right tabular">{percentage(row.realization)}</td><td className="text-right tabular">{row.completedLast90}</td><td className="text-right tabular">{signed(row.gainPerItem)}</td></tr>)}
          </tbody></table></div>}
        <p className="mt-2 t-sm text-[var(--ink-3)]">Gerçekleşme: beyan edilen gelişimin, bugün açık önerilerin katkısıyla birlikte ulaşılabilecek toplam içindeki payı.</p>
      </section>

      <section aria-label="Öneriler">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="t-subhead">Öneriler</h3><Toggle label="Öneri listesi" value={list} options={LISTS} onChange={setList} /></div>
        <p className="mb-3 t-sm text-[var(--ink-2)]">{LIST_NOTES[list]}</p>
        <RecommendationList key={list} roadmap={r} list={list} memberHref={memberHref} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-label="Tamamlanan işlerin kategorilere dağılımı"><h3 className="mb-3 t-subhead">Hangi kategoride çalışılıyor?</h3>
          <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>Kategori</th><th className="!text-right">Ortalama</th><th className="!text-right">Tamamlanan iş</th><th className="!text-right">Açık iş</th></tr></thead><tbody>
            {r.focus.categories.map(row => <tr key={row.id}><td>{row.name}</td><td className="text-right tabular">{percentage(row.average)}</td><td className="text-right tabular">{row.completed}</td><td className="text-right tabular">{row.open}</td></tr>)}
            {r.focus.strategies.map(row => <tr key={row.key}><td className="text-[var(--ink-3)]">{STRATEGY_LABELS[row.key]}</td><td className="text-right">—</td><td className="text-right tabular">{row.completed}</td><td className="text-right tabular">{row.open}</td></tr>)}
          </tbody></table></div></section>
        <section aria-label="Aylık tamamlanan iş"><h3 className="mb-3 t-subhead">Aylık tamamlanan iş</h3>
          {r.monthly.length ? <MonthlyChart monthly={r.monthly} /> : empty("Henüz tamamlanmış iş kaydı yok.")}</section>
      </div>

      <section aria-label="Hedef tarihi geçen işler"><h3 className="mb-3 t-subhead">Hedef tarihi geçen işler</h3>
        {!r.overdue.length ? empty("Hedef tarihi geçen iş yok.") :
          <div className="overflow-x-auto"><table className="theme-table"><thead><tr><th>İş</th><th>Üye</th><th>Sorumlu</th><th>Hedef tarih</th><th className="!text-right">Gecikme</th></tr></thead><tbody>
            {r.overdue.map(row => <tr key={row.assessmentId + row.recommendationId}><td className="text-[var(--ink)]">{row.title}</td><td><Link href={memberHref(row, "roadmap")} className="hover:underline">{row.unitName}</Link></td><td>{row.assigneeName}</td><td>{unitDate(row.dueDate)}</td><td className="text-right tabular">{row.daysLate} gün</td></tr>)}
          </tbody></table></div>}
      </section>
    </div>}
  </Panel>;
}
