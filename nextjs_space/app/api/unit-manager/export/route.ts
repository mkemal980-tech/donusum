import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { withAuth } from "@/lib/api-utils";
import { ManagedAssessmentError } from "@/lib/managed-assessment";
import { loadUnitAssessmentDetail } from "@/lib/unit-dashboard";
import { buildUnitReportHtml, unitReportTables } from "@/lib/unit-dashboard-report";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;
  const id = request.nextUrl.searchParams.get("assessmentId");
  const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
  if (!id || !["html", "xlsx"].includes(format)) return NextResponse.json({ error: "Değerlendirme ve rapor biçimi seçilmeli." }, { status: 400 });
  try {
    const data = await loadUnitAssessmentDetail(auth, id);
    if (format === "html") return new NextResponse(buildUnitReportHtml(data), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    const workbook = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(unitReportTables(data))) {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      sheet["!cols"] = rows[0].map(() => ({ wch: 26 }));
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    }
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(buffer, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="birim-raporu.xlsx"', "Cache-Control": "no-store",
    } });
  } catch (error) {
    if (error instanceof ManagedAssessmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Birim raporu hazırlanamadı:", error);
    return NextResponse.json({ error: "Birim raporu hazırlanamadı." }, { status: 500 });
  }
}
