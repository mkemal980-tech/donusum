export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import { buildSurveyQuestionWhere } from "@/lib/scoring";
import { derivePosition } from "@/lib/recommendation-position";
import { deriveCostLevels } from "@/lib/recommendation-cost";
import {
  type QuestionContext,
  type RecommendationImportRow,
  buildRecommendationPayload,
  checkLadders,
  isEmptyRow,
  matchQuestion,
  normalizeRow,
  validateRecommendationRow,
} from "@/lib/recommendation-import";

/**
 * Toplu öneri yükleme — soru yüklemeyle aynı iki adımlı akış:
 *   1. multipart/form-data + mode=preview → doğrulanmış satırlar, kayıt yok.
 *   2. application/json { surveyId, rows } → kaydeder.
 *
 * AI taslak üretimi de aynı satır biçimini üretip aynı önizlemeye düşürdüğü
 * için ikinci adım her iki kaynak için ortaktır; onaylanmayan hiçbir şey
 * kaydedilmez.
 */

type RowError = { row: number; field: string; message: string };

async function loadQuestions(surveyId: string): Promise<QuestionContext[]> {
  const questions = await prisma.question.findMany({
    where: { archivedAt: null, ...buildSurveyQuestionWhere(surveyId) },
    select: {
      id: true,
      text: true,
      type: true,
      options: true,
      categoryId: true,
      subCategoryId: true,
      subLevelId: true,
    },
  });
  return questions;
}

function readRows(buffer: ArrayBuffer): { rows: RecommendationImportRow[]; skipped: number } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: RecommendationImportRow[] = [];
  let skipped = 0;

  for (const entry of raw) {
    const row = normalizeRow(entry);
    if (isEmptyRow(row) || !row.baslik) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  return { rows, skipped };
}

/** Satırları doğrular; hepsi geçerliyse tek transaction'da kaydeder. */
async function commitRows(rows: RecommendationImportRow[], questions: QuestionContext[]) {
  const errors: RowError[] = [];

  rows.forEach((row, index) => {
    const match = matchQuestion(row, questions);
    const question = match.found ? match.question : null;
    validateRecommendationRow(row, question).forEach((error) => {
      errors.push({ row: index + 1, field: error.field, message: error.message });
    });
  });

  // Hatalı satır varsa hiçbiri kaydedilmez — yarım aktarım kafa karıştırır.
  if (errors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Bazı satırlar geçersiz, hiçbir öneri kaydedilmedi.",
        summary: { totalRows: rows.length, successCount: 0, errorCount: errors.length, skippedRows: 0 },
        errors,
      },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(
    rows.map((row, index) => {
      const match = matchQuestion(row, questions);
      // Doğrulama geçtiyse eşleşme kesin; tip daraltması için kontrol.
      if (!match.found) throw new Error("Soru eşleşmesi doğrulamadan sonra kayboldu");

      const payload = buildRecommendationPayload(row, match.question, index + 1);
      const position = derivePosition({
        strategicType: payload.strategicType,
        timeframe: payload.timeframe,
        estimatedImpact: payload.estimatedImpact,
      });
      // Şablonda maliyetin türü var, büyüklüğü yok; seviyeler türetilir,
      // yoksa bütün öneriler listede tek dolar işaretiyle görünür.
      const costLevels = deriveCostLevels({
        costType: payload.costType,
        strategicType: payload.strategicType,
        timeframe: payload.timeframe,
      });

      return prisma.recommendation.create({
        data: {
          ...payload,
          ...position,
          ...costLevels,
          costType: payload.costType as "OPEX" | "CAPEX",
          timeframe: payload.timeframe as "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM",
          strategicType: payload.strategicType as "QUICK_WIN" | "PROJECT" | "BIG_BET",
        },
      });
    })
  );

  return NextResponse.json({
    success: true,
    summary: {
      totalRows: rows.length,
      successCount: created.length,
      errorCount: 0,
      skippedRows: 0,
    },
    errors: [],
    createdRecommendations: created.length,
  });
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const contentType = request.headers.get("content-type") || "";

    // 2. adım — önizlemede onaylanan satırların kaydı
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const surveyId = typeof body?.surveyId === "string" ? body.surveyId : null;
      const rawRows = Array.isArray(body?.rows) ? body.rows : null;

      if (!surveyId) {
        return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
      }
      if (!rawRows || rawRows.length === 0) {
        return NextResponse.json({ error: "Kaydedilecek satır yok" }, { status: 400 });
      }

      const questions = await loadQuestions(surveyId);
      const rows = rawRows.map((entry: Record<string, unknown>) => normalizeRow(entry ?? {}));
      return await commitRows(rows, questions);
    }

    // 1. adım — dosyadan önizleme
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const surveyId = formData.get("surveyId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const questions = await loadQuestions(surveyId);
    const { rows, skipped } = readRows(await file.arrayBuffer());

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            'Dosyada öneri bulunamadı. Önerileri şablonun ilk sayfasına ("Öneriler") yazdığınızdan emin olun.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      preview: true,
      skippedRows: skipped,
      questions: questions.map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        options: question.options,
        categoryId: question.categoryId,
        subCategoryId: question.subCategoryId,
        subLevelId: question.subLevelId,
      })),
      rows: rows.map((row, index) => {
        const match = matchQuestion(row, questions);
        return {
          rowNumber: index + 1,
          values: row,
          errors: validateRecommendationRow(row, match.found ? match.question : null),
        };
      }),
      warnings: checkLadders(rows, questions),
    });
  } catch (error) {
    console.error("Error processing recommendation bulk upload:", error);
    return NextResponse.json({ error: "Dosya işlenirken hata oluştu" }, { status: 500 });
  }
}
