import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { resolveManagedAssessment, ManagedAssessmentError } from "@/lib/managed-assessment";
import { saveAssessmentRoadmap } from "@/lib/unit-roadmap";

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
    const outcome = await saveAssessmentRoadmap(auth, "manager", record, body);
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim yol haritası kaydedilemedi:", error);
    return NextResponse.json({ error: "Yol haritası kaydedilemedi." }, { status: 500 });
  }
}
