import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { loadUnitDashboardIndex } from "@/lib/unit-dashboard";
import { ManagedAssessmentError } from "@/lib/managed-assessment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json(await loadUnitDashboardIndex(auth));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim listesi yüklenemedi:", error);
    return NextResponse.json({ error: "Birim listesi yüklenemedi." }, { status: 500 });
  }
}
