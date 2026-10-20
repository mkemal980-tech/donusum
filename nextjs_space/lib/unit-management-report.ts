import type { UnitManagementDashboard } from "./unit-management";
import { escapeReportText } from "./report-html";
import { MATURITY_LEVELS } from "./unit-management-analytics";
import { rankRoadmapMembers } from "./unit-management-roadmap";
import { percentage, signed, decimal, ironmanInsight, QUADRANT_LABELS, STRATEGY_LABELS, PORTFOLIO_STATUS_LABELS, TIMEFRAME_LABELS } from "./unit-management-display";
import { UNIT_RESULT_LABELS, unitDate } from "./unit-dashboard-display";

type Table = (string | number | null)[][];
const statusLabel = (status: string | null) => status ? UNIT_RESULT_LABELS[status] ?? status : "Atanmadı";

/** Panodaki yorum raporda da aynı cümlelerle yer alır; sayfa dışına çıkan tablo açıklamasız kalmaz. */
function ironmanInsightRows(ironman: UnitManagementDashboard["analytics"]["ironman"]) {
  const { headline, points } = ironmanInsight(ironman);
  return [["Yorum", headline], ...points.map(point => ["", point])];
}

export function unitManagementReportTables(data: UnitManagementDashboard): Record<string, Table> {
  const { selection: s, analytics: a } = data;
  const r = a.roadmap;
  return {
    "Özet": [["Gösterge", "Değer"], ["Birim", s.unitName], ["Anket", s.surveyName], ["Dönem", s.periodName],
      ["Üye", a.participation.members], ["Atanan üye", a.participation.assigned], ["Gönderen üye", a.participation.submitted],
      ["Birim puanı %", a.results.average], ["Medyan %", a.results.median],
      ["Önceki döneme göre (puan)", a.results.change], ["Önceki dönemle karşılaştırılan üye", a.results.pairedCount],
      ["Sektör kıyasına göre (puan)", a.results.difference],
      ["En düşük puanlı kategori", a.answer.lowestCategory ? a.answer.lowestCategory.name + " " + percentage(a.answer.lowestCategory.average) : null],
      ["Öncelikli eylem", a.answer.nextAction?.title ?? null],
      ["Belgeli cevap", a.answer.data.evidenceRequired ? a.answer.data.evidenceDocumented + "/" + a.answer.data.evidenceRequired : null]],
    "Bulgular": [["Bulgu"], ...a.summary.map(text => [text])],
    "Kategoriler": [["Kategori", "Gönderen üye", "Ortalama %", "Medyan %", "En yüksek üye", "En yüksek %", "En düşük üye", "En düşük %", "Ortalamanın üstünde", "Ortalamanın altında", "Gelişen seviyesinin altında", "Sektör kıyası %", "Önceki döneme göre"],
      ...a.categories.map(row => [row.name, row.count, row.average, row.median, row.highest?.unitName ?? null, row.highest?.value ?? null, row.lowest?.unitName ?? null, row.lowest?.value ?? null, row.above, row.below, row.belowDeveloping, row.benchmark, row.change])],
    "Seviyeler": [["Kapsam", ...MATURITY_LEVELS], ["Genel", ...a.results.levels.map(level => level.count)], ...a.categories.map(row => [row.name, ...row.levels.map(level => level.count)])],
    "Üyeler": [["Üye", "Sektör", "Ölçek", "Durum", "Tamamlanma %", "Puan %", "Seviye", ...a.categories.map(category => category.name + " %"), "Önceki dönem %", "Değişim", "Sektör farkı", "Belgeli cevap"],
      ...a.members.map(row => [row.unitName, row.sectorName, row.sizeLabel, statusLabel(row.status), row.completion, row.score, row.level, ...a.categories.map(category => row.categories[category.id]),
        row.previous, row.change, row.benchmarkDifference, row.evidence.required ? row.evidence.documented + "/" + row.evidence.required : null])],
    "Ortak gelişim alanları": [["Soru", "Kategori", "Bölüm", "Alt yarıdaki üye", "Cevaplayan üye", "Pay %", "İlgili öneri"],
      ...a.commonGaps.map(row => [row.text, row.categoryName, row.sectionName, row.low, row.answered, row.share, row.recommendation?.title ?? null])],
    "Öneri uygulaması": [["Üye", "Yol haritasında", "Tamamlanan", "Devam eden", "Planlanan", "Geciken", "Beyan edilen gelişim", "Gerçekleşme %", "Son 90 günde tamamlanan", "İş başına puan"],
      ...rankRoadmapMembers(r.members, "completed").map(row => [row.unitName, row.inRoadmap, row.completed, row.inProgress, row.planned, row.overdue, row.declaredGain, row.realization, row.completedLast90, row.gainPerItem])],
    "Takılan öneriler": [["Öneri", "Kategori", "Açık", "Geciken", "Tamamlanan", "Yol haritasına alan"], ...r.stuck.map(row => [row.title, row.categoryName, row.open, row.overdue, row.completed, row.adopted])],
    "Dokunulmamış fırsatlar": [["Öneri", "Kategori", "Tür", "Etki", "Uygulanabilir üye"], ...r.untouched.map(row => [row.title, row.categoryName, STRATEGY_LABELS[row.strategicType], row.estimatedImpact, row.eligible])],
    "Benimsenen öneriler": [["Öneri", "Kategori", "Yol haritasına alan", "Tamamlanan", "Açık"], ...r.adopted.map(row => [row.title, row.categoryName, row.adopted, row.completed, row.open])],
    "Geciken işler": [["İş", "Üye", "Sorumlu", "Hedef tarih", "Gecikme (gün)"], ...r.overdue.map(row => [row.title, row.unitName, row.assigneeName, unitDate(row.dueDate), row.daysLate])],
    "Aylık tamamlama": [["Ay", "Tamamlanan iş"], ...r.monthly.map(row => [row.month, row.completed])],
    "Odak": [["Kategori / tür", "Ortalama %", "Tamamlanan iş", "Açık iş"], ...r.focus.categories.map(row => [row.name, row.average, row.completed, row.open]),
      ...r.focus.strategies.map(row => [STRATEGY_LABELS[row.key], null, row.completed, row.open])],
    "Dönem değişimi": [["Üye", "Önceki dönem", "Önceki anket puanı %", "Bu dönem anket puanı %", "Ölçülen değişim", "Önceki dönemde beyan edilen", "Beyan − ölçüm"],
      ...a.change.rows.map(row => [row.unitName, row.previousPeriod, row.previousSurvey, row.currentSurvey, row.measured, row.declared, row.gap])],
    "Ironman": [["Gösterge", "Değer"], ["Hız", decimal(a.ironman.velocity)], ["Dayanıklılık", decimal(a.ironman.endurance)], ["Kadran", a.ironman.quadrant ? QUADRANT_LABELS[a.ironman.quadrant] : null],
      ["Kıyas hız", decimal(a.ironman.benchmarkVelocity)], ["Kıyas dayanıklılık", decimal(a.ironman.benchmarkEndurance)],
      ...a.ironman.points.map(row => [row.unitName, decimal(row.velocity) + " hız · " + decimal(row.endurance) + " dayanıklılık · " + (QUADRANT_LABELS[row.quadrant] ?? row.quadrant)]),
      ...ironmanInsightRows(a.ironman)],
    "Katılım": [["Üye", "Durum", "Tamamlanma %", "Son tarih", "Süre geçti", "Bekleyen iş", "Sorumlu", "Son işlem"],
      ...a.participation.pending.map(row => [row.unitName, statusLabel(row.status), row.completion, unitDate(row.deadline), row.overdue ? "Evet" : "Hayır", row.nextGap?.title ?? null, row.nextGap?.assigneeName ?? null, unitDate(row.lastActivityAt)])],
    "Tüm öneriler": [["Öneri", "Açıklama", "Kategori", "Tür", "Maliyet", "Etki", "Vade", "Uygulanabilir üye", "Yol haritasında", "Tamamlanan"],
      ...r.recommendations.map(row => [row.title, row.description, row.categoryName, STRATEGY_LABELS[row.strategicType], row.costType === "CAPEX" ? "Yatırım" : "İşletme", row.estimatedImpact, TIMEFRAME_LABELS[row.timeframe], row.eligible, row.adopted, row.completed])],
    "Öneri durumları": [["Öneri", "Üye", "Durum"], ...r.recommendations.flatMap(row => row.units.map(unit => [row.title, unit.unitName, PORTFOLIO_STATUS_LABELS[unit.status] ?? unit.status]))],
  };
}

/**
 * Yönetim kuruluna giden PDF. İlk sayfa panonun cevap şeridini ve kategori
 * özetini taşır; ayrıntılı tablolar ekte. Açık zemin bilinçli (DESIGN.md > PDF).
 */
export function buildUnitManagementReportHtml(data: UnitManagementDashboard) {
  const esc = (value: unknown) => escapeReportText(value == null ? "—" : String(value));
  const { selection: s, analytics: a } = data;
  const tables = unitManagementReportTables(data);
  const tile = (label: string, value: string, note: string) => `<div class="tile"><p class="label">${esc(label)}</p><p class="value">${esc(value)}</p><p class="note">${esc(note)}</p></div>`;
  const answer = a.answer;
  const tiles = [
    tile("Birim puanı", percentage(answer.score), [answer.change !== null ? `Önceki döneme göre ${signed(answer.change)} (${answer.pairedCount} üye)` : "Önceki dönem yok", answer.benchmarkDifference !== null ? `Sektöre göre ${signed(answer.benchmarkDifference)}` : ""].filter(Boolean).join(" · ")),
    tile("En düşük puanlı kategori", answer.lowestCategory ? answer.lowestCategory.name + " " + percentage(answer.lowestCategory.average) : "—", answer.lowestCategory ? `${answer.lowestCategory.belowDeveloping} üye Gelişen seviyesinin altında` : ""),
    tile("Öncelikli eylem", answer.nextAction?.title ?? "—", answer.nextAction ? (answer.nextAction.kind === "untouched" ? `${answer.nextAction.reach} üyeye uygulanabilir, henüz başlanmadı` : `${answer.nextAction.reach} üyede açık, ${answer.nextAction.overdue} gecikmiş`) : ""),
    tile("Veri durumu", `${answer.data.submitted}/${answer.data.assigned} gönderdi`, answer.data.evidenceRequired ? `Belgeli cevap ${answer.data.evidenceDocumented}/${answer.data.evidenceRequired}` : "Belge gerektiren cevap yok"),
  ].join("");
  const categoryRows = a.categories.map(row => `<tr><td>${esc(row.name)}</td><td>${esc(percentage(row.average))}</td><td>${esc(row.highest ? row.highest.unitName + " " + percentage(row.highest.value) : "—")}</td><td>${esc(row.lowest ? row.lowest.unitName + " " + percentage(row.lowest.value) : "—")}</td><td>${row.above} / ${row.below}</td><td>${esc(percentage(row.benchmark))}</td><td>${esc(signed(row.change))}</td></tr>`).join("");
  const actions = [...a.roadmap.untouched.slice(0, 3).map(row => `${row.title} — ${row.eligible} üyeye uygulanabilir, henüz başlanmadı`),
    ...a.roadmap.stuck.slice(0, 2).map(row => `${row.title} — ${row.open} üyede açık, ${row.overdue} gecikmiş`)];
  const detail = Object.entries(tables).filter(([title]) => title !== "Özet" && title !== "Bulgular" && tables[title].length > 1)
    .map(([title, rows]) => `<section><h2>${esc(title)}</h2><table><thead><tr>${rows[0].map(value => `<th>${esc(value)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("");
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Birim yönetimi raporu</title><style>body{font:12px Arial,sans-serif;color:#15171e;margin:0}main{margin:24px}.band{background:#15171e;color:#fff;padding:20px 24px}.band h1{font-size:22px;margin:0}.band p{margin:6px 0 0;color:#c9ccd6}h2{font-size:16px;margin-top:26px;color:#15171e}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.tile{border:1px solid #d9dce3;border-radius:8px;padding:10px}.tile .label{margin:0;color:#555;font-size:11px}.tile .value{margin:6px 0 4px;font-size:17px;font-weight:600;color:#1e6fe8}.tile .note{margin:0;color:#555;font-size:11px}ul{padding-left:18px}li{margin:4px 0}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{padding:6px 8px;border:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#eef1f5}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}.appendix{break-before:page}footer{margin:24px;color:#555}</style></head><body>` +
    `<header class="band"><h1>${esc(s.unitName)} — Birim yönetimi raporu</h1><p>${esc(s.surveyName)} · ${esc(s.periodName)} · ${a.participation.members} üye · Sonuçlar yalnızca gönderilmiş değerlendirmelerden</p></header><main>` +
    `<div class="tiles">${tiles}</div><h2>Bulgular</h2><ul>${a.summary.map(text => `<li>${esc(text)}</li>`).join("")}</ul>` +
    (a.categories.length ? `<h2>Kategoriler</h2><table><thead><tr><th>Kategori</th><th>Ortalama</th><th>En yüksek</th><th>En düşük</th><th>Ortalamanın üstü / altı</th><th>Sektör kıyası</th><th>Önceki döneme göre</th></tr></thead><tbody>${categoryRows}</tbody></table>` : "") +
    (actions.length ? `<h2>Öncelikli eylemler</h2><ul>${actions.map(text => `<li>${esc(text)}</li>`).join("")}</ul>` : "") +
    `<div class="appendix">${detail}</div></main><footer>Rapor tarihi: ${esc(unitDate(data.generatedAt))} · Yol haritası ilerlemesi üyelerin beyanına dayanır; ölçülen değişim bir sonraki dönemin anketinden gelir.</footer></body></html>`;
}
