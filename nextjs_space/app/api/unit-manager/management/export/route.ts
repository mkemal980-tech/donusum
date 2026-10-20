import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadUnitManagementDashboard } from "@/lib/unit-management";
import { buildUnitManagementReportHtml, unitManagementReportTables } from "@/lib/unit-management-report";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  const params = request.nextUrl.searchParams;
  const format = params.get("format");
  if (format !== "html" && format !== "xlsx") return NextResponse.json({ error: "Geçerli rapor biçimi seçilmeli." }, { status: 400 });
  try {
    const data = await loadUnitManagementDashboard(auth, { unitId: params.get("unitId"), surveyId: params.get("surveyId"), periodId: params.get("periodId") });
    if (data.kind !== "group") return NextResponse.json({ error: "Seçili birimin karşılaştırılacak üyesi yok; birimin kendi raporunu kullanın." }, { status: 404 });
    if (format === "html") return new NextResponse(buildUnitManagementReportHtml(data), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    const workbook = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(unitManagementReportTables(data))) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    return new NextResponse(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="birim-yonetimi-raporu.xlsx"' } });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim yönetimi raporu hazırlanamadı:", error);
    return NextResponse.json({ error: "Rapor hazırlanamadı." }, { status: 500 });
  }
}
