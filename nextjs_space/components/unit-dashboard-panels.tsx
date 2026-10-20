"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import type { UnitAssessmentDetail } from "@/lib/unit-dashboard";
import { percentage } from "@/lib/unit-management-display";
import { UNIT_ROADMAP_LABELS, surveyAnswer, unitDate, unitScore } from "@/lib/unit-dashboard-display";

export function CategoryResults({ data }: { data: UnitAssessmentDetail }) {
  return (
    <section aria-label="Kategori sonuçları">
      <p className="t-sm mb-4 text-[var(--ink-2)]">Taban ve mevcut puan aynı ölçekte gösterilir. Bölümü açarak cevapları ve belge durumunu inceleyebilirsiniz.</p>
      <div className="space-y-3">
        {data.categories.map(category => (
          <details key={category.id} className="theme-card p-0 overflow-hidden">
            <summary className="cursor-pointer p-5 focus-visible:outline-[var(--accent)]">
              <div className="inline-flex w-[calc(100%-24px)] flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">{category.name}</span>
                <span className="t-sm tabular">{category.answeredQuestions}/{category.totalQuestions} soru · {unitScore(category.currentScore)}/5</span>
              </div>
              <div className="relative mt-3 h-2 rounded-full bg-[var(--surface-2)]" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]" style={{ width: category.currentPercentage + "%" }} />
                <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--ink-3)]" style={{ width: category.basePercentage + "%" }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 t-sm text-[var(--ink-2)]">
                <span>Taban {unitScore(category.baseScore)}</span>
                <span>Mevcut {unitScore(category.currentScore)}</span>
                {category.delta > 0 && <span className="text-[var(--accent-ink)]">Gelişim +{unitScore(category.delta)}</span>}
              </div>
            </summary>
            <div className="border-t border-[var(--line)]">
              {category.sections.map(section => section.restricted ? (
                <p key={section.id ?? "direct"} className="border-b last:border-0 border-[var(--line)] p-4 t-sm text-[var(--ink-3)]">
                  {section.name} · {percentage(section.currentPercentage === null ? null : Math.round(section.currentPercentage * 10) / 10)} · başka bir ekip üyesine atanmış; cevapları onun görünümünde
                </p>
              ) : (
                <details key={section.id ?? "direct"} className="border-b last:border-0 border-[var(--line)]">
                  <summary className="cursor-pointer p-4 t-sm">
                    {section.name} · {section.assigneeName} · {section.answeredCount}/{section.questionCount} soru
                    {section.missingEvidence > 0 && <span className="ml-3 text-[var(--warning-ink)]">{section.missingEvidence} belge eksik</span>}
                  </summary>
                  <ol className="space-y-4 px-5 pb-5">
                    {section.questions.map(question => (
                      <li key={question.id} className="border-t border-[var(--line)] pt-3">
                        <p className="font-medium t-sm">{question.text}</p>
                        <p className="mt-1 t-sm text-[var(--ink-2)]">{surveyAnswer(question)}</p>
                        <p className="mt-1 t-sm text-[var(--ink-3)]">
                          {question.answeredBy ? "Cevaplayan: " + question.answeredBy + " · " : ""}
                          {question.evidenceCount > 0 ? question.evidenceCount + " belge" : question.requiresEvidence && question.value ? "Belge eksik" : question.requiresEvidence ? "Belge gerekli" : "Belge zorunlu değil"}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </details>
        ))}
        {!data.categories.length && <EmptyState title="Kapsamda soru yok" description="Bu anket için birimin sektör kapsamını kontrol edin." />}
      </div>
    </section>
  );
}

export function TeamProgress({ data }: { data: UnitAssessmentDetail }) {
  return (
    <section className="theme-card p-0 overflow-x-auto" aria-label="Ekip ilerlemesi">
      <table className="theme-table">
        <thead><tr><th>Üye</th><th>Sorumlu olduğu bölümler</th><th>İlerleme</th><th>Girdiği cevap</th><th>Son hareket</th></tr></thead>
        <tbody>
          {data.team.map(member => (
            <tr key={member.id}>
              <td><p className="font-medium">{member.name}</p><p className="t-sm text-[var(--ink-3)]">{member.email}</p></td>
              <td>{member.sections.join(", ") || "Bölüm atanmamış"}</td>
              <td className="tabular">{member.percentage == null ? "—" : member.answeredCount + "/" + member.questionCount + " · %" + member.percentage}</td>
              <td className="tabular">{member.authoredCount}</td>
              <td>{unitDate(member.lastActivityAt)}</td>
            </tr>
          ))}
          {!data.team.length && <tr><td colSpan={5}>Bu birimde aktif üye yok.</td></tr>}
        </tbody>
      </table>
      <p className="p-4 t-sm text-[var(--ink-3)]">İlerleme, sorumlu olunan bölümlerin tamamlanmasını gösterir. Cevap sayısı kişinin katkısıdır; olgunluk puanı birime aittir.</p>
    </section>
  );
}

type Recommendation = UnitAssessmentDetail["recommendations"][number] & { canUpdateStatus?: boolean };
export type RoadmapPatch = { recommendationId: string; status?: string; assigneeId?: string | null; dueDate?: string | null };

/**
 * Yönetici iş ekler, sorumlu ve tarih atar; çalışan yalnızca kendisine düşen
 * işin durumunu değiştirir (sunucu aynı kuralı lib/roadmap-access ile uygular).
 */
function RoadmapRow({ rec, data, busy, save, canManage }: {
  rec: Recommendation; data: UnitAssessmentDetail; busy: boolean; save: (patch: RoadmapPatch) => Promise<void>; canManage: boolean;
}) {
  const [assignee, setAssignee] = useState(rec.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(rec.dueDate?.slice(0, 10) ?? "");
  useEffect(() => { setAssignee(rec.assigneeId ?? ""); setDueDate(rec.dueDate?.slice(0, 10) ?? ""); }, [rec.assigneeId, rec.dueDate]);
  const locked = data.assessment.roadmapLocked;
  return (
    <article className="theme-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="t-subhead">{rec.title}</h3>
          <p className="mt-2 t-sm text-[var(--ink-2)]">{rec.description}</p>
          <div className="mt-3 flex flex-wrap gap-3 t-sm text-[var(--ink-2)]">
            <span>{rec.reasons.join(" · ")}</span>
            <span>Etki {rec.estimatedImpact}/10</span>
            <span>{rec.costType} · maliyet düzeyi {rec.costType === "CAPEX" ? rec.capexLevel : rec.opexLevel}/5</span>
            <span>Tamamlanınca +{rec.fullContribution.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} puan</span>
            {rec.currentContribution > 0 && <span>Şu an +{rec.currentContribution.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</span>}
          </div>
          {rec.overdue && <p className="mt-2 t-sm text-[var(--warning-ink)]">Hedef tarih geçti: {unitDate(rec.dueDate)}</p>}
          {!rec.isActionable && !rec.isInRoadmap && <p className="mt-2 t-sm text-[var(--ink-3)]">Önce önceki basamağın önerileri tamamlanmalı.</p>}
        </div>
        {!rec.isInRoadmap ? canManage && (
          <Button disabled={locked || !rec.isActionable || busy} loading={busy} onClick={() => void save({ recommendationId: rec.id, status: "PLANNED" })}>
            Yol haritasına ekle
          </Button>
        ) : (
          <div>
            <label className="t-label block mb-1" htmlFor={"status-" + rec.id}>Durum</label>
            <select id={"status-" + rec.id} aria-label={rec.title + " durumu"} className="theme-select" value={rec.status ?? "NOT_STARTED"} disabled={busy || locked || rec.canUpdateStatus === false}
              onChange={event => void save({ recommendationId: rec.id, status: event.target.value })}>
              {Object.entries(UNIT_ROADMAP_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </div>
        )}
      </div>
      {rec.isInRoadmap && !canManage && (
        <p className="mt-4 border-t border-[var(--line)] pt-4 t-sm text-[var(--ink-3)]">
          Sorumlu: {rec.assigneeName} · Hedef tarih: {unitDate(rec.dueDate)}{rec.canUpdateStatus === false ? " · Durumu işin sorumlusu günceller" : ""}
        </p>
      )}
      {rec.isInRoadmap && canManage && (
        <form className="mt-4 flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-4"
          onSubmit={event => { event.preventDefault(); void save({ recommendationId: rec.id, assigneeId: assignee || null, dueDate: dueDate || null }); }}>
          <div>
            <label htmlFor={"owner-" + rec.id} className="t-label block mb-1">Sorumlu</label>
            <select id={"owner-" + rec.id} aria-label={rec.title + " sorumlusu"} className="theme-select" value={assignee} disabled={busy || locked} onChange={event => setAssignee(event.target.value)}>
              <option value="">Bölüm sorumlusu / Atanmamış</option>
              {data.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={"due-" + rec.id} className="t-label block mb-1">Hedef tarih</label>
            <input id={"due-" + rec.id} aria-label={rec.title + " hedef tarihi"} type="date" className="theme-input" value={dueDate} disabled={busy || locked} onChange={event => setDueDate(event.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={busy || locked} loading={busy}>Planı kaydet</Button>
          <p className="t-sm text-[var(--ink-3)]">Sorumlu: {rec.assigneeName}{rec.plannedQuarter && !rec.dueDate ? " · " + rec.plannedYear + " / " + rec.plannedQuarter + ". çeyrek" : ""}</p>
        </form>
      )}
    </article>
  );
}

export function UnitRecommendations({ data, roadmapOnly = false, limit, busyId, save, canManage = true }: {
  data: UnitAssessmentDetail; roadmapOnly?: boolean; limit?: number; busyId: string | null; save: (patch: RoadmapPatch) => Promise<void>; canManage?: boolean;
}) {
  const rows = data.recommendations.filter(rec => roadmapOnly ? rec.isInRoadmap : !rec.isInRoadmap);
  const shown = limit ? rows.filter(rec => rec.isActionable).slice(0, limit) : rows;
  return (
    <section aria-label={roadmapOnly ? "Birim yol haritası" : "Birim önerileri"} className="space-y-4">
      {shown.map(rec => <RoadmapRow key={rec.id} rec={rec} data={data} busy={busyId === rec.id} save={save} canManage={canManage} />)}
      {!shown.length && <EmptyState title={roadmapOnly ? "Yol haritası henüz oluşturulmadı" : "Şu an yeni öneri yok"}
        description={roadmapOnly ? canManage ? "Birim önerilerinden bir adımı yol haritasına ekleyebilirsiniz." : "Yol haritasını birim yöneticisi planlar." : "Yeni cevaplar ve tamamlanan adımlarla öneriler güncellenir."} />}
    </section>
  );
}

const HISTORY_LABELS: Record<string, string> = { SUBMISSION: "Değerlendirme gönderildi", RECOMMENDATION_COMPLETED: "Öneri tamamlandı", RECOMMENDATION_REVERTED: "Tamamlama geri alındı", SNAPSHOT: "Puan kaydı", INITIAL: "İlk kayıt" };

export function UnitHistory({ data }: { data: UnitAssessmentDetail }) {
  const history = data.history;
  return (
    <div className="space-y-6">
      <section className="theme-card p-5" aria-label="Dönem karşılaştırması">
        <h2 className="t-subhead mb-3">Dönem karşılaştırması</h2>
        <p className="t-sm mb-4 text-[var(--ink-2)]">Aynı birimin aynı anketindeki gönderilmiş dönemler, güncel soru ve sektör kapsamıyla yeniden hesaplanır. Tamamlanma oranları birlikte gösterilir.</p>
        {data.comparisons.length > 1 ? (
          <div className="overflow-x-auto"><table className="theme-table">
            <thead><tr><th>Dönem</th><th>Gönderim</th><th>Tamamlanma</th><th>Puan</th></tr></thead>
            <tbody>{data.comparisons.map(row => <tr key={row.id}><td>{row.period}</td><td>{unitDate(row.submittedAt)}</td><td>%{row.completionPercentage}</td><td className="tabular">{unitScore(row.score)}/5 · %{row.percentage}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="t-sm text-[var(--ink-3)]">Karşılaştırma için aynı ankette en az iki gönderilmiş dönem gerekiyor.</p>}
      </section>
      <section className="theme-card p-5" aria-label="Puan kayıtları">
        <h2 className="t-subhead mb-3">Puan kayıtları</h2>
        <p className="t-sm mb-4 text-[var(--ink-2)]">Gönderim ve öneri tamamlamalarında kaydedilen puanlar; geçmiş kayıtlar değiştirilmez.</p>
        <div className="overflow-x-auto"><table className="theme-table">
          <thead><tr><th>Tarih</th><th>Hareket</th><th>Puan</th><th>Tamamlanan öneri</th></tr></thead>
          <tbody>{[...history].reverse().map(row => <tr key={row.id}><td>{unitDate(row.recordedAt)}</td><td>{HISTORY_LABELS[row.triggerType] ?? "Puan kaydı"}</td><td className="tabular">{unitScore(row.score)}/5 · %{row.percentage}</td><td>{row.completedRecommendations}</td></tr>)}
            {!history.length && <tr><td colSpan={4}>Henüz puan geçmişi yok. Değerlendirme gönderildiğinde veya öneri tamamlandığında kayıt oluşur.</td></tr>}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
