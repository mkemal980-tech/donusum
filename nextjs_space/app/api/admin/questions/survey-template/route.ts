export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';
import {
  QUESTION_COLUMNS,
  STRUCTURE_COLUMNS,
  buildColumnGuideSheet,
  buildExampleRows,
  buildOptionGuideSheet,
  buildQuestionSheet,
  buildQuestionTypeSheet,
} from "@/lib/question-template";

const SURVEY_COLUMNS = [...STRUCTURE_COLUMNS, ...QUESTION_COLUMNS];

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('surveyId');

    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    // Fetch survey with full structure
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          include: {
            subCategories: {
              orderBy: { order: 'asc' },
              include: {
                subLevels: {
                  orderBy: { order: 'asc' }
                }
              }
            }
          }
        }
      }
    });

    if (!survey) {
      return NextResponse.json({ error: "Anket bulunamadı" }, { status: 404 });
    }

    const workbook = XLSX.utils.book_new();

    // Anketin yapısı hazır satır olarak yazılır; yönetici yalnızca soru
    // alanlarını doldurur. soru_metni boş kalan satırlar yüklemede atlanır.
    const templateData: Record<string, string | number>[] = [];
    let rowOrder = 1;

    for (const category of survey.categories) {
      for (const subCategory of category.subCategories) {
        const subLevelNames = subCategory.hasSubLevels && subCategory.subLevels.length > 0
          ? subCategory.subLevels.map((subLevel) => subLevel.name)
          : [''];

        for (const subLevelName of subLevelNames) {
          templateData.push({
            kategori_adi: category.name,
            alt_kategori_adi: subCategory.name,
            alt_seviye_adi: subLevelName,
            soru_metni: '',
            soru_tipi: 'OLCEK_1_5',
            soru_agirligi: 1,
            ironman_ekseni: 'VELOCITY',
            sira: rowOrder++,
            kanit_gerekli: 'FALSE',
            secenekler: '',
            evet_puani: '',
            hayir_puani: '',
            esik_sorusu: '',
            evet_etiketi: '',
            hayir_etiketi: '',
            alt_secenekler: ''
          });
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, buildQuestionSheet(SURVEY_COLUMNS, templateData), 'Sorular');

    // Create structure reference sheet
    const structureData: any[] = [];
    for (const category of survey.categories) {
      for (const subCategory of category.subCategories) {
        if (subCategory.hasSubLevels && subCategory.subLevels.length > 0) {
          for (const subLevel of subCategory.subLevels) {
            structureData.push({
              'Kategori': category.name,
              'Alt Kategori': subCategory.name,
              'Alt Seviye': subLevel.name,
              'Yapı': 'Alt Seviye'
            });
          }
        } else {
          structureData.push({
            'Kategori': category.name,
            'Alt Kategori': subCategory.name,
            'Alt Seviye': '(Yok - Doğrudan Soru)',
            'Yapı': 'Doğrudan'
          });
        }
      }
    }

    const structureSheet = XLSX.utils.json_to_sheet(structureData);
    structureSheet['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, structureSheet, 'Anket Yapısı');

    // Örnekler ayrı sayfada durur ki silinmeyi unutulan bir örnek satır
    // gerçek anket sorusu olarak kaydedilmesin.
    const firstCategory = survey.categories[0];
    const firstSubCategory = firstCategory?.subCategories[0];
    const exampleRows = buildExampleRows(SURVEY_COLUMNS, {
      kategori_adi: firstCategory?.name || 'Örnek Kategori',
      alt_kategori_adi: firstSubCategory?.name || 'Örnek Alt Kategori',
      alt_seviye_adi: firstSubCategory?.subLevels?.[0]?.name || '',
    });
    XLSX.utils.book_append_sheet(workbook, buildQuestionSheet(SURVEY_COLUMNS, exampleRows), 'Örnekler');

    XLSX.utils.book_append_sheet(workbook, buildQuestionTypeSheet(), 'Soru Tipleri');
    XLSX.utils.book_append_sheet(workbook, buildOptionGuideSheet(), 'Seçenek Yazımı');
    XLSX.utils.book_append_sheet(workbook, buildColumnGuideSheet(SURVEY_COLUMNS), 'Açıklamalar');

    // Convert to buffer with proper encoding
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      compression: true
    });

    // Create safe ASCII filename - transliterate Turkish chars
    const turkishToAscii: { [key: string]: string } = {
      'ç': 'c', 'Ç': 'C',
      'ğ': 'g', 'Ğ': 'G',
      'ı': 'i', 'İ': 'I',
      'ö': 'o', 'Ö': 'O',
      'ş': 's', 'Ş': 'S',
      'ü': 'u', 'Ü': 'U'
    };

    let safeSurveyName = survey.name;
    // Replace Turkish chars
    Object.keys(turkishToAscii).forEach(turkChar => {
      safeSurveyName = safeSurveyName.replace(new RegExp(turkChar, 'g'), turkishToAscii[turkChar]);
    });

    // Clean filename - only ASCII alphanumeric and underscore
    safeSurveyName = safeSurveyName
      .replace(/[^a-zA-Z0-9]/g, '_')  // Replace all non-ASCII-alphanumeric with underscore
      .replace(/_+/g, '_')  // Replace multiple underscores with single
      .replace(/^_|_$/g, '')  // Remove leading/trailing underscores
      .substring(0, 30);

    const filename = `${safeSurveyName}_soru_sablonu.xlsx`;

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
    console.error("Error generating survey template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
