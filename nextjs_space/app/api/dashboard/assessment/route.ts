import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadAssessmentView } from "@/lib/assessment-view";

export const dynamic = "force-dynamic";

/** Bir değerlendirmenin sonucu; rol yalnızca görünen ayrıntıyı ve yetkileri değiştirir (bkz. lib/assessment-view). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const id = request.nextUrl.searchParams.get("assessmentId");
  if (!id) return NextResponse.json({ error: "Değerlendirme seçilmeli." }, { status: 400 });
  try {
    return NextResponse.json(await loadAssessmentView(auth, id));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Değerlendirme sonucu yüklenemedi:", error);
    return NextResponse.json({ error: "Değerlendirme sonucu yüklenemedi." }, { status: 500 });
  }
}
