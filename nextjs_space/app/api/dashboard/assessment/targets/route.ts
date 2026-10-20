import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { resolveViewableAssessment } from "@/lib/assessment-view";
import { saveAssessmentTargets, TargetValidationError } from "@/lib/score-targets";

export const dynamic = "force-dynamic";

/** Kuruluşun hedefi: birim yöneticisi (ya da kişisel değerlendirmenin sahibi) koyar, çalışan görür. */
export async function PUT(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.assessmentId !== "string") return NextResponse.json({ error: "Değerlendirme seçilmeli." }, { status: 400 });
  try {
    const { role, record } = await resolveViewableAssessment(auth, body.assessmentId);
    if (role === "member") return NextResponse.json({ error: "Hedefi birim yöneticisi belirler." }, { status: 403 });
    return NextResponse.json(await saveAssessmentTargets(auth.userId, record, body));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TargetValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Hedef kaydedilemedi:", error);
    return NextResponse.json({ error: "Hedef kaydedilemedi." }, { status: 500 });
  }
}
