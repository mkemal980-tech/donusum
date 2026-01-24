export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from 'xlsx';

interface QuestionRow {
  soru_metni: string;
  soru_tipi: 'COKTAN_SECMELI' | 'OLCEK_1_5' | 'EVET_HAYIR';
  soru_agirligi: number;
  ironman_ekseni: 'VELOCITY' | 'ENDURANCE';
  sira?: number;
  kanit_gerekli?: string;
  secenekler?: string;
  evet_puani?: number;
  hayir_puani?: number;
}

interface ValidationError {
  row: number;
  message: string;
}

function mapQuestionType(type: string): 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE' {
  switch (type) {
    case 'OLCEK_1_5': return 'SCALE';
    case 'EVET_HAYIR': return 'YES_NO';
    case 'COKTAN_SECMELI': return 'MULTIPLE_CHOICE';
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

function validateRow(row: QuestionRow, rowNumber: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Common validations
  if (!row.soru_metni || row.soru_metni.toString().trim() === '') {
    errors.push({ row: rowNumber, message: 'soru_metni boş olamaz' });
  }
  
  const validTypes = ['COKTAN_SECMELI', 'OLCEK_1_5', 'EVET_HAYIR'];
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
  
  if (type === 'OLCEK_1_5') {
    if (row.secenekler && row.secenekler.toString().trim() !== '') {
      // Warning - not error, but we'll note it
      console.log(`Satır ${rowNumber}: Ölçek tipi için secenekler alanı dolu, göz ardı edilecek`);
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
  
  return errors;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const subLevelId = formData.get('subLevelId') as string | null;
    const subCategoryId = formData.get('subCategoryId') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }
    
    if (!subLevelId && !subCategoryId) {
      return NextResponse.json({ error: "subLevelId veya subCategoryId gerekli" }, { status: 400 });
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
    const validRows: { row: QuestionRow; index: number }[] = [];
    
    // Validate all rows
    rows.forEach((row, index) => {
      const rowNumber = index + 2; // Excel starts at 1, plus header
      const errors = validateRow(row, rowNumber);
      if (errors.length > 0) {
        allErrors.push(...errors);
      } else {
        validRows.push({ row, index: rowNumber });
      }
    });
    
    // Create questions for valid rows
    const createdQuestions = [];
    for (const { row, index } of validRows) {
      try {
        const type = mapQuestionType(row.soru_tipi.toString().toUpperCase());
        let options: any[] = [];
        
        if (type === 'MULTIPLE_CHOICE') {
          options = parseOptions(row.secenekler?.toString() || '');
        } else if (type === 'YES_NO') {
          options = [
            { value: 'evet', label: 'Evet', score: Number(row.evet_puani) || 5 },
            { value: 'hayir', label: 'Hayır', score: Number(row.hayir_puani) || 1 }
          ];
        }
        
        const question = await prisma.question.create({
          data: {
            text: row.soru_metni.toString().trim(),
            type,
            options,
            order: row.sira ? Number(row.sira) : index,
            requiresEvidence: row.kanit_gerekli?.toString().toUpperCase() === 'TRUE',
            subLevelId: subLevelId || null,
            subCategoryId: subCategoryId || null,
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
        totalRows: rows.length,
        successCount: createdQuestions.length,
        errorCount: allErrors.length
      },
      errors: allErrors,
      createdQuestions
    });
    
  } catch (error) {
    console.error("Error processing bulk upload:", error);
    return NextResponse.json({ error: "Dosya işlenirken hata oluştu" }, { status: 500 });
  }
}
