export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';

interface QuestionRow {
  kategori_adi: string;
  alt_kategori_adi: string;
  alt_seviye_adi?: string;
  soru_metni: string;
  soru_tipi: 'COKTAN_SECMELI' | 'OLCEK_1_5' | 'EVET_HAYIR' | 'KADEMELI_PUANLAMA';
  soru_agirligi: number;
  ironman_ekseni: 'VELOCITY' | 'ENDURANCE';
  sira?: number;
  kanit_gerekli?: string;
  secenekler?: string;
  evet_puani?: number;
  hayir_puani?: number;
  esik_sorusu?: string;
  evet_etiketi?: string;
  hayir_etiketi?: string;
  alt_secenekler?: string;
}

interface ValidationError {
  row: number;
  message: string;
}

function mapQuestionType(type: string): 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE' | 'CONDITIONAL_CHOICE' {
  switch (type) {
    case 'OLCEK_1_5': return 'SCALE';
    case 'EVET_HAYIR': return 'YES_NO';
    case 'COKTAN_SECMELI': return 'MULTIPLE_CHOICE';
    case 'KADEMELI_PUANLAMA': return 'CONDITIONAL_CHOICE';
    default: return 'SCALE';
  }
}

function parseOptions(optionsStr: string): any[] {
  if (!optionsStr || typeof optionsStr !== 'string') return [];
  
  const lines = optionsStr.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const parts = line.split('|');
    if (parts.length >= 3) {
      return {
        value: parts[0].trim(),
        label: parts[1].trim(),
        score: parseFloat(parts[2].trim()) || 0
      };
    }
    return null;
  }).filter(Boolean);
}

function parseConditionalOptions(optionsStr: string): any[] {
  if (!optionsStr || typeof optionsStr !== 'string') return [];
  
  const lines = optionsStr.split('\n').filter(line => line.trim());
  return lines.map((line, idx) => {
    const parts = line.split('|');
    if (parts.length >= 2) {
      return {
        value: `option_${idx + 1}`,
        label: parts[0].trim(),
        score: parseFloat(parts[1].trim()) || 0
      };
    }
    return null;
  }).filter(Boolean);
}

function validateRow(row: QuestionRow, rowNumber: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Skip example/header rows
  if (row.kategori_adi?.toString().includes('ÖRNEK') || row.kategori_adi?.toString().includes('---')) {
    return [{ row: rowNumber, message: 'SKIP_ROW' }];
  }
  
  // Structure validations
  if (!row.kategori_adi || row.kategori_adi.toString().trim() === '') {
    errors.push({ row: rowNumber, message: 'kategori_adi boş olamaz' });
  }
  
  if (!row.alt_kategori_adi || row.alt_kategori_adi.toString().trim() === '') {
    errors.push({ row: rowNumber, message: 'alt_kategori_adi boş olamaz' });
  }
  
  // Common validations
  if (!row.soru_metni || row.soru_metni.toString().trim() === '') {
    errors.push({ row: rowNumber, message: 'soru_metni boş olamaz' });
  }
  
  const validTypes = ['COKTAN_SECMELI', 'OLCEK_1_5', 'EVET_HAYIR', 'KADEMELI_PUANLAMA'];
  if (!row.soru_tipi || !validTypes.includes(row.soru_tipi.toString().toUpperCase())) {
    errors.push({ row: rowNumber, message: `soru_tipi geçerli değil (${validTypes.join(', ')})` });
  }
  
  if (row.soru_agirligi === undefined || row.soru_agirligi === null || isNaN(Number(row.soru_agirligi))) {
    errors.push({ row: rowNumber, message: 'soru_agirligi sayı olmalı' });
  }
  
  const validAxes = ['VELOCITY', 'ENDURANCE'];
  if (!row.ironman_ekseni || !validAxes.includes(row.ironman_ekseni.toString().toUpperCase())) {
    errors.push({ row: rowNumber, message: `ironman_ekseni geçerli değil (${validAxes.join(', ')})` });
  }
  
  // Type-specific validations
  const type = row.soru_tipi?.toString().toUpperCase();
  
  if (type === 'COKTAN_SECMELI') {
    if (!row.secenekler || row.secenekler.toString().trim() === '') {
      errors.push({ row: rowNumber, message: 'Çoktan seçmeli soru için secenekler alanı dolu olmalı' });
    } else {
      const options = parseOptions(row.secenekler.toString());
      if (options.length === 0) {
        errors.push({ row: rowNumber, message: 'Çoktan seçmeli seçenek formatı hatalı (deger|etiket|puan)' });
      }
    }
  }
  
  if (type === 'EVET_HAYIR') {
    if (row.evet_puani === undefined || row.evet_puani === null || isNaN(Number(row.evet_puani))) {
      errors.push({ row: rowNumber, message: 'Evet/Hayır seçilmiş ama evet_puani boş veya sayı değil' });
    }
    if (row.hayir_puani === undefined || row.hayir_puani === null || isNaN(Number(row.hayir_puani))) {
      errors.push({ row: rowNumber, message: 'Evet/Hayır seçilmiş ama hayir_puani boş veya sayı değil' });
    }
  }
  
  if (type === 'KADEMELI_PUANLAMA') {
    if (!row.esik_sorusu || row.esik_sorusu.toString().trim() === '') {
      errors.push({ row: rowNumber, message: 'Kademeli puanlama için esik_sorusu boş olamaz' });
    }
    if (!row.alt_secenekler || row.alt_secenekler.toString().trim() === '') {
      errors.push({ row: rowNumber, message: 'Kademeli puanlama için alt_secenekler boş olamaz' });
    } else {
      const options = parseConditionalOptions(row.alt_secenekler.toString());
      if (options.length === 0) {
        errors.push({ row: rowNumber, message: 'Kademeli puanlama alt seçenek formatı hatalı (etiket|puan)' });
      }
    }
  }
  
  return errors;
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const surveyId = formData.get('surveyId') as string;
    
    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }
    
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }
    
    // Fetch survey structure
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        categories: {
          include: {
            subCategories: {
              include: {
                subLevels: true
              }
            }
          }
        }
      }
    });
    
    if (!survey) {
      return NextResponse.json({ error: "Anket bulunamadı" }, { status: 404 });
    }
    
    // Build lookup maps
    const categoryMap = new Map<string, string>();
    const subCategoryMap = new Map<string, { id: string; hasSubLevels: boolean }>();
    const subLevelMap = new Map<string, string>();
    
    for (const category of survey.categories) {
      const catKey = category.name.toLowerCase().trim();
      categoryMap.set(catKey, category.id);
      
      for (const subCategory of category.subCategories) {
        const subCatKey = `${catKey}|${subCategory.name.toLowerCase().trim()}`;
        subCategoryMap.set(subCatKey, {
          id: subCategory.id,
          hasSubLevels: subCategory.hasSubLevels
        });
        
        if (subCategory.hasSubLevels) {
          for (const subLevel of subCategory.subLevels) {
            const subLevelKey = `${subCatKey}|${subLevel.name.toLowerCase().trim()}`;
            subLevelMap.set(subLevelKey, subLevel.id);
          }
        }
      }
    }
    
    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: QuestionRow[] = XLSX.utils.sheet_to_json(worksheet);
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel dosyası boş" }, { status: 400 });
    }
    
    const allErrors: ValidationError[] = [];
    const validRows: { row: QuestionRow; index: number; subLevelId: string | null; subCategoryId: string | null }[] = [];
    let skippedCount = 0;
    
    // Validate all rows and resolve structure
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors = validateRow(row, rowNumber);
      
      // Skip marker rows
      if (errors.length === 1 && errors[0].message === 'SKIP_ROW') {
        skippedCount++;
        return;
      }
      
      if (errors.length > 0) {
        allErrors.push(...errors);
        return;
      }
      
      // Resolve structure
      const catKey = row.kategori_adi.toString().toLowerCase().trim();
      const subCatKey = `${catKey}|${row.alt_kategori_adi.toString().toLowerCase().trim()}`;
      
      if (!categoryMap.has(catKey)) {
        allErrors.push({ row: rowNumber, message: `Kategori bulunamadı: "${row.kategori_adi}"` });
        return;
      }
      
      const subCategoryInfo = subCategoryMap.get(subCatKey);
      if (!subCategoryInfo) {
        allErrors.push({ row: rowNumber, message: `Alt kategori bulunamadı: "${row.alt_kategori_adi}" (Kategori: ${row.kategori_adi})` });
        return;
      }
      
      let subLevelId: string | null = null;
      let subCategoryId: string | null = null;
      
      if (subCategoryInfo.hasSubLevels) {
        // Must have alt_seviye_adi
        if (!row.alt_seviye_adi || row.alt_seviye_adi.toString().trim() === '') {
          allErrors.push({ row: rowNumber, message: `Bu alt kategoride alt seviye belirtmeniz gerekiyor (Alt Kategori: ${row.alt_kategori_adi})` });
          return;
        }
        
        const subLevelKey = `${subCatKey}|${row.alt_seviye_adi.toString().toLowerCase().trim()}`;
        subLevelId = subLevelMap.get(subLevelKey) || null;
        
        if (!subLevelId) {
          allErrors.push({ row: rowNumber, message: `Alt seviye bulunamadı: "${row.alt_seviye_adi}" (Alt Kategori: ${row.alt_kategori_adi})` });
          return;
        }
      } else {
        // Direct questions under subcategory
        subCategoryId = subCategoryInfo.id;
      }
      
      validRows.push({ row, index: rowNumber, subLevelId, subCategoryId });
    });
    
    // Create questions for valid rows
    const createdQuestions = [];
    for (const { row, index, subLevelId, subCategoryId } of validRows) {
      try {
        const type = mapQuestionType(row.soru_tipi.toString().toUpperCase());
        let options: any[] = [];
        let conditionalOptions: any = null;
        
        if (type === 'MULTIPLE_CHOICE') {
          options = parseOptions(row.secenekler?.toString() || '');
        } else if (type === 'YES_NO') {
          options = [
            { value: 'evet', label: 'Evet', score: Number(row.evet_puani) || 5 },
            { value: 'hayir', label: 'Hayır', score: Number(row.hayir_puani) || 1 }
          ];
        } else if (type === 'CONDITIONAL_CHOICE') {
          conditionalOptions = {
            thresholdQuestion: row.esik_sorusu?.toString().trim() || row.soru_metni.toString().trim(),
            yesLabel: row.evet_etiketi?.toString().trim() || 'Evet',
            noLabel: row.hayir_etiketi?.toString().trim() || 'Hayır',
            options: parseConditionalOptions(row.alt_secenekler?.toString() || '')
          };
        }
        
        const question = await prisma.question.create({
          data: {
            text: row.soru_metni.toString().trim(),
            type,
            options,
            conditionalOptions,
            order: row.sira ? Number(row.sira) : index,
            requiresEvidence: row.kanit_gerekli?.toString().toUpperCase() === 'TRUE',
            subLevelId,
            subCategoryId,
            weight: Number(row.soru_agirligi) || 1,
            axisType: row.ironman_ekseni.toString().toUpperCase() as 'VELOCITY' | 'ENDURANCE'
          }
        });
        createdQuestions.push(question);
      } catch (err) {
        console.error(`Error creating question at row ${index}:`, err);
        allErrors.push({ row: index, message: `Veritabanı hatası: ${err}` });
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        totalRows: rows.length - skippedCount,
        successCount: createdQuestions.length,
        errorCount: allErrors.length,
        skippedRows: skippedCount
      },
      errors: allErrors,
      createdQuestions
    });
    
  } catch (error) {
    console.error("Error processing survey bulk upload:", error);
    return NextResponse.json({ error: "Dosya işlenirken hata oluştu" }, { status: 500 });
  }
}
