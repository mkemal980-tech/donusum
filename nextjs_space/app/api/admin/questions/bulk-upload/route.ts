export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';
import {
  ImportRow,
  buildQuestionPayload,
  isEmptyRow,
  normalizeRow,
  validateQuestionRow,
} from "@/lib/question-import";

/**
 * Tek bir alt seviye / alt kategori altına toplu soru yükler.
 *
 * survey-bulk-upload ile aynı iki adımlı akışı kullanır:
 *   1. multipart/form-data + mode=preview → doğrulanmış satırlar, kayıt yok.
 *   2. application/json { subLevelId | subCategoryId, rows } → kaydeder.
 * Burada yapı sabit olduğu için kategori kolonları doğrulanmaz.
 */

type RowError = { row: number; field: string; message: string };

type Target = { subLevelId: string | null; subCategoryId: string | null };

function readRows(buffer: ArrayBuffer): { rows: ImportRow[]; skipped: number } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: ImportRow[] = [];
  let skipped = 0;

  for (const entry of raw) {
    const row = normalizeRow(entry);
    if (isEmptyRow(row) || !row.soru_metni) {
      skipped++;
      continue;
    }
    rows.push(row);
  }

  return { rows, skipped };
}

async function commitRows(rows: ImportRow[], target: Target) {
  const errors: RowError[] = [];
  rows.forEach((row, index) => {
    validateQuestionRow(row).forEach((error) => {
      errors.push({ row: index + 1, field: error.field, message: error.message });
    });
  });

  // Hatalı satır varsa hiçbiri kaydedilmez — yarım aktarım kafa karıştırır.
  if (errors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Bazı satırlar geçersiz, hiçbir soru kaydedilmedi.",
        summary: { totalRows: rows.length, successCount: 0, errorCount: errors.length, skippedRows: 0 },
        errors,
      },
      { status: 400 }
    );
  }

  const created = await prisma.$transaction(
    rows.map((row, index) =>
      prisma.question.create({
        data: {
          ...buildQuestionPayload(row, index + 1),
          subLevelId: target.subLevelId,
          subCategoryId: target.subCategoryId,
        }
      })
    )
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
    createdQuestions: created,
  });
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const subLevelId = typeof body?.subLevelId === 'string' ? body.subLevelId : null;
      const subCategoryId = typeof body?.subCategoryId === 'string' ? body.subCategoryId : null;
      const rawRows = Array.isArray(body?.rows) ? body.rows : null;

      if (!subLevelId && !subCategoryId) {
        return NextResponse.json({ error: "subLevelId veya subCategoryId gerekli" }, { status: 400 });
      }
      if (!rawRows || rawRows.length === 0) {
        return NextResponse.json({ error: "Kaydedilecek satır yok" }, { status: 400 });
      }

      const rows = rawRows.map((entry: Record<string, unknown>) => normalizeRow(entry ?? {}));
      return await commitRows(rows, { subLevelId, subCategoryId });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const subLevelId = formData.get('subLevelId') as string | null;
    const subCategoryId = formData.get('subCategoryId') as string | null;
    const mode = formData.get('mode') as string | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }
    if (!subLevelId && !subCategoryId) {
      return NextResponse.json({ error: "subLevelId veya subCategoryId gerekli" }, { status: 400 });
    }

    const { rows, skipped } = readRows(await file.arrayBuffer());

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Dosyada soru bulunamadı. Soruları şablonun ilk sayfasına (\"Sorular\") yazdığınızdan emin olun." },
        { status: 400 }
      );
    }

    if (mode === 'preview') {
      return NextResponse.json({
        preview: true,
        structure: [],
        skippedRows: skipped,
        rows: rows.map((row, index) => ({
          rowNumber: index + 1,
          values: row,
          errors: validateQuestionRow(row),
        })),
      });
    }

    const response = await commitRows(rows, { subLevelId, subCategoryId });
    const payload = await response.json();
    return NextResponse.json({ ...payload, summary: { ...payload.summary, skippedRows: skipped } }, { status: response.status });

  } catch (error) {
    console.error("Error processing bulk upload:", error);
    return NextResponse.json({ error: "Dosya işlenirken hata oluştu" }, { status: 500 });
  }
}
