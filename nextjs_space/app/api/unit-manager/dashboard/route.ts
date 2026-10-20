import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { startManagedAssessment } from "@/lib/unit-dashboard";

export const dynamic = "force-dynamic";

/** Atanmış ama başlanmamış birim anketini değerlendirmeye çevirir; sonuçlar /api/dashboard/assessment ucundadır. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  try {
    const body = await request.json();
    if (typeof body.unitId !== "string" || typeof body.surveyId !== "string" ||
        (body.campaignRecipientId != null && typeof body.campaignRecipientId !== "string")) {
      return NextResponse.json({ error: "Birim ve anket seçilmeli." }, { status: 400 });
    }
    const assessmentId = await startManagedAssessment(auth, body);
    return NextResponse.json({ assessmentId }, { status: 201 });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim değerlendirmesi başlatılamadı:", error);
    return NextResponse.json({ error: "Değerlendirme başlatılamadı." }, { status: 500 });
  }
}
