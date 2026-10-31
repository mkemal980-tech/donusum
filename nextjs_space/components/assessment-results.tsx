"use client";
import { useState } from "react";
import Panel from "./ui/panel";
import StatCard from "./ui/stat-card";
import { Button } from "./ui/button";
import { MaturityGauge } from "./ui/maturity-gauge";
import { GapRadarChart } from "./ui/gap-radar-chart";
import { empty, Metric, Toggle } from "./unit-management-shared";
import type { AssessmentView } from "@/lib/assessment-view";
import type { UnitGroupComparison } from "@/lib/unit-group-comparison";
import { decimal, percentage, signed, QUADRANT_LABELS } from "@/lib/unit-management-display";
import { maturityLabel, nextMaturityLevel, surveyAnswer, unitDate, UNIT_ROADMAP_LABELS } from "@/lib/unit-dashboard-display";

type Comparison = Extract<UnitGroupComparison, { available: true }> | null;
type Recommendation = AssessmentView["recommendations"][number];
const round1 = (value: number) => Math.round(value * 10) / 10;
const OPEN = new Set(["NOT_STARTED", "PLANNED", "IN_PROGRESS"]);
const contribution = (rec: Pick<Recommendation, "fullContribution">) => "tamamlanınca +" + decimal(rec.fullContribution * 25) + " puan";

const targetNote = (target: { percentage: number; targetDate: string | null }) => `Hedef ${percentage(target.percentage)}${target.targetDate ? " · " + unitDate(target.targetDate) : ""}`;

/**
 * Panonun ilk cevabı: mevcut puan, kuruluşun hedefi (koyduysa) ve kıyaslar.
 * Sayılar ilerleme motorundan (mevcut puan: anket + tamamlanan öneriler);
 * kıyaslar ve hedef aynı ölçekte (100 üzerinden).
 */
export function AnswerStrip({ view, comparison }: { view: AssessmentView; comparison: Comparison }) {
  const s = view.scores;
  const score = view.answeredQuestions ? s.overallPercentage : null;
  const bench = view.benchmark.overall;
  const target = view.targets.overall;
  return <div className={"grid gap-4 sm:grid-cols-2 " + (target ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
    <StatCard label="Mevcut puan" value={percentage(score)}
      note={score === null ? "Henüz cevap yok" : s.deltaPercentage > 0 ? `${maturityLabel(score)} · anket %${s.baselineOverallPercentage} · öneriler +${decimal(s.deltaPercentage)}` : maturityLabel(score)} />
    {target && <StatCard label="Hedefe göre" value={score !== null ? signed(round1(score - target.percentage)) : "—"}
      note={score !== null && score >= target.percentage ? targetNote(target) + " · ulaşıldı" : targetNote(target)} />}
    <StatCard label="Önceki döneme göre" value={view.previous && score !== null ? signed(score - view.previous.percentage) : "—"}
      note={view.previous ? `${view.previous.period} · %${view.previous.percentage}` : "Önceki gönderim yok"} />
    <StatCard label="Sektöre göre" value={bench !== null && score !== null ? signed(round1(score - bench)) : "—"}
      note={bench !== null ? `${view.benchmark.sectorName ?? "Sektör"} ortalaması ${percentage(bench)}` : "Kayıtlı sektör kıyası yok"} />
    {comparison
      ? <StatCard label={`${comparison.groupName} içinde`} value={signed(comparison.overall.difference)} note={`Birim ortalaması ${percentage(comparison.overall.average)} · ilk %${comparison.band.value} dilimde`} />
      : <StatCard label="Veri durumu" value={`%${view.completionPercentage}`} note={`${view.answeredQuestions}/${view.totalQuestions} soru · ${view.summary.missingEvidenceCount} belge eksik`} />}
  </div>;
}

/** Kategoriler: mevcut, taban, kuruluşun hedefi ve kıyaslar aynı satırda. */
export function CategoryTable({ view, comparison, onEditTargets }: { view: AssessmentView; comparison: Comparison; onEditTargets?: () => void }) {
  const prev = new Map(view.previous?.categories.map(row => [row.id, row.currentPercentage]) ?? []);
  const group = new Map(comparison?.categories.map(row => [row.id, row.average]) ?? []);
  const hasTargets = Object.keys(view.targets.categories).length > 0;
  const hasAnyTarget = hasTargets || Boolean(view.targets.overall);
  return <Panel title="Kategoriler" description="Mevcut puan tamamlanan önerileri içerir; taban yalnızca anket cevaplarıdır · 100 üzerinden" padding="none"
    actions={onEditTargets && <Button variant="outline" size="sm" onClick={onEditTargets}>{hasAnyTarget ? "Hedefleri düzenle" : "Hedef belirle"}</Button>}>
    {!view.categories.length ? <div className="px-6 pb-6">{empty("Kapsamda soru yok.")}</div> :
      <div className="overflow-x-auto"><table className="theme-table"><thead><tr>
        <th>Kategori</th><th className="!text-right">Mevcut</th><th>Seviye</th><th className="!text-right">Taban</th>{hasTargets && <th className="!text-right">Hedef</th>}<th className="!text-right">Önceki döneme göre</th>
        <th className="!text-right">Sektör</th>{comparison && <th className="!text-right">{comparison.groupName} ort.</th>}<th className="!text-right">Cevaplanan</th>
      </tr></thead><tbody>
        {view.categories.map(category => {
          const answered = category.answeredQuestions > 0;
          const current = answered ? round1(category.currentPercentage) : null;
          const before = prev.get(category.id);
          return <tr key={category.id}>
            <td className="font-medium text-[var(--ink)]">{category.name}</td>
            <td className="text-right tabular text-[var(--ink)]">{percentage(current)}</td>
            <td>{answered ? maturityLabel(current) : "—"}</td>
            <td className="text-right tabular">{answered ? percentage(round1(category.basePercentage)) : "—"}</td>
            {hasTargets && <td className="text-right tabular">{(() => {
              const target = view.targets.categories[category.id];
              if (!target) return "—";
              return <>{percentage(target.percentage)}{current !== null && <span className="ml-2 text-[var(--ink-3)]">{signed(round1(current - target.percentage))}</span>}</>;
            })()}</td>}
            <td className="text-right tabular">{current !== null && before != null ? signed(round1(current - before)) : "—"}</td>
            <td className="text-right tabular">{percentage(view.benchmark.categories[category.id] ?? null)}</td>
            {comparison && <td className="text-right tabular">{percentage(group.get(category.id) ?? null)}</td>}
            <td className="text-right tabular">{category.answeredQuestions}/{category.totalQuestions}</td>
          </tr>;
        })}
      </tbody></table></div>}
  </Panel>;
}

/** Puanı en çok aşağı çeken cevaplar ve onları yükseltecek öneri. */
export function LowestQuestions({ view, onOpen }: { view: AssessmentView; onOpen: (tab: string) => void }) {
  const questions = view.categories.flatMap(category => category.sections.flatMap(section => section.questions
    .filter(question => question.ratio !== null && question.ratio < 1)
    .map(question => ({ ...question, ratio: question.ratio!, categoryName: category.name, sectionName: section.name }))))
    .sort((a, b) => a.ratio - b.ratio || a.text.localeCompare(b.text, "tr")).slice(0, 5);
  const recFor = (questionId: string) => view.recommendations.filter(rec => rec.questionId === questionId && rec.status !== "COMPLETED")
    .sort((a, b) => Number(b.isActionable) - Number(a.isActionable) || b.fullContribution - a.fullContribution)[0];
  return <Panel title="Puanı en çok aşağı çeken cevaplar" description="Cevabın, sorunun puan ölçeğindeki yeri en düşük olan sorular ve onları yükseltecek öneri">
    {!questions.length ? empty(!view.answeredQuestions ? "Henüz cevap yok." : view.answeredQuestions < view.totalQuestions
      ? `Cevaplanan bütün sorular ölçeğin en üstünde; ${view.totalQuestions - view.answeredQuestions} soru cevapsız ve puana sıfır olarak giriyor.` : "Bütün cevaplar ölçeğin en üstünde.") :
      <ol className="divide-y divide-[var(--line)]">{questions.map(question => {
        const rec = recFor(question.id);
        return <li key={question.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div><p className="text-[var(--ink)]">{question.text}</p><p className="t-sm text-[var(--ink-3)]">{question.categoryName} · {question.sectionName} · cevap: {surveyAnswer(question)} · ölçeğin %{Math.round(question.ratio * 100)}&apos;i</p></div>
          <div className="t-sm">{rec ? <><p className="text-[var(--ink)]">{rec.title}</p><p className="text-[var(--ink-3)]">{contribution(rec)}{rec.isInRoadmap ? " · yol haritasında" : ""}</p>
            <Button variant="link" className="h-auto p-0" onClick={() => onOpen(rec.isInRoadmap ? "roadmap" : "recommendations")}>{rec.isInRoadmap ? "Yol haritasında aç" : "Öneriyi incele"}</Button></>
            : <p className="text-[var(--ink-3)]">Bu soruya bağlı açık öneri yok.</p>}</div>
        </li>;
      })}</ol>}
  </Panel>;
}

/** Yol haritasının durumu ve sıradaki üç iş (önce geciken, sonra hedef tarihi en yakın). */
export function RoadmapSummary({ view, onOpen }: { view: AssessmentView; onOpen: (tab: string) => void }) {
  const items = view.recommendations.filter(rec => rec.isInRoadmap);
  const open = items.filter(rec => OPEN.has(rec.status ?? ""));
  const next = [...open].sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title, "tr")).slice(0, 3);
  return <Panel title="Yol haritası" description="Tamamlanan işler mevcut puana eklenir" actions={<Button variant="outline" size="sm" onClick={() => onOpen("roadmap")}>Yol haritasını aç</Button>}>
    <div className="grid grid-cols-2 gap-3">
      <Metric label="Yol haritasında" value={String(items.length)} />
      <Metric label="Tamamlanan" value={String(items.filter(rec => rec.status === "COMPLETED").length)} note={view.scores.deltaPercentage > 0 ? `+${decimal(view.scores.deltaPercentage)} puan` : undefined} />
      <Metric label="Açık" value={String(open.length)} />
      <Metric label="Hedef tarihi geçen" value={String(items.filter(rec => rec.overdue).length)} />
    </div>
    <h3 className="mt-5 mb-2 t-label text-[var(--ink-2)]">Sıradaki işler</h3>
    {!next.length ? empty(items.length ? "Açık iş yok." : "Yol haritası henüz oluşturulmadı.") :
      <ul className="divide-y divide-[var(--line)]">{next.map(rec => <li key={rec.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5 t-sm">
        <span className="text-[var(--ink)]">{rec.title}</span>
        <span className="text-[var(--ink-3)]">{rec.assigneeName} · {rec.dueDate ? unitDate(rec.dueDate) : "hedef tarih yok"} · {UNIT_ROADMAP_LABELS[rec.status ?? "NOT_STARTED"]}{rec.overdue && <span className="ml-2 badge badge-warning">Gecikti</span>}</span>
      </li>)}</ul>}
  </Panel>;
}

/** Gönderim ve öneri tamamlamalarında kaydedilen puanlar. */
export function ScoreTrend({ view }: { view: AssessmentView }) {
  const points = view.history;
  if (points.length < 2) return <Panel title="Puan geçmişi">{empty("Puan geçmişi gönderim ve öneri tamamlamalarıyla oluşur.")}</Panel>;
  const first = Date.parse(points[0].recordedAt), last = Date.parse(points.at(-1)!.recordedAt);
  const x = (at: string, i: number) => 40 + (last > first ? (Date.parse(at) - first) / (last - first) : i / (points.length - 1)) * 620;
  const y = (pct: number) => 130 - pct / 100 * 110;
  const change = points.at(-1)!.percentage - points[0].percentage;
  return <Panel title="Puan geçmişi" description={`${unitDate(points[0].recordedAt)} – ${unitDate(points.at(-1)!.recordedAt)} · ${signed(change)} puan`}>
    <svg viewBox="0 0 700 160" className="h-auto w-full max-h-56" role="img" aria-label={`Puan geçmişi: ilk kayıt %${points[0].percentage}, son kayıt %${points.at(-1)!.percentage}`}>
      {[0, 50, 100].map(v => <g key={v}><line x1="40" x2="660" y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x="32" y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)">{v}</text></g>)}
      <polyline points={points.map((p, i) => `${x(p.recordedAt, i)},${y(p.percentage)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => <circle key={p.id} cx={x(p.recordedAt, i)} cy={y(p.percentage)} r="4" fill="var(--accent)"><title>{unitDate(p.recordedAt)} · %{p.percentage}</title></circle>)}
      <text x="40" y="154" fontSize="11" fill="var(--ink-3)">{unitDate(points[0].recordedAt)}</text>
      <text x="660" y="154" textAnchor="end" fontSize="11" fill="var(--ink-3)">{unitDate(points.at(-1)!.recordedAt)}</text>
    </svg>
  </Panel>;
}

/**
 * Kategori analizi: seviye göstergesi, bölümlerin üst seviyeyle farkı ve
 * bölüm başına öncelikli öneriler. Başka bir ekip üyesine atanmış bölümün
 * puanı görünür, cevapları görünmez.
 */
export function CategoryAnalysis({ view, canManage, busyId, onAdd }: { view: AssessmentView; canManage: boolean; busyId: string | null; onAdd: (recommendationId: string) => void }) {
  const [selected, setSelected] = useState(view.categories[0]?.id ?? "");
  const category = view.categories.find(row => row.id === selected) ?? view.categories[0];
  if (!category) return null;
  const sections = category.sections.filter(section => section.id && section.currentPercentage !== null);
  const categoryTarget = view.targets.categories[category.id];
  return <Panel title="Kategori analizi" description="Seviye, bölümlerin üst seviyeyle farkı ve bölüm başına öncelikli adımlar"
    actions={view.categories.length > 1 && <Toggle label="Kategori" value={category.id} options={view.categories.map(row => [row.id, row.name] as [string, string])} onChange={setSelected} />}>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0"><MaturityGauge score={category.answeredQuestions ? category.currentScore : 1} title={category.name} /></div>
      {sections.length >= 3
        // Kategori hedefi varsa bölümler ona göre; yoksa ölçeğin üstüne göre çizilir (hedef uydurulmaz).
        ? <GapRadarChart title={categoryTarget ? "Bölümler ve hedef" : "Bölümler ve üst seviye farkı"}
            targetLabel={categoryTarget ? `Hedef (${percentage(categoryTarget.percentage)})` : "Üst seviye (5/5)"}
            data={sections.map(section => ({ name: section.name, score: 1 + section.currentPercentage! / 25, target: categoryTarget ? 1 + categoryTarget.percentage / 25 : 5 }))} />
        : <div className="self-center">{empty("Fark grafiği en az üç puanlanmış bölümde çizilir.")}</div>}
    </div>
    <ul className="mt-6 divide-y divide-[var(--line)]">{category.sections.map(section => {
      const pct = section.currentPercentage === null ? null : round1(section.currentPercentage);
      const target = pct === null ? null : nextMaturityLevel(pct);
      const recs = view.recommendations.filter(rec => rec.sectionId === section.id && rec.status !== "COMPLETED" && (rec.isActionable || rec.isInRoadmap)).slice(0, 2);
      return <li key={section.id ?? "direct"} className="py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-medium text-[var(--ink)]">{section.name}</span>
          <span className="t-sm tabular text-[var(--ink-2)]">{pct === null ? "Cevap yok" : `${percentage(pct)} · ${maturityLabel(pct)}${target !== null ? ` · ${maturityLabel(target)} seviyesine ${decimal(target - pct)} puan` : " · en üst seviye"}`}</span>
        </div>
        {pct !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]" aria-hidden="true"><span className="block h-full bg-[var(--accent)]" style={{ width: pct + "%" }} /></div>}
        {section.restricted && <p className="mt-2 t-sm text-[var(--ink-3)]">Bu bölüm başka bir ekip üyesine atanmış; cevapları onun görünümünde.</p>}
        {recs.length > 0 && <ul className="mt-3 space-y-2">{recs.map(rec => <li key={rec.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2 t-sm">
          <span><span className="text-[var(--ink)]">{rec.title}</span><span className="text-[var(--ink-3)]"> · {contribution(rec)}</span></span>
          {rec.isInRoadmap ? <span className="badge badge-neutral">Yol haritasında</span>
            : canManage && <Button size="sm" variant="outline" loading={busyId === rec.id} disabled={!rec.isActionable || view.assessment.roadmapLocked} onClick={() => onAdd(rec.id)}>Yol haritasına ekle</Button>}
        </li>)}</ul>}
      </li>;
    })}</ul>
  </Panel>;
}

const QUADRANT_TEXT: Record<string, string> = {
  IRONMAN: "hızlı aksiyon alıyor ve bunu politika ve süreçlerle kalıcı hâle getiriyorsunuz.",
  SPRINTER: "hızlı aksiyon alıyorsunuz ama politika, süreç ve dokümantasyon geride; kazanımlar kalıcı olmayabilir.",
  MARATHON_RUNNER: "politika ve süreçler sağlam ama aksiyonlar yavaş ilerliyor.",
  WALKER: "iki eksen de eşiğin altında; iç veya dış bir sarsıntıya karşı kırılgan bir konum.",
};
const versus = (axis: string, diff: number) => Math.abs(diff) < 0.05 ? `${axis} aynı seviyede` : `${axis} ${decimal(Math.abs(diff))} puan ${diff > 0 ? "önde" : "geride"}`;

/** Hız (aksiyon alma) ve dayanıklılık (kalıcılık); sektör ortalaması varsa onunla. */
export function UnitIronman({ view }: { view: AssessmentView }) {
  const s = view.scores;
  if (!view.answeredQuestions || s.velocityWeight === 0 || s.enduranceWeight === 0) {
    return <Panel title="Dönüşüm dinamiği">{empty("Hız ve dayanıklılık, iki eksene bağlı sorular cevaplandığında birlikte ölçülür.")}</Panel>;
  }
  const bench = view.benchmark.ironman;
  const scale = (v: number) => 30 + (Math.min(5, Math.max(1, v)) - 1) / 4 * 200;
  const sentences = [`Hız ${decimal(s.velocityScore)}, dayanıklılık ${decimal(s.enduranceScore)} (1–5). Eşik her iki eksende 3,0.`];
  if (bench) sentences.push(`Sektör ortalamasına göre ${versus("hızda", s.velocityScore - bench.velocity)}, ${versus("dayanıklılıkta", s.enduranceScore - bench.endurance)}.`);
  sentences.push(s.quadrant === "SPRINTER" ? "Öncelik dayanıklılık: yapılan işleri yazılı politika, süreç ve ölçümle kalıcı hâle getirmek."
    : s.quadrant === "MARATHON_RUNNER" ? "Öncelik hız: hazır politikaları takvimli, sorumlusu belli aksiyonlara dönüştürmek."
    : s.quadrant === "WALKER" ? `Öncelik eşiğe en yakın eksen: ${s.velocityScore >= s.enduranceScore ? "hız" : "dayanıklılık"}.`
    : `Öncelik konumu korumak; görece düşük eksen ${s.velocityScore <= s.enduranceScore ? "hız" : "dayanıklılık"}.`);
  return <Panel title="Dönüşüm dinamiği" description="Hız: aksiyon alma · Dayanıklılık: aksiyonları politika ve süreçle kalıcı kılma"
    actions={<span className="badge badge-neutral">{QUADRANT_LABELS[s.quadrant] ?? s.quadrant}</span>}>
    <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <svg viewBox="0 0 260 260" className="h-auto w-full max-w-[260px]" role="img" aria-label={`${QUADRANT_LABELS[s.quadrant]}: hız ${decimal(s.velocityScore)}, dayanıklılık ${decimal(s.enduranceScore)}`}>
        <rect x="30" y="30" width="200" height="200" rx="6" fill="var(--surface-2)" />
        <line x1={scale(3)} x2={scale(3)} y1="30" y2="230" stroke="var(--line-strong)" strokeDasharray="4 4" />
        <line x1="30" x2="230" y1={260 - scale(3)} y2={260 - scale(3)} stroke="var(--line-strong)" strokeDasharray="4 4" />
        {([["Maraton Koşucusu", 80, 48], ["Demir Adam", 180, 48], ["Yaya", 80, 222], ["Sprinter", 180, 222]] as const).map(([label, px, py]) => <text key={label} x={px} y={py} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{label}</text>)}
        {bench && <rect x={scale(bench.velocity) - 5} y={260 - scale(bench.endurance) - 5} width="10" height="10" fill="var(--ink-3)"><title>Sektör ortalaması</title></rect>}
        <circle cx={scale(s.velocityScore)} cy={260 - scale(s.enduranceScore)} r="8" fill="var(--accent)" stroke="var(--canvas)" strokeWidth="3"><title>Mevcut konum</title></circle>
        <text x="130" y="252" textAnchor="middle" fontSize="11" fill="var(--ink-2)">Hız</text>
        <text x="12" y="130" textAnchor="middle" fontSize="11" fill="var(--ink-2)" transform="rotate(-90 12 130)">Dayanıklılık</text>
      </svg>
      <div>
        <p className="text-[var(--ink)]">{QUADRANT_LABELS[s.quadrant]} kadranındasınız: {QUADRANT_TEXT[s.quadrant]}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 t-sm text-[var(--ink-2)]">{sentences.map(text => <li key={text}>{text}</li>)}</ul>
        <p className="mt-3 t-sm text-[var(--ink-3)]"><span aria-hidden="true" className="text-[var(--accent)]">●</span> Mevcut konum{bench && <> · ■ Sektör ortalaması</>}</p>
      </div>
    </div>
  </Panel>;
}
