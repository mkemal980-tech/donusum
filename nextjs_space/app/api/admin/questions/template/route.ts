export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-utils";
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Template headers and example data
    const templateData = [
      {
        soru_metni: 'Örnek Soru 1: Kuruluşunuz sürdürülebilirlik hedefleri belirlemiş mi?',
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
        soru_metni: 'Örnek Soru 2: Karbon ayak izinizi ölçüyor musunuz?',
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
        soru_metni: 'Örnek Soru 3: Enerji verimliliği seviyeniz nedir?',
        soru_tipi: 'COKTAN_SECMELI',
        soru_agirligi: 1.5,
        ironman_ekseni: 'VELOCITY',
        sira: 3,
        kanit_gerekli: 'FALSE',
        secenekler: 'dusuk|Düşük|1\norta|Orta|3\nyuksek|Yüksek|5',
        evet_puani: '',
        hayir_puani: ''
      }
    ];
    
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 60 }, // soru_metni
      { wch: 20 }, // soru_tipi
      { wch: 15 }, // soru_agirligi
      { wch: 18 }, // ironman_ekseni
      { wch: 8 },  // sira
      { wch: 15 }, // kanit_gerekli
      { wch: 40 }, // secenekler
      { wch: 12 }, // evet_puani
      { wch: 12 }, // hayir_puani
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sorular');
    
    // Create instructions sheet
    const instructionsData = [
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
      { wch: 60 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Açıklamalar');
    
    // Convert to buffer with proper encoding
    const buffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });
    
    // Safe filename
    const filename = 'soru_yukleme_sablonu.xlsx';
    
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
    console.error("Error generating template:", error);
    return NextResponse.json({ error: "Şablon oluşturulamadı" }, { status: 500 });
  }
}
