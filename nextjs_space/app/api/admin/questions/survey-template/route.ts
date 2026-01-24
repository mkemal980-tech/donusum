export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
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
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Build template rows with structure info
    const templateData: any[] = [];
    let rowOrder = 1;
    
    for (const category of survey.categories) {
      for (const subCategory of category.subCategories) {
        if (subCategory.hasSubLevels && subCategory.subLevels.length > 0) {
          // Has sub-levels
          for (const subLevel of subCategory.subLevels) {
            templateData.push({
              kategori_adi: category.name,
              alt_kategori_adi: subCategory.name,
              alt_seviye_adi: subLevel.name,
              soru_metni: '',
              soru_tipi: 'OLCEK_1_5',
              soru_agirligi: 1,
              ironman_ekseni: 'VELOCITY',
              sira: rowOrder++,
              kanit_gerekli: 'FALSE',
              secenekler: '',
              evet_puani: '',
              hayir_puani: ''
            });
          }
        } else {
          // Direct questions under subcategory
          templateData.push({
            kategori_adi: category.name,
            alt_kategori_adi: subCategory.name,
            alt_seviye_adi: '',
            soru_metni: '',
            soru_tipi: 'OLCEK_1_5',
            soru_agirligi: 1,
            ironman_ekseni: 'VELOCITY',
            sira: rowOrder++,
            kanit_gerekli: 'FALSE',
            secenekler: '',
            evet_puani: '',
            hayir_puani: ''
          });
        }
      }
    }
    
    // Add example rows
    const exampleData = [
      {
        kategori_adi: '--- ÖRNEK SATIRLAR (SİLİN) ---',
        alt_kategori_adi: '',
        alt_seviye_adi: '',
        soru_metni: '',
        soru_tipi: '',
        soru_agirligi: '',
        ironman_ekseni: '',
        sira: '',
        kanit_gerekli: '',
        secenekler: '',
        evet_puani: '',
        hayir_puani: ''
      },
      {
        kategori_adi: survey.categories[0]?.name || 'Örnek Kategori',
        alt_kategori_adi: survey.categories[0]?.subCategories[0]?.name || 'Örnek Alt Kategori',
        alt_seviye_adi: survey.categories[0]?.subCategories[0]?.subLevels?.[0]?.name || '',
        soru_metni: 'Örnek: Kuruluşunuz sürdürülebilirlik hedefleri belirlemiş mi?',
        soru_tipi: 'EVET_HAYIR',
        soru_agirligi: 1,
        ironman_ekseni: 'VELOCITY',
        sira: 1,
        kanit_gerekli: 'FALSE',
        secenekler: '',
        evet_puani: 5,
        hayir_puani: 1
      },
      {
        kategori_adi: survey.categories[0]?.name || 'Örnek Kategori',
        alt_kategori_adi: survey.categories[0]?.subCategories[0]?.name || 'Örnek Alt Kategori',
        alt_seviye_adi: survey.categories[0]?.subCategories[0]?.subLevels?.[0]?.name || '',
        soru_metni: 'Örnek: Enerji verimliliği seviyenizi nasıl değerlendirirsiniz?',
        soru_tipi: 'OLCEK_1_5',
        soru_agirligi: 2,
        ironman_ekseni: 'ENDURANCE',
        sira: 2,
        kanit_gerekli: 'TRUE',
        secenekler: '',
        evet_puani: '',
        hayir_puani: ''
      },
      {
        kategori_adi: survey.categories[0]?.name || 'Örnek Kategori',
        alt_kategori_adi: survey.categories[0]?.subCategories[0]?.name || 'Örnek Alt Kategori',
        alt_seviye_adi: survey.categories[0]?.subCategories[0]?.subLevels?.[0]?.name || '',
        soru_metni: 'Örnek: Karbon ayak izi takibi yapıyor musunuz?',
        soru_tipi: 'COKTAN_SECMELI',
        soru_agirligi: 1.5,
        ironman_ekseni: 'VELOCITY',
        sira: 3,
        kanit_gerekli: 'FALSE',
        secenekler: 'yok|Hayır, takip yok|1\nbasit|Basit takip|2\ndetayli|Detaylı takip|4\nentegre|Entegre sistem|5',
        evet_puani: '',
        hayir_puani: ''
      }
    ];
    
    // Combine structure + examples
    const allData = [...templateData, ...exampleData];
    
    const worksheet = XLSX.utils.json_to_sheet(allData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // kategori_adi
      { wch: 25 }, // alt_kategori_adi
      { wch: 25 }, // alt_seviye_adi
      { wch: 60 }, // soru_metni
      { wch: 18 }, // soru_tipi
      { wch: 15 }, // soru_agirligi
      { wch: 18 }, // ironman_ekseni
      { wch: 8 },  // sira
      { wch: 15 }, // kanit_gerekli
      { wch: 45 }, // secenekler
      { wch: 12 }, // evet_puani
      { wch: 12 }, // hayir_puani
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sorular');
    
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
    
    // Create instructions sheet
    const instructionsData = [
      { Kolon: 'kategori_adi', Açıklama: 'Kategori adı - Anket Yapısı sayfasından kopyalayın (zorunlu)', Örnek: 'Çevre' },
      { Kolon: 'alt_kategori_adi', Açıklama: 'Alt kategori adı - Anket Yapısı sayfasından kopyalayın (zorunlu)', Örnek: 'Emisyon Yönetimi' },
      { Kolon: 'alt_seviye_adi', Açıklama: 'Alt seviye adı - varsa doldurun, yoksa boş bırakın', Örnek: 'Ölçüm ve İzleme' },
      { Kolon: 'soru_metni', Açıklama: 'Soru metni (zorunlu)', Örnek: 'Kuruluşunuz...' },
      { Kolon: 'soru_tipi', Açıklama: 'COKTAN_SECMELI, OLCEK_1_5, EVET_HAYIR (zorunlu)', Örnek: 'EVET_HAYIR' },
      { Kolon: 'soru_agirligi', Açıklama: 'Puan çarpanı - sayı (zorunlu)', Örnek: '1' },
      { Kolon: 'ironman_ekseni', Açıklama: 'VELOCITY veya ENDURANCE (zorunlu)', Örnek: 'VELOCITY' },
      { Kolon: 'sira', Açıklama: 'Sıra numarası (opsiyonel)', Örnek: '1' },
      { Kolon: 'kanit_gerekli', Açıklama: 'TRUE veya FALSE (opsiyonel)', Örnek: 'FALSE' },
      { Kolon: 'secenekler', Açıklama: 'COKTAN_SECMELI için: deger|etiket|puan formatı, her seçenek yeni satırda', Örnek: 'dusuk|Düşük|1\norta|Orta|3' },
      { Kolon: 'evet_puani', Açıklama: 'EVET_HAYIR için: Evet cevabının puanı', Örnek: '5' },
      { Kolon: 'hayir_puani', Açıklama: 'EVET_HAYIR için: Hayır cevabının puanı', Örnek: '1' },
    ];
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [
      { wch: 18 },
      { wch: 70 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Açıklamalar');
    
    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    const safeSurveyName = survey.name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').substring(0, 30);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${safeSurveyName}_soru_sablonu.xlsx"`
      }
    });
    
  } catch (error) {
    console.error("Error generating survey template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
