import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { ExportData } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Veritabanı verilerini dışa aktar
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const tables = searchParams.get('tables')?.split(',') || ['all'];
    const includePasswords = searchParams.get('includePasswords') === 'true';

    // Tüm verileri paralel olarak çek
    const [
      users,
      sectors,
      subSectors,
      surveys,
      categories,
      subCategories,
      subLevels,
      questions,
      recommendations,
      benchmarks,
      ironmanBenchmarks,
      sectorCategoryWeights,
      surveyResponses,
      roadmapItems,
      scoreHistory,
      documents,
      units,
      userSurveyAssignments
    ] = await Promise.all([
      tables.includes('all') || tables.includes('users')
        ? prisma.user.findMany({
            select: {
              id: true,
              email: true,
              password: includePasswords,
              firstName: true,
              lastName: true,
              organization: true,
              sectorId: true,
              subSectorId: true,
              role: true,
              unitId: true,
              region: true,
              targetDate: true,
              targetVelocity: true,
              targetEndurance: true,
              currentScoreDate: true,
              emailVerified: true,
              isActive: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { createdAt: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('sectors')
        ? prisma.sector.findMany({
            include: { subSectors: true },
            orderBy: { order: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('subSectors')
        ? prisma.subSector.findMany({ orderBy: { order: 'asc' } })
        : [],
      tables.includes('all') || tables.includes('surveys')
        ? prisma.survey.findMany({
            include: { categories: true },
            orderBy: { order: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('categories')
        ? prisma.category.findMany({
            include: { subCategories: true },
            orderBy: { order: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('subCategories')
        ? prisma.subCategory.findMany({
            include: { subLevels: true },
            orderBy: { order: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('subLevels')
        ? prisma.subLevel.findMany({
            include: { questions: true },
            orderBy: { order: 'asc' }
          })
        : [],
      tables.includes('all') || tables.includes('questions')
        ? prisma.question.findMany({ orderBy: { order: 'asc' } })
        : [],
      tables.includes('all') || tables.includes('recommendations')
        ? prisma.recommendation.findMany({ orderBy: { order: 'asc' } })
        : [],
      tables.includes('all') || tables.includes('benchmarks')
        ? prisma.benchmark.findMany({
            include: { sector: true, subSector: true, survey: true }
          })
        : [],
      tables.includes('all') || tables.includes('ironmanBenchmarks')
        ? prisma.ironmanBenchmark.findMany({
            include: { sector: true, subSector: true }
          })
        : [],
      tables.includes('all') || tables.includes('sectorCategoryWeights')
        ? prisma.sectorCategoryWeight.findMany()
        : [],
      tables.includes('all') || tables.includes('surveyResponses')
        ? prisma.surveyResponse.findMany({
            include: { question: true, documents: true }
          })
        : [],
      tables.includes('all') || tables.includes('roadmapItems')
        ? prisma.roadmapItem.findMany({
            include: { recommendation: true }
          })
        : [],
      tables.includes('all') || tables.includes('scoreHistory')
        ? prisma.scoreHistory.findMany({ orderBy: { recordedAt: 'desc' } })
        : [],
      tables.includes('all') || tables.includes('documents')
        ? prisma.document.findMany()
        : [],
      tables.includes('all') || tables.includes('units')
        ? prisma.unit.findMany({
            include: { subUnits: true, admins: true }
          })
        : [],
      tables.includes('all') || tables.includes('userSurveyAssignments')
        ? prisma.userSurveyAssignment.findMany()
        : []
    ]);

    const exportData: ExportData = {
      exportedAt: new Date(),
      version: '1.0.0',
      data: {
        users: users as ExportData['data']['users'],
        sectors: sectors as ExportData['data']['sectors'],
        surveys: surveys as ExportData['data']['surveys'],
        categories: categories as ExportData['data']['categories'],
        subCategories: subCategories as ExportData['data']['subCategories'],
        subLevels: subLevels as ExportData['data']['subLevels'],
        questions: questions as ExportData['data']['questions'],
        recommendations: recommendations as ExportData['data']['recommendations'],
        benchmarks: benchmarks as ExportData['data']['benchmarks'],
        ironmanBenchmarks: ironmanBenchmarks as ExportData['data']['ironmanBenchmarks'],
        sectorCategoryWeights: sectorCategoryWeights as ExportData['data']['sectorCategoryWeights'],
        surveyResponses: surveyResponses as ExportData['data']['surveyResponses'],
        roadmapItems: roadmapItems as ExportData['data']['roadmapItems'],
        scoreHistory: scoreHistory as ExportData['data']['scoreHistory']
      }
    };

    // Ek veriler (ExportData tipinde olmayan)
    const fullExport = {
      ...exportData,
      data: {
        ...exportData.data,
        subSectors,
        documents,
        units,
        userSurveyAssignments
      }
    };

    if (format === 'json') {
      const filename = `export_${new Date().toISOString().split('T')[0]}.json`;
      
      return new NextResponse(JSON.stringify(fullExport, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    // CSV formatı için basit tablo yapısı
    if (format === 'csv') {
      const table = searchParams.get('table') || 'users';
      let csvData: Record<string, unknown>[] = [];

      switch (table) {
        case 'users':
          csvData = users;
          break;
        case 'sectors':
          csvData = sectors;
          break;
        case 'surveys':
          csvData = surveys;
          break;
        case 'categories':
          csvData = categories;
          break;
        case 'questions':
          csvData = questions;
          break;
        case 'recommendations':
          csvData = recommendations;
          break;
        case 'surveyResponses':
          csvData = surveyResponses;
          break;
        case 'scoreHistory':
          csvData = scoreHistory;
          break;
        default:
          csvData = users;
      }

      const csv = convertToCSV(csvData);
      const filename = `${table}_${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    }

    return NextResponse.json(fullExport);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Veri dışa aktarılırken hata oluştu' },
      { status: 500 }
    );
  }
}

// Yardımcı fonksiyon: Object array'i CSV'ye çevir
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Header satırı
  csvRows.push(headers.join(','));

  // Veri satırları
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
      const stringValue = String(value);
      // CSV özel karakterleri escape et
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
