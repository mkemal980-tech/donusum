export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';
import {
  ImportRow,
  StructureOption,
  buildQuestionPayload,
  isEmptyRow,
  normalizeRow,
  resolveStructure,
  validateQuestionRow,
} from "@/lib/question-import";

/**
 * İki adımlı akış:
 *   1. multipart/form-data + mode=preview → Excel okunur, doğrulanır, hiçbir şey
 *      kaydedilmeden satırlar geri döner (önizleme ekranı bunları düzenletir).
 *   2. application/json { surveyId, rows } → düzenlenmiş satırlar aynı doğrulamadan
 *      tekrar geçirilip kaydedilir. Tarayıcıdan gelen veri doğrulanmış sayılmaz.
 *
 * mode=preview olmadan gönderilen multipart istek eski davranışı korur:
 * doğrudan kaydeder.
 */

type RowError = { row: number; field: string; message: string };

async function loadStructure(surveyId: string): Promise<StructureOption[] | null> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { order: 'asc' },
        include: {
          subCategories: {
            where: { archivedAt: null },
            orderBy: { order: 'asc' },
            include: {
              subLevels: {
                where: { archivedAt: null },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      }
    }
  });

  if (!survey) return null;

  const structure: StructureOption[] = [];
  for (const category of survey.categories) {
    for (const subCategory of category.subCategories) {
      const hasSubLevels = subCategory.hasSubLevels && subCategory.subLevels.length > 0;

      if (hasSubLevels) {
        for (const subLevel of subCategory.subLevels) {
          structure.push({
            categoryId: category.id,
            category: category.name,
            subCategoryId: subCategory.id,
            subCategory: subCategory.name,
            hasSubLevels: true,
            subLevelId: subLevel.id,
            subLevel: subLevel.name,
          });
        }
      } else {
        structure.push({
          categoryId: category.id,
          category: category.name,
          subCategoryId: subCategory.id,
          subCategory: subCategory.name,
          hasSubLevels: false,
          subLevelId: null,
          subLevel: null,
        });
      }
    }
  }

  return structure;
}

function readRows(buffer: ArrayBuffer): { rows: ImportRow[]; skipped: number } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

  const rows: ImportRow[] = [];
  let skipped = 0;

  for (const entry of raw) {
    const row = normalizeRow(entry);

    // Örnek satır işaretleri ve doldurulmamış şablon satırları atlanır.
    const isMarkerRow = /ÖRNEK|---/.test(row.kategori_adi ?? '');
    if (isMarkerRow || isEmptyRow(row) || !row.soru_metni) {
      skipped++;
      continue;
    }

    rows.push(row);
  }

  return { rows, skipped };
}

function validateAll(rows: ImportRow[], structure: StructureOption[]) {
  return rows.map((row) => {
    const structureResult = resolveStructure(row, structure);
    return {
      row,
      match: structureResult.match,
      errors: [...structureResult.errors, ...validateQuestionRow(row)],
    };
  });
}

/** Adım 1 — dosyayı oku, doğrula, kaydetmeden geri dön. */
async function handlePreview(file: File, surveyId: string, structure: StructureOption[]) {
  const { rows, skipped } = readRows(await file.arrayBuffer());

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Dosyada soru bulunamadı. Soruları şablonun ilk sayfasına (\"Sorular\") yazdığınızdan emin olun." },
      { status: 400 }
    );
  }

  const validated = validateAll(rows, structure);

  return NextResponse.json({
    preview: true,
    surveyId,
    structure,
    skippedRows: skipped,
    rows: validated.map((entry, index) => ({
      rowNumber: index + 1,
      values: entry.row,
      errors: entry.errors,
    })),
  });
}

/** Adım 2 — önizlemede düzenlenmiş satırları kaydet. */
async function handleCommit(rows: ImportRow[], structure: StructureOption[]) {
  const validated = validateAll(rows, structure);

  const errors: RowError[] = [];
  validated.forEach((entry, index) => {
    entry.errors.forEach((error) => {
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
    validated.map((entry, index) => {
      const payload = buildQuestionPayload(entry.row, index + 1);
      return prisma.question.create({
        data: {
          ...payload,
          subLevelId: entry.match!.hasSubLevels ? entry.match!.subLevelId : null,
          subCategoryId: entry.match!.hasSubLevels ? null : entry.match!.subCategoryId,
        }
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
      const surveyId = typeof body?.surveyId === 'string' ? body.surveyId : '';
      const rawRows = Array.isArray(body?.rows) ? body.rows : null;

      if (!surveyId) {
        return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
      }
      if (!rawRows || rawRows.length === 0) {
        return NextResponse.json({ error: "Kaydedilecek satır yok" }, { status: 400 });
      }

      const structure = await loadStructure(surveyId);
      if (!structure) {
        return NextResponse.json({ error: "Anket bulunamadı" }, { status: 404 });
      }

      const rows = rawRows.map((entry: Record<string, unknown>) => normalizeRow(entry ?? {}));
      return await handleCommit(rows, structure);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const surveyId = formData.get('surveyId') as string | null;
    const mode = formData.get('mode') as string | null;

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const structure = await loadStructure(surveyId);
    if (!structure) {
      return NextResponse.json({ error: "Anket bulunamadı" }, { status: 404 });
    }

    if (mode === 'preview') {
      return await handlePreview(file, surveyId, structure);
    }

    const { rows, skipped } = readRows(await file.arrayBuffer());
    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel dosyası boş" }, { status: 400 });
    }

    const response = await handleCommit(rows, structure);
    const payload = await response.json();
    return NextResponse.json({ ...payload, summary: { ...payload.summary, skippedRows: skipped } }, { status: response.status });

  } catch (error) {
    console.error("Error processing survey bulk upload:", error);
    return NextResponse.json({ error: "Dosya işlenirken hata oluştu" }, { status: 500 });
  }
}
