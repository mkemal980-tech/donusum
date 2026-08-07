export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { buildSurveyQuestionWhere } from "@/lib/scoring";
import { triggerChoicesFor } from "@/lib/recommendation-triggers";
import {
  buildCascadeGuideSheet,
  buildColumnGuideSheet,
  buildExampleRows,
  buildQuestionReferenceSheet,
  buildRecommendationSheet,
} from "@/lib/recommendation-template";

/**
 * Toplu öneri yükleme şablonu.
 *
 * `?surveyId=` verilirse şablona o anketin soruları ve şıkları da eklenir;
 * yönetici soru metnini elle yazmak yerine kopyalar. Eşleştirme metin
 * üzerinden yapıldığı için bu, hata kaynağını büyük ölçüde kurutur.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const surveyId = new URL(request.url).searchParams.get("surveyId");

    const workbook = XLSX.utils.book_new();

    // Yüklenen sayfa her zaman ilk sayfadır; örnekler ayrı sayfada durur ki
    // silinmeyi unutulan bir örnek satır öneri olarak kaydedilmesin.
    XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(), "Öneriler");
    XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(buildExampleRows()), "Örnekler");
    XLSX.utils.book_append_sheet(workbook, buildCascadeGuideSheet(), "Kademeli Tetikleme");
    XLSX.utils.book_append_sheet(workbook, buildColumnGuideSheet(), "Açıklamalar");

    if (surveyId) {
      const questions = await prisma.question.findMany({
        where: { archivedAt: null, ...buildSurveyQuestionWhere(surveyId) },
        select: { text: true, type: true, options: true },
        orderBy: { order: "asc" },
      });

      const reference = questions.map((question) => {
        const support = triggerChoicesFor(question);
        return {
          text: question.text,
          choices: support.supported
            ? support.choices.map((choice) => ({ label: choice.label, score: choice.score }))
            : [],
        };
      });

      XLSX.utils.book_append_sheet(
        workbook,
        buildQuestionReferenceSheet(reference),
        "Anket Soruları"
      );
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="oneri_yukleme_sablonu.xlsx"',
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error generating recommendation template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
