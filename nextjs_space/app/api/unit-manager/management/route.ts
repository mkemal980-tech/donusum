import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadUnitManagementDashboard, updateManagedEmployeeCount } from "@/lib/unit-management";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  const params = request.nextUrl.searchParams;
  try {
    return NextResponse.json(await loadUnitManagementDashboard(auth, {
      unitId: params.get("unitId"), surveyId: params.get("surveyId"), periodId: params.get("periodId"),
    }));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim yönetimi yüklenemedi:", error);
    return NextResponse.json({ error: "Birim yönetimi yüklenemedi." }, { status: 500 });
  }
}
export async function PATCH(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Birim profili gerekli." }, { status: 400 });
    return NextResponse.json(await updateManagedEmployeeCount(auth, body));
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim profili güncellenemedi:", error);
    return NextResponse.json({ error: "Birim profili güncellenemedi." }, { status: 500 });
  }
}
