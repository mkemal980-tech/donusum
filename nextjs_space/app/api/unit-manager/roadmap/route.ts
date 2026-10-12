import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { resolveManagedAssessment, ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadManagedStructure } from "@/lib/unit-dashboard";
import { getRecommendationsForUser } from "@/lib/scoring";
import { updateRoadmapStatus } from "@/lib/roadmap-status";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  try {
    const body = await request.json();
    if (typeof body.assessmentId !== "string" || typeof body.recommendationId !== "string") {
      return NextResponse.json({ error: "Değerlendirme ve öneri seçilmeli." }, { status: 400 });
    }
    const record = await resolveManagedAssessment(auth, body.assessmentId);
    if (!record.survey.isActive || record.survey.archivedAt || record.campaignRecipient?.campaign.status === "CLOSED") {
      return NextResponse.json({ error: "Bu değerlendirme dönemi kapalı." }, { status: 409 });
    }
    const scoring = (await loadManagedStructure(record.scoring)).scoring;
    const existing = await prisma.roadmapItem.findUnique({
      where: { assessmentId_recommendationId: { assessmentId: record.id, recommendationId: body.recommendationId } },
    });
    const available = await getRecommendationsForUser(auth.userId, { assessment: scoring });
    if (!existing && !available.some(rec => rec.id === body.recommendationId && rec.isActionable)) {
      return NextResponse.json({ error: "Bu öneri biriminize açık değil." }, { status: 403 });
    }
    const metadata: { assigneeId?: string | null; dueDate?: Date | null } = {};
    if ("assigneeId" in body) {
      if (body.assigneeId !== null && typeof body.assigneeId !== "string") return NextResponse.json({ error: "Geçersiz sorumlu." }, { status: 400 });
      if (body.assigneeId) {
        const member = await prisma.user.findFirst({ where: { id: body.assigneeId, unitId: record.unitId, isActive: true }, select: { id: true } });
        if (!member) return NextResponse.json({ error: "Sorumlu bu birimin aktif üyesi olmalı." }, { status: 400 });
      }
      metadata.assigneeId = body.assigneeId || null;
    }
    if ("dueDate" in body) {
      if (body.dueDate === null || body.dueDate === "") metadata.dueDate = null;
      else {
        const day = body.dueDate;
        if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(new Date(day).getTime()) || new Date(day).toISOString().slice(0, 10) !== day) {
          return NextResponse.json({ error: "Hedef tarih geçerli bir tarih olmalı." }, { status: 400 });
        }
        metadata.dueDate = new Date(day + "T23:59:59.999+03:00");
      }
    }
    if (body.status === undefined && existing) {
      await prisma.roadmapItem.update({ where: { id: existing.id }, data: metadata });
      return NextResponse.json({ success: true });
    }
    const outcome = await updateRoadmapStatus(auth.userId, {
      recommendationId: body.recommendationId, assessment: scoring,
      status: body.status ?? "PLANNED", ...metadata,
    });
    if (!outcome.ok) return NextResponse.json({ error: outcome.error.message }, { status: outcome.error.httpStatus });
    return NextResponse.json({ success: true, earned: outcome.result.earned });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim yol haritası kaydedilemedi:", error);
    return NextResponse.json({ error: "Yol haritası kaydedilemedi." }, { status: 500 });
  }
}
