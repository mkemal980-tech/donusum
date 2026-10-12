import type { UnitManagementDashboard } from "./unit-management";
import { escapeReportText } from "./report-html";
import { percentage, signed, decimal, QUADRANT_LABELS, STRATEGY_LABELS, PORTFOLIO_STATUS_LABELS, TIMEFRAME_LABELS } from "./unit-management-display";
import { UNIT_RESULT_LABELS, unitDate } from "./unit-dashboard-display";

export function unitManagementReportTables(data: UnitManagementDashboard): Record<string, (string | number | null)[][]> {
  const { selection: s, analytics: a } = data;
  return {
    "Özet": [["Gösterge", "Değer"], ["Birim", s.unitName], ["Anket", s.surveyName], ["Dönem", s.periodName], ["Sonuç kapsamı", s.basis === "submitted" ? "Yalnızca gönderilenler" : "Cevap girilenler (taslak dahil)"], ["Alt birimler", s.includeDescendants ? "Dahil" : "Hariç"], ["Birim sayısı", a.scope.unitCount], ["Atanmış birim", a.participation.total], ["Gönderilmiş", a.participation.submitted], ["Devam eden", a.participation.inProgress], ["Başlamamış", a.participation.notStarted], ["Sonuç sayısı", a.results.count], ["Ortalama olgunluk", percentage(a.results.average)], ["Medyan", percentage(a.results.median)], ["Taban ortalaması", percentage(a.results.baseline)], ["Sektör kıyası farkı", signed(a.results.difference)], ["Potansiyel artış (tek adım)", signed(a.portfolio.potentialGain)]],
    "Kategoriler": [["Kategori", "Sonuç", "Mevcut %", "Taban %", "Gelişim puanı", "Soru ağırlığı %", "Sektör kıyası %"], ...a.results.categories.map(row => [row.name, row.count, row.average, row.baseline, row.gain, row.weight, row.benchmark])],
    "Bölümler": [["Kategori", "Bölüm", "Ortalama %", "Cevaplanan soru", "Toplam soru"], ...a.results.categories.flatMap(category => category.sections.map(section => [category.name, section.name, section.average, section.answered, section.total]))],
    "Olgunluk": [["Seviye", "Değerlendirme"], ...a.results.distribution.map(row => [row.label, row.count])],
    "Ironman": [["Gösterge", "Değer"], ["Hız", decimal(a.ironman.velocity)], ["Dayanıklılık", decimal(a.ironman.endurance)], ["Kadran", a.ironman.quadrant ? QUADRANT_LABELS[a.ironman.quadrant] : null], ["Kıyas hız", decimal(a.ironman.benchmarkVelocity)], ["Kıyas dayanıklılık", decimal(a.ironman.benchmarkEndurance)], ...a.ironman.distribution.map(row => [QUADRANT_LABELS[row.key], row.count])],
    "Yanıt gelişimi": [["Tarih", "Başlatılan", "Gönderilen"], ...a.trend.map(row => [row.date, row.started, row.submitted])],
    "Şirket ölçeği": [["Ölçek", "Birim", "Sonuç", "Ortalama %"], ...a.companySizes.map(row => [row.label, row.unitCount, row.count, row.average])],
    "Sektörler": [["Sektör", "Birim", "Sonuç", "Gönderilmiş", "Ortalama %", "Kıyas %", "Fark"], ...a.sectors.map(row => [row.name, row.unitCount, row.count, row.submitted, row.average, row.benchmark, row.difference])],
    "Öneriler": [["Öneri", "Açıklama", "Kategori", "Tür", "Maliyet", "Etki", "Vade", "Birim erişimi"], ...a.portfolio.rows.map(row => [row.title, row.description, row.categoryName, STRATEGY_LABELS[row.strategicType], row.costType, row.estimatedImpact, TIMEFRAME_LABELS[row.timeframe], row.units.length])],
    "Öneri durumları": [["Öneri", "Birim", "Durum"], ...a.portfolio.rows.flatMap(row => row.units.map(unit => [row.title, unit.unitName, PORTFOLIO_STATUS_LABELS[unit.status]]))],
    "Birim sonuçları": [["Birim", "Anket", "Dönem", "Durum", "Tamamlanma %", "Puan %", "Çalışan sayısı", "Sektör", "Son tarih"], ...a.members.map(row => [row.unitName, row.surveyName, row.periodName, UNIT_RESULT_LABELS[row.status], row.completionPercentage, row.score, row.employeeCount, row.sectorName, unitDate(row.deadline)])],
    "İçgörüler": [["Başlık", "Bulgu"], ...a.insights.map(row => [row.title, row.description])],
  };
}
export function buildUnitManagementReportHtml(data: UnitManagementDashboard) {
  const esc = (value: unknown) => escapeReportText(value == null ? "—" : String(value));
  const sections = Object.entries(unitManagementReportTables(data)).map(([title, rows]) => `<section><h2>${esc(title)}</h2><table><thead><tr>${rows[0].map(value => `<th>${esc(value)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("");
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Birim yönetici raporu</title><style>body{font:12px Arial,sans-serif;color:#15171e;margin:24px}h1{font-size:24px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{padding:8px;border:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#eef1f5}thead{display:table-header-group}tr{break-inside:avoid}h2{break-after:avoid}footer{margin-top:24px;color:#555}</style></head><body><h1>${esc(data.selection.unitName)} — Birim yönetici raporu</h1><p>${esc(data.selection.surveyName)} · ${esc(data.selection.periodName)}</p><p>Sonuç kapsamı: ${data.selection.basis === "submitted" ? "Yalnızca gönderilenler" : "Cevap girilenler; taslaklar dahil"}</p>${sections}<footer>Rapor tarihi: ${esc(unitDate(data.generatedAt))}</footer></body></html>`;
}
