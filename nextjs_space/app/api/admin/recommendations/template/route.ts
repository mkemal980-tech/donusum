export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { buildSurveyQuestionWhere } from "@/lib/scoring";
import { triggerChoicesFor } from "@/lib/recommendation-triggers";
import {
  buildAiBriefSheet,
  buildCascadeGuideSheet,
  buildColumnGuideSheet,
  buildExampleRows,
  buildPrefilledRows,
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
/** Dosya adı için güvenli sadeleştirme: Türkçe harfler ve boşluklar temizlenir. */
function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return name
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => map[ch] ?? ch)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "anket";
}

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const surveyId = new URL(request.url).searchParams.get("surveyId");

    const workbook = XLSX.utils.book_new();

    /**
     * Anket verilmişse her soru × her şık için hazır satır üretilir.
     *
     * Şablonun boş gelmesi işin en yorucu ve en hatalı kısmıydı: soru metnini
     * ve şık etiketini elle kopyalamak. Eşleştirme birebir metinle yapıldığı
     * için tek harflik fark satırı düşürüyordu.
     */
    let survey: { name: string } | null = null;
    let prefilled: ReturnType<typeof buildPrefilledRows> = [];
    let reference: { text: string; choices: { label: string; score: number }[] }[] = [];

    if (surveyId) {
      survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        select: { name: true },
      });

      const questions = await prisma.question.findMany({
        where: { archivedAt: null, ...buildSurveyQuestionWhere(surveyId) },
        select: { text: true, type: true, options: true },
        orderBy: { order: "asc" },
      });

      reference = questions.map((question) => {
        const support = triggerChoicesFor(question);
        return {
          text: question.text,
          choices: support.supported
            ? support.choices.map((choice) => ({ label: choice.label, score: choice.score }))
            : [],
        };
      });

      prefilled = buildPrefilledRows(reference);
    }

    // Yüklenen sayfa her zaman ilk sayfadır; örnekler ayrı sayfada durur ki
    // silinmeyi unutulan bir örnek satır öneri olarak kaydedilmesin.
    XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(prefilled), "Öneriler");
    // Yönerge örneklerden önce: dosyayı bir modele verirken ilk okunacak sayfa.
    XLSX.utils.book_append_sheet(workbook, buildAiBriefSheet(survey?.name), "Yapay Zekâ Yönergesi");
    XLSX.utils.book_append_sheet(workbook, buildRecommendationSheet(buildExampleRows()), "Örnekler");
    XLSX.utils.book_append_sheet(workbook, buildCascadeGuideSheet(), "Kademeli Tetikleme");
    XLSX.utils.book_append_sheet(workbook, buildColumnGuideSheet(), "Açıklamalar");

    if (surveyId) {
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
        // Ankete özel dosya adı: birkaç anketin şablonu aynı klasörde karışmasın.
        "Content-Disposition": `attachment; filename="${
          survey ? `oneri_sablonu_${slugify(survey.name)}` : "oneri_yukleme_sablonu"
        }.xlsx"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error generating recommendation template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
