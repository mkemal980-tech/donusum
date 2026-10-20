import type { UnitAssessmentDetail, UnitAssessmentRow } from "../lib/unit-dashboard";
import type { AssessmentView, ViewerRole } from "../lib/assessment-view";

export function unitDetail(id = "assessment-1", unitId = "managed-unit", name = "Esra'nın birimi"): UnitAssessmentDetail {
  return {
    assessment: { id, unitId, unitName: name, surveyId: "survey-1", surveyName: "Birim olgunluk değerlendirmesi", periodName: "2026 dönemi", submittedAt: null, status: "IN_PROGRESS", locked: false, roadmapLocked: false },
    scores: { overallScore: 2.6, overallPercentage: 40, velocityScore: 2.6, enduranceScore: 0, quadrant: "WALKER", completedQuestions: 1, totalQuestions: 2, completedRecommendations: 0, velocityWeight: 1, enduranceWeight: 0, velocityBase: 2.6, enduranceBase: 0, velocityBonus: 0, enduranceBonus: 0, baselineOverallScore: 2.6, baselineOverallPercentage: 40, delta: 0, deltaPercentage: 0 },
    answeredQuestions: 1, totalQuestions: 2, completionPercentage: 50,
    questionMix: { velocity: 2, endurance: 0 },
    categories: [{ id: "category-1", name: "Çevresel dönüşüm", weightPercentage: 100, baseScore: 2.6, currentScore: 2.6, basePercentage: 40, currentPercentage: 40, delta: 0, answeredQuestions: 1, totalQuestions: 2,
      sections: [
        { id: "section-1", name: "Enerji yönetimi", restricted: false, currentPercentage: 40, assigneeId: "member-1", assigneeName: "Ayşe Üye", questionCount: 1, answeredCount: 1, percentage: 100, missingEvidence: 1, lastActivityAt: "2026-10-01T09:00:00Z",
          questions: [{ id: "q1", text: "Enerji tüketimi izleniyor mu?", type: "YES_NO", options: [{ value: "yes", label: "Evet", score: 5 }], conditionalOptions: null, value: "yes", ratio: 1, evidenceCount: 0, requiresEvidence: true, answeredBy: "Ayşe Üye" }] },
        { id: "section-2", name: "Atık yönetimi", restricted: false, currentPercentage: null, assigneeId: null, assigneeName: "Atanmamış", questionCount: 1, answeredCount: 0, percentage: 0, missingEvidence: 0, lastActivityAt: null,
          questions: [{ id: "q2", text: "Atık miktarı izleniyor mu?", type: "SCALE", options: null, conditionalOptions: null, value: null, ratio: null, evidenceCount: 0, requiresEvidence: false, answeredBy: null }] },
      ] }],
    work: [
      { kind: "UNASSIGNED", sectionId: "section-2", categoryId: "category-1", title: "Atık yönetimi için sorumlu seçin", assigneeName: "Atanmamış", count: 1 },
      { kind: "EVIDENCE", sectionId: "section-1", categoryId: "category-1", title: "Enerji yönetimi bölümünde belge eksik", assigneeName: "Ayşe Üye", count: 1 },
    ],
    recommendations: ([
      { id: "rec-1", title: "Enerji izleme planı", description: "Ölçüm ve takip sürecini kurun.", estimatedImpact: 9, questionId: "q1", sectionId: "section-1", strategicType: "QUICK_WIN", timeframe: "SHORT_TERM", costType: "OPEX", capexLevel: 1, opexLevel: 2, order: 0, isActionable: true, stepDistance: 0, triggeredByQuestion: true, isInRoadmap: false, status: null, assigneeId: null, assigneeName: "Ayşe Üye", dueDate: null, plannedQuarter: null, plannedYear: null, overdue: false, fullContribution: 0.8, currentContribution: 0, reasons: ["Yanıtınıza göre", "Yüksek etki"] },
      { id: "rec-2", title: "Atık azaltma projesi", description: "Atık miktarını azaltın.", estimatedImpact: 8, questionId: null, sectionId: "section-2", strategicType: "PROJECT", timeframe: "MEDIUM_TERM", costType: "CAPEX", capexLevel: 3, opexLevel: 2, order: 1, isActionable: true, stepDistance: 0, triggeredByQuestion: false, isInRoadmap: true, status: "PLANNED", assigneeId: null, assigneeName: "Atanmamış", dueDate: "2026-10-01T20:59:59.999Z", plannedQuarter: null, plannedYear: null, overdue: true, fullContribution: 0.4, currentContribution: 0, reasons: ["Yüksek etki"] },
    ] as const).map(rec => ({ ...rec, reasons: [...rec.reasons], categoryId: "category-1" })),
    summary: { unassignedCount: 1, incompleteCount: 1, missingEvidenceCount: 1, overdueRoadmapCount: 1, activeRoadmapCount: 1, completedRoadmapCount: 0, contributorCount: 1 },
    members: [{ id: "member-1", name: "Ayşe Üye", email: "member@example.com" }],
    team: [{ id: "member-1", name: "Ayşe Üye", email: "member@example.com", sections: ["Enerji yönetimi"], questionCount: 1, answeredCount: 1, authoredCount: 1, percentage: 100, lastActivityAt: "2026-10-01T09:00:00Z" }],
    history: [
      { id: "h1", recordedAt: "2026-09-01T09:00:00Z", score: 2.2, percentage: 30, triggerType: "SUBMISSION", completedRecommendations: 0, recommendationId: null },
      { id: "h2", recordedAt: "2026-10-01T09:00:00Z", score: 2.6, percentage: 40, triggerType: "RECOMMENDATION_COMPLETED", completedRecommendations: 1, recommendationId: "rec-1" },
    ],
    comparisons: [
      { id: "period-2025", period: "2025 dönemi", submittedAt: "2025-10-01T09:00:00Z", score: 2.2, percentage: 30, completionPercentage: 100 },
      { id: "period-2024", period: "2024 dönemi", submittedAt: "2024-10-01T09:00:00Z", score: 1.8, percentage: 20, completionPercentage: 100 },
    ],
    previous: { id: "period-2025", period: "2025 dönemi", submittedAt: "2025-10-01T09:00:00Z", percentage: 30, baselinePercentage: 30, deltaPercentage: 0,
      categories: [{ id: "category-1", currentPercentage: 30, basePercentage: 30 }] },
  };
}

export function unitRow(id = "assessment-1", unitId = "managed-unit", name = "Esra'nın birimi"): UnitAssessmentRow {
  return { id, assessmentId: id, unitId, unitName: name, surveyId: "survey-1", surveyName: "Birim olgunluk değerlendirmesi", periodId: "period-2026", periodName: "2026 dönemi", campaignRecipientId: null, createdAt: "2026-01-01T09:00:00Z", deadline: "2026-12-31T20:59:59Z", deadlineLabel: "Kampanya son tarihi", status: "IN_PROGRESS", responseCount: 1, totalQuestions: 2, completionPercentage: 50, score: 40, maturityScore: 2.6, maturityLabel: "Gelişen", submittedAt: null, overdue: false, locked: false };
}

/** Panonun /api/dashboard/assessment yanıtı: ayrıntıya sektör kıyası ve rol eklenir. */
export function assessmentView(detail = unitDetail(), role: ViewerRole = "manager", canUpdate: (id: string) => boolean = () => true): AssessmentView {
  const member = role === "member";
  return {
    ...detail,
    benchmark: { sectorName: "Enerji", overall: 35, categories: { "category-1": 35 }, ironman: { velocity: 2.4, endurance: 2.8, velocityTarget: 3, enduranceTarget: 3.2 } },
    recommendations: detail.recommendations.map(rec => ({ ...rec, canUpdateStatus: !member || (rec.isInRoadmap && canUpdate(rec.id)) })),
    viewer: { role, canManageRoadmap: !member, canDistribute: role === "manager", canExportTeam: !member },
  };
}

/** Birimsiz kullanıcının kendi değerlendirmesi: "kişisel" birim, ekip yok, bütün bölümler sahibinin. */
export function personalAssessmentView(id = "personal-1"): AssessmentView {
  const detail = unitDetail(id, "self", "Bora Danışmanlık");
  detail.assessment.periodName = "Kişisel değerlendirme";
  detail.assessment.status = "READY_TO_SUBMIT";
  detail.work = [];
  detail.members = [{ id: "owner-1", name: "Bora Er", email: "bora@example.com" }];
  detail.team = [];
  return assessmentView(detail, "owner");
}

export function personalRow(id = "personal-1", surveyId = "survey-1", surveyName = "Birim olgunluk değerlendirmesi"): UnitAssessmentRow {
  return { ...unitRow(id, "self", "Bora Danışmanlık"), surveyId, surveyName, periodName: "Kişisel değerlendirme", deadlineLabel: "Atama son tarihi", status: "READY_TO_SUBMIT" };
}

/** Çalışanın görünümü: başka üyeye atanmış bölüm ayıklanmış, ekip yalnızca kendisi (bkz. redactForMember). */
export function memberAssessmentView(): AssessmentView {
  const detail = unitDetail();
  const [mine, other] = detail.categories[0].sections;
  detail.categories[0].sections = [mine, { ...other, restricted: true, assigneeId: null, assigneeName: "", answeredCount: 0, percentage: 0, missingEvidence: 0, lastActivityAt: null, questions: [] }];
  detail.work = detail.work.filter(item => item.kind !== "UNASSIGNED");
  detail.members = [];
  return assessmentView(detail, "member", id => id === "rec-2");
}
