import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { resolveViewableAssessment } from "@/lib/assessment-view";
import { saveAssessmentRoadmap } from "@/lib/unit-roadmap";

export const dynamic = "force-dynamic";

/** Panodan yol haritası kaydı; yönetici planlar, çalışan kendi işinin durumunu değiştirir. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.assessmentId !== "string" || typeof body.recommendationId !== "string") {
      return NextResponse.json({ error: "Değerlendirme ve öneri seçilmeli." }, { status: 400 });
    }
    const { role, record } = await resolveViewableAssessment(auth, body.assessmentId);
    const outcome = await saveAssessmentRoadmap(auth, role, record, body);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Yol haritası kaydedilemedi:", error);
    return NextResponse.json({ error: "Yol haritası kaydedilemedi." }, { status: 500 });
  }
}
