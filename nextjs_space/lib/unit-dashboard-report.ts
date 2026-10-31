import type { UnitAssessmentDetail } from "./unit-dashboard";
import type { AssessmentTargets } from "./score-targets";
import { escapeReportText } from "./report-html";
import { maturityLabel, nextMaturityLevel, surveyAnswer, unitDate, unitScore, UNIT_RESULT_LABELS, UNIT_ROADMAP_LABELS } from "./unit-dashboard-display";

/** Rapor panonun görünümünden üretilir; kuruluşun hedefi varsa (yalnızca panoda) rapora da girer. */
type ReportData = UnitAssessmentDetail & { targets?: AssessmentTargets };
const pct = (value: number) => Math.round(value * 10) / 10;

/**
 * Alt kategori satırı: panodaki "Kategori analizi" ile aynı yüzde, seviye ve
 * üst seviyeye kalan fark. Başka üyeye atanmış bölümün puanı görünür, cevap
 * sayısı görünmez (bkz. redactForMember).
 */
function sectionRow(categoryName: string, section: ReportData["categories"][number]["sections"][number]) {
  const current = section.currentPercentage === null ? null : pct(section.currentPercentage);
  const next = current === null ? null : nextMaturityLevel(current);
  return [categoryName, section.name, current ?? "", current === null ? "Cevap yok" : maturityLabel(current),
    current === null ? "" : next === null ? "En üst seviye" : maturityLabel(next), next === null ? "" : pct(next - current!),
    section.restricted ? "" : section.answeredCount, section.questionCount];
}

export function unitReportTables(data: ReportData) {
  const overallTarget = data.targets?.overall;
  const categoryTargets = data.targets?.categories ?? {};
  return {
    "Özet": [
      ["Alan", "Değer"],
      ["Birim", data.assessment.unitName], ["Anket", data.assessment.surveyName], ["Dönem", data.assessment.periodName],
      ["Durum", UNIT_RESULT_LABELS[data.assessment.status]], ["Gönderim", unitDate(data.assessment.submittedAt)],
      ["Mevcut puan", data.answeredQuestions ? unitScore(data.scores.overallScore) : "Cevap yok"],
      ["Taban puan", data.answeredQuestions ? unitScore(data.scores.baselineOverallScore) : "Cevap yok"],
      ["Gelişim katkısı", data.scores.delta], ["Tamamlanma (%)", data.completionPercentage],
      ["Cevaplanan soru", data.answeredQuestions], ["Kapsamdaki soru", data.totalQuestions],
      ["Mevcut puan (100 üzerinden)", data.answeredQuestions ? data.scores.overallPercentage : "Cevap yok"],
      ["Seviye", data.answeredQuestions ? maturityLabel(data.scores.overallPercentage) : "Cevap yok"],
      ...(overallTarget ? [["Hedef (100 üzerinden)", overallTarget.percentage], ["Hedef tarihi", unitDate(overallTarget.targetDate)]] : []),
    ],
    "Kategoriler": [
      ["Kategori", "Taban puan", "Mevcut puan", "Gelişim katkısı", "Cevaplanan", "Toplam soru", "Mevcut (100 üzerinden)", "Seviye", "Hedef (100 üzerinden)"],
      ...data.categories.map(row => [row.name, row.baseScore, row.currentScore, row.delta, row.answeredQuestions, row.totalQuestions,
        row.answeredQuestions ? pct(row.currentPercentage) : "", row.answeredQuestions ? maturityLabel(pct(row.currentPercentage)) : "",
        categoryTargets[row.id]?.percentage ?? ""]),
    ],
    "Alt kategoriler": [
      ["Kategori", "Alt kategori", "Mevcut (100 üzerinden)", "Seviye", "Sonraki seviye", "Sonraki seviyeye kalan", "Cevaplanan", "Toplam soru"],
      // Kategoriye doğrudan bağlı sorular alt kategori değildir; onların puanı kategori satırındadır.
      ...data.categories.flatMap(category => category.sections.filter(section => section.id).map(section => sectionRow(category.name, section))),
    ],
    "Cevaplar": [
      ["Kategori", "Bölüm", "Sorumlu", "Soru", "Cevap", "Cevaplayan", "Belge gerekli", "Belge sayısı"],
      ...data.categories.flatMap(category => category.sections.flatMap(section => section.questions.map(question => [
        category.name, section.name, section.assigneeName, question.text, surveyAnswer(question),
        question.answeredBy ?? "", question.requiresEvidence ? "Evet" : "Hayır", question.evidenceCount,
      ]))),
    ],
    "Ekip": [
      ["Üye", "Bölümler", "Cevaplanan", "Toplam soru", "İlerleme (%)", "Girdiği cevap", "Son hareket"],
      ...data.team.map(row => [row.name, row.sections.join(", "), row.answeredCount, row.questionCount, row.percentage ?? "", row.authoredCount, unitDate(row.lastActivityAt)]),
    ],
    "Öneriler": [
      ["Öneri", "Yol haritasında", "Durum", "Sorumlu", "Hedef tarih", "Etki", "Maliyet türü", "Tamamlanınca katkı", "Mevcut katkı"],
      ...data.recommendations.map(row => [row.title, row.isInRoadmap ? "Evet" : "Hayır", row.status ? UNIT_ROADMAP_LABELS[row.status] : "",
        row.assigneeName, unitDate(row.dueDate), row.estimatedImpact, row.costType, row.fullContribution, row.currentContribution]),
    ],
    "Geçmiş": [
      ["Tarih", "Hareket", "Puan", "Yüzde", "Tamamlanan öneri"],
      ...data.history.map(row => [unitDate(row.recordedAt), row.triggerType, row.score, row.percentage, row.completedRecommendations]),
    ],
    "Dönemler": [
      ["Dönem", "Gönderim", "Puan", "Yüzde", "Tamamlanma (%)"],
      ...data.comparisons.map(row => [row.period, unitDate(row.submittedAt), row.score, row.percentage, row.completionPercentage]),
    ],
  };
}

export function buildUnitReportHtml(data: ReportData) {
  const text = escapeReportText;
  const tables = unitReportTables(data);
  const body = Object.entries(tables).map(([name, rows]) =>
    "<section><h2>" + text(name) + "</h2><table><thead><tr>" +
    rows[0].map(cell => "<th>" + text(cell) + "</th>").join("") +
    "</tr></thead><tbody>" + rows.slice(1).map(row => "<tr>" + row.map(cell => "<td>" + text(cell) + "</td>").join("") + "</tr>").join("") +
    "</tbody></table></section>"
  ).join("");
  return '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Birim raporu</title><style>' +
    '@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#15171E;background:#fff;margin:0}' +
    'header{padding:22px;background:#15171E;color:#fff;margin-bottom:20px}h1{font-size:22px;margin:0 0 8px}h2{font-size:16px;color:#1E6FE8;margin:20px 0 10px}' +
    'p{line-height:1.5}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere;vertical-align:top}' +
    'th{background:#eef1f5}thead{display:table-header-group}tr{break-inside:avoid}section{margin-bottom:20px}footer{margin-top:20px;color:#666}' +
    '</style></head><body><header><h1>' + text(data.assessment.unitName) + '</h1><p>' +
    text(data.assessment.surveyName) + " · " + text(data.assessment.periodName) + '</p></header>' +
    '<p>Durum: ' + text(UNIT_RESULT_LABELS[data.assessment.status]) + '. Mevcut puan, tamamlanan önerilerin katkısını içerir.</p>' +
    '<p>Seviyeler (100 üzerinden): Başlangıç 0-19 · Farkındalık 20-39 · Gelişen 40-59 · Olgun 60-79 · Lider 80-100.</p>' +
    body + '<footer>Dönem karşılaştırmaları güncel soru ve sektör kapsamıyla hesaplanır. Puan geçmişi kayıt anındaki değerleri gösterir.</footer></body></html>';
}
