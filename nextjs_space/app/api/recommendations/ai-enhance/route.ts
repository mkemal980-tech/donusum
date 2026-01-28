import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callLLMForJSON } from '@/lib/llm';

export const dynamic = 'force-dynamic';

interface AIEnhancedRecommendation {
  id: string;
  priority: number;
  note: string;
}

interface AIResponse {
  recommendations: AIEnhancedRecommendation[];
}

// 24 saat cache süresi
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Profil hash'i oluşturur - benzer profiller aynı hash'i alır
 */
function createProfileHash(
  sectorId: string | null,
  surveyId: string,
  scores: Record<string, number>
): string {
  const sectorKey = sectorId || 'nosector';
  
  // Zayıf alanlar (< 2.5)
  const weakAreas = Object.entries(scores)
    .filter(([, s]) => s < 2.5)
    .map(([k, s]) => `${k}_${Math.round(s)}`)
    .sort()
    .join('|');
  
  // Güçlü alanlar (>= 4)
  const strongAreas = Object.entries(scores)
    .filter(([, s]) => s >= 4)
    .map(([k, s]) => `${k}_${Math.round(s)}`)
    .sort()
    .join('|');
  
  // Orta alanlar (2.5-4 arası)
  const midAreas = Object.entries(scores)
    .filter(([, s]) => s >= 2.5 && s < 4)
    .map(([k, s]) => `${k}_${Math.round(s)}`)
    .sort()
    .join('|');
  
  return `${sectorKey}_${surveyId}_w${weakAreas}_m${midAreas}_s${strongAreas}`;
}

/**
 * Süresi dolmuş cache kayıtlarını temizler
 */
async function cleanExpiredCache() {
  try {
    await prisma.aIRecommendationCache.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  } catch (e) {
    console.error('Cache temizleme hatası:', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, surveyId, recommendations, categoryScores } = body;

    if (!userId || !surveyId || !recommendations || !categoryScores) {
      return NextResponse.json(
        { error: 'Eksik parametreler: userId, surveyId, recommendations, categoryScores gerekli' },
        { status: 400 }
      );
    }

    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sector: true,
        subSector: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
    }

    // Profil hash'i oluştur
    const profileHash = createProfileHash(user.sectorId, surveyId, categoryScores);

    // 1. Önce cache'i kontrol et
    const cachedResult = await prisma.aIRecommendationCache.findUnique({
      where: { profileHash }
    });

    if (cachedResult && cachedResult.expiresAt > new Date()) {
      // Cache'den döndür
      return NextResponse.json({
        recommendations: cachedResult.recommendations,
        fromCache: true,
        cacheExpires: cachedResult.expiresAt
      });
    }

    // 2. LLM'e batch istek yap
    const sectorName = user.sector?.name || 'Genel';
    const subSectorName = user.subSector?.name || '';
    
    // Zayıf ve güçlü alanları belirle
    const weakAreas = Object.entries(categoryScores as Record<string, number>)
      .filter(([, s]) => s < 2.5)
      .map(([name, score]) => `${name} (${score.toFixed(1)})`)
      .join(', ');
    
    const strongAreas = Object.entries(categoryScores as Record<string, number>)
      .filter(([, s]) => s >= 4)
      .map(([name, score]) => `${name} (${score.toFixed(1)})`)
      .join(', ');

    // Öneri başlıklarını al
    const recTitles = (recommendations as { id: string; title: string }[])
      .map((r, i) => `${i + 1}. [ID:${r.id}] ${r.title}`)
      .join('\n');

    const systemPrompt = `Sen bir sürdürülebilirlik danışmanısın. Verilen önerileri kullanıcı profiline göre önceliklendir ve her birine 1 cümle kişisel not ekle. SADECE JSON döndür.`;

    const prompt = `
Kullanıcı Profili:
- Sektör: ${sectorName}${subSectorName ? ` / ${subSectorName}` : ''}
- Zayıf Alanlar: ${weakAreas || 'Yok'}
- Güçlü Alanlar: ${strongAreas || 'Yok'}

Öneriler:
${recTitles}

Görev: Bu önerileri aciliyet ve etki bazında öncelik sırasına koy (1=en öncelikli). Her öneri için sektöre özel 1 cümle kişisel not yaz.

JSON formatı:
{
  "recommendations": [
    { "id": "öneri_id", "priority": 1, "note": "Kişisel not" }
  ]
}
`;

    const aiResult = await callLLMForJSON<AIResponse>(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 800
    });

    // 3. Cache'e kaydet
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    
    await prisma.aIRecommendationCache.upsert({
      where: { profileHash },
      create: {
        profileHash,
        surveyId,
        recommendations: aiResult.recommendations as unknown as object,
        expiresAt
      },
      update: {
        recommendations: aiResult.recommendations as unknown as object,
        expiresAt
      }
    });

    // Arka planda süresi dolmuş cache'leri temizle
    cleanExpiredCache();

    return NextResponse.json({
      recommendations: aiResult.recommendations,
      fromCache: false,
      cacheExpires: expiresAt
    });

  } catch (error) {
    console.error('AI Enhance hatası:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI zenginleştirme hatası' },
      { status: 500 }
    );
  }
}
