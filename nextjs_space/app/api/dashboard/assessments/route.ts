import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadAssessmentIndex } from "@/lib/assessment-view";

export const dynamic = "force-dynamic";

/** Panodaki birim, anket ve dönem seçicileri: yöneticide yönetilen birimler, çalışanda kendi birimi. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json(await loadAssessmentIndex(auth));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Pano değerlendirmeleri yüklenemedi:", error);
    return NextResponse.json({ error: "Değerlendirmeler yüklenemedi." }, { status: 500 });
  }
}
