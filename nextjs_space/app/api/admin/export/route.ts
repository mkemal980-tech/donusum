export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// CSV'ye dönüştürme yardımcı fonksiyonu
function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Değeri string'e çevir ve özel karakterleri handle et
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Virgül, tırnak veya yeni satır varsa tırnak içine al
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  ).join('\n');
  
  return `${headerRow}\n${rows}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const surveyId = searchParams.get('surveyId');
    const sectorId = searchParams.get('sectorId');

    let data: any[] = [];
    let headers: string[] = [];
    let filename = 'export';

    switch (type) {
      case 'survey-responses': {
        // Anket cevaplarını dışa aktar
        const responses = await prisma.surveyResponse.findMany({
          where: surveyId ? {
            question: {
              OR: [
                { subLevel: { subCategory: { category: { surveyId } } } },
                { subCategory: { category: { surveyId } } }
              ]
            }
          } : {},
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                organization: true,
                sector: { select: { name: true } },
                subSector: { select: { name: true } }
              }
            },
            question: {
              include: {
                subLevel: {
                  include: {
                    subCategory: {
                      include: { category: { include: { survey: true } } }
                    }
                  }
                },
                subCategory: {
                  include: { category: { include: { survey: true } } }
                }
              }
            }
          },
          orderBy: [{ createdAt: 'desc' }]
        });

        data = responses.map((r: any) => {
          const category = r.question.subLevel?.subCategory?.category || r.question.subCategory?.category;
          const subCategory = r.question.subLevel?.subCategory || r.question.subCategory;
          
          return {
            'Kullanıcı Adı': [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || '',
            'E-posta': r.user?.email ?? '',
            'Organizasyon': r.user?.organization ?? '',
            'Sektör': r.user?.sector?.name ?? '',
            'Alt Sektör': r.user?.subSector?.name ?? '',
            'Anket': category?.survey?.name ?? '',
            'Kategori': category?.name ?? '',
            'Alt Kategori': subCategory?.name ?? '',
            'Alt Seviye': r.question.subLevel?.name ?? '',
            'Soru': r.question.text,
            'Cevap': r.value,
            'Tarih': r.createdAt.toISOString()
          };
        });

        headers = ['Kullanıcı Adı', 'E-posta', 'Organizasyon', 'Sektör', 'Alt Sektör', 'Anket', 'Kategori', 'Alt Kategori', 'Alt Seviye', 'Soru', 'Cevap', 'Tarih'];
        filename = `anket-cevaplari-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'user-scores': {
        // Kullanıcı puanlarını dışa aktar
        const users = await prisma.user.findMany({
          where: sectorId ? { sectorId } : {},
          include: {
            sector: { select: { name: true } },
            subSector: { select: { name: true } },
            surveyResponses: {
              include: {
                question: {
                  include: {
                    subLevel: { include: { subCategory: { include: { category: true } } } },
                    subCategory: { include: { category: true } }
                  }
                }
              }
            }
          }
        });

        data = users.map((user: any) => {
          const responses = user.surveyResponses ?? [];
          let totalScore = 0;
          let maxScore = 0;

          responses.forEach((r: any) => {
            const question = r.question;
            const weight = question.weight ?? 1;
            let score = 0;

            if (question.type === 'SCALE') {
              score = parseInt(r.value) || 0;
              maxScore += 5 * weight;
            } else if (question.type === 'YES_NO') {
              // Options array formatında: [{ value: 'yes', label: 'Evet', score: 5 }, ...]
              const options = question.options as any;
              if (Array.isArray(options)) {
                const selected = options.find((o: any) => o.value === r.value);
                score = selected?.score ?? (r.value === 'yes' ? 5 : 1);
              } else if (options) {
                // Eski format desteği (yesScore/noScore)
                score = r.value === 'yes' ? (options.yesScore ?? 5) : (options.noScore ?? 1);
              } else {
                // Fallback
                score = r.value === 'yes' ? 5 : 1;
              }
              maxScore += 5 * weight;
            } else if (question.type === 'MULTIPLE_CHOICE') {
              const options = question.options as any[];
              const selected = options?.find((o: any) => o.value === r.value);
              score = selected?.score ?? 0;
              maxScore += 5 * weight;
            }

            totalScore += score * weight;
          });

          const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
          const maturityScore = maxScore > 0 ? (totalScore / maxScore) * 5 : 0;

          let maturityLevel = 'Başlangıç';
          if (maturityScore >= 4.5) maturityLevel = 'Lider';
          else if (maturityScore >= 3.5) maturityLevel = 'Olgun';
          else if (maturityScore >= 2.5) maturityLevel = 'Gelişen';
          else if (maturityScore >= 1.5) maturityLevel = 'Farkındalık';

          return {
            'Kullanıcı Adı': [user.firstName, user.lastName].filter(Boolean).join(' ') || '',
            'E-posta': user.email ?? '',
            'Organizasyon': user.organization ?? '',
            'Sektör': user.sector?.name ?? '',
            'Alt Sektör': user.subSector?.name ?? '',
            'Toplam Cevap': responses.length,
            'Puan Yüzdesi': `${percentage}%`,
            'Olgunluk Puanı (1-5)': maturityScore.toFixed(2),
            'Olgunluk Seviyesi': maturityLevel,
            'Kayıt Tarihi': user.createdAt?.toISOString() ?? ''
          };
        });

        headers = ['Kullanıcı Adı', 'E-posta', 'Organizasyon', 'Sektör', 'Alt Sektör', 'Toplam Cevap', 'Puan Yüzdesi', 'Olgunluk Puanı (1-5)', 'Olgunluk Seviyesi', 'Kayıt Tarihi'];
        filename = `kullanici-puanlari-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'recommendations': {
        // Önerileri dışa aktar
        const recommendations = await prisma.recommendation.findMany({
          where: surveyId ? {
            subLevel: {
              subCategory: {
                category: { surveyId }
              }
            }
          } : {},
          include: {
            subLevel: { 
              include: { 
                subCategory: {
                  include: {
                    category: {
                      include: { survey: true }
                    }
                  }
                }
              } 
            }
          },
          orderBy: [{ order: 'asc' }]
        });

        data = recommendations.map((rec: any) => ({
          'Başlık': rec.title,
          'Açıklama': rec.description,
          'Anket': rec.subLevel?.subCategory?.category?.survey?.name ?? '',
          'Kategori': rec.subLevel?.subCategory?.category?.name ?? '',
          'Alt Kategori': rec.subLevel?.subCategory?.name ?? '',
          'Alt Seviye': rec.subLevel?.name ?? '',
          'Stratejik Tip': rec.strategicType === 'QUICK_WIN' ? 'Hızlı Kazanım' : rec.strategicType === 'PROJECT' ? 'Proje' : 'Büyük Yatırım',
          'Zaman Dilimi': rec.timeframe === 'SHORT_TERM' ? 'Kısa Vade' : rec.timeframe === 'MEDIUM_TERM' ? 'Orta Vade' : 'Uzun Vade',
          'Maliyet Tipi': rec.costType,
          'Tahmini Etki': rec.estimatedImpact,
          'X Pozisyonu': rec.xPosition,
          'Y Pozisyonu': rec.yPosition,
          'CAPEX Seviyesi': rec.capexLevel,
          'OPEX Seviyesi': rec.opexLevel,
          'Min Puan Eşiği': rec.minScoreThreshold,
          'Max Puan Eşiği': rec.maxScoreThreshold,
          'Sıra': rec.order
        }));

        headers = ['Başlık', 'Açıklama', 'Anket', 'Kategori', 'Alt Seviye', 'Stratejik Tip', 'Zaman Dilimi', 'Maliyet Tipi', 'Tahmini Etki', 'X Pozisyonu', 'Y Pozisyonu', 'CAPEX Seviyesi', 'OPEX Seviyesi', 'Min Puan Eşiği', 'Max Puan Eşiği', 'Sıra'];
        filename = `oneriler-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'categories': {
        // Kategorileri ve soruları dışa aktar
        const categories = await prisma.category.findMany({
          where: surveyId ? { surveyId } : {},
          include: {
            survey: true,
            subCategories: {
              include: {
                subLevels: {
                  include: { questions: true }
                },
                questions: true
              }
            }
          },
          orderBy: [{ order: 'asc' }]
        });

        const flatData: any[] = [];
        categories.forEach((cat: any) => {
          cat.subCategories.forEach((subCat: any) => {
            if (subCat.hasSubLevels) {
              subCat.subLevels.forEach((level: any) => {
                level.questions.forEach((q: any) => {
                  flatData.push({
                    'Anket': cat.survey?.name ?? '',
                    'Kategori': cat.name,
                    'Alt Kategori': subCat.name,
                    'Alt Seviye': level.name,
                    'Eksen Tipi': level.axisType ?? '',
                    'Soru': q.text,
                    'Soru Tipi': q.type,
                    'Ağırlık': q.weight,
                    'Kanıt Gerekli': q.requiresEvidence ? 'Evet' : 'Hayır',
                    'Sıra': q.order
                  });
                });
              });
            } else {
              subCat.questions.forEach((q: any) => {
                flatData.push({
                  'Anket': cat.survey?.name ?? '',
                  'Kategori': cat.name,
                  'Alt Kategori': subCat.name,
                  'Alt Seviye': '',
                  'Eksen Tipi': '',
                  'Soru': q.text,
                  'Soru Tipi': q.type,
                  'Ağırlık': q.weight,
                  'Kanıt Gerekli': q.requiresEvidence ? 'Evet' : 'Hayır',
                  'Sıra': q.order
                });
              });
            }
          });
        });

        data = flatData;
        headers = ['Anket', 'Kategori', 'Alt Kategori', 'Alt Seviye', 'Eksen Tipi', 'Soru', 'Soru Tipi', 'Ağırlık', 'Kanıt Gerekli', 'Sıra'];
        filename = `kategoriler-sorular-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      case 'sectors': {
        // Sektörleri dışa aktar
        const sectors = await prisma.sector.findMany({
          include: {
            subSectors: true,
            _count: { select: { users: true } }
          },
          orderBy: [{ order: 'asc' }]
        });

        const flatData: any[] = [];
        sectors.forEach((sector: any) => {
          if (sector.subSectors.length === 0) {
            flatData.push({
              'Sektör': sector.name,
              'Alt Sektör': '',
              'Kullanıcı Sayısı': sector._count.users,
              'Sıra': sector.order
            });
          } else {
            sector.subSectors.forEach((sub: any) => {
              flatData.push({
                'Sektör': sector.name,
                'Alt Sektör': sub.name,
                'Kullanıcı Sayısı': sector._count.users,
                'Sıra': sector.order
              });
            });
          }
        });

        data = flatData;
        headers = ['Sektör', 'Alt Sektör', 'Kullanıcı Sayısı', 'Sıra'];
        filename = `sektorler-${new Date().toISOString().split('T')[0]}`;
        break;
      }

      default:
        return NextResponse.json({ error: 'Geçersiz export tipi' }, { status: 400 });
    }

    // CSV oluştur
    const csv = convertToCSV(data, headers);
    
    // BOM ekle (Excel'de Türkçe karakterlerin düzgün görünmesi için)
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csv;

    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Veri dışa aktarılırken hata oluştu' }, { status: 500 });
  }
}
