import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadUnitGroupComparison } from "@/lib/unit-group-comparison";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  const id = request.nextUrl.searchParams.get("assessmentId");
  if (!id) return NextResponse.json({ error: "Değerlendirme seçilmeli." }, { status: 400 });
  try {
    return NextResponse.json(await loadUnitGroupComparison(auth, id));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim kıyası yüklenemedi:", error);
    return NextResponse.json({ error: "Birim kıyası yüklenemedi." }, { status: 500 });
  }
}
