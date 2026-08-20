export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';
import {
  QUESTION_COLUMNS,
  buildColumnGuideSheet,
  buildExampleRows,
  buildOptionGuideSheet,
  buildQuestionSheet,
  buildQuestionTypeSheet,
} from "@/lib/question-template";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const workbook = XLSX.utils.book_new();

    // Yüklenen sayfa her zaman ilk sayfadır; örnekler ayrı sayfada durur ki
    // silinmeyi unutulan bir örnek satır anket sorusu olarak kaydedilmesin.
    XLSX.utils.book_append_sheet(workbook, buildQuestionSheet(QUESTION_COLUMNS), 'Sorular');
    XLSX.utils.book_append_sheet(
      workbook,
      buildQuestionSheet(QUESTION_COLUMNS, buildExampleRows(QUESTION_COLUMNS)),
      'Örnekler'
    );
    XLSX.utils.book_append_sheet(workbook, buildQuestionTypeSheet(), 'Soru Tipleri');
    XLSX.utils.book_append_sheet(workbook, buildOptionGuideSheet(), 'Seçenek Yazımı');
    XLSX.utils.book_append_sheet(workbook, buildColumnGuideSheet(QUESTION_COLUMNS), 'Açıklamalar');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    const filename = 'soru_yukleme_sablonu.xlsx';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error("Error generating template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
