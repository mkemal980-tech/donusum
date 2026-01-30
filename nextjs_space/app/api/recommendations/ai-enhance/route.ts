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

    // Öneri sayısını sınırla (max 15)
    const limitedRecs = (recommendations as { id: string; title: string }[]).slice(0, 15);
    const recTitlesLimited = limitedRecs
      .map((r, i) => `${i + 1}. [ID:${r.id}] ${r.title}`)
      .join('\n');

    const systemPrompt = `Sen bir sürdürülebilirlik danışmanısın. Önerileri önceliklendir ve kısa not ekle. SADECE JSON döndür.`;

    const prompt = `
Profil: ${sectorName}${subSectorName ? ` / ${subSectorName}` : ''}
Zayıf: ${weakAreas || 'Yok'} | Güçlü: ${strongAreas || 'Yok'}

Öneriler:
${recTitlesLimited}

Her öneriyi öncelik sırasına koy (1=en öncelikli). Kısa not ekle (max 15 kelime).

JSON:
{"recommendations":[{"id":"ID","priority":1,"note":"Not"}]}
`;

    const aiResult = await callLLMForJSON<AIResponse>(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 2000
    });
    
    // Eksik önerileri varsayılan öncelikle ekle
    const processedRecs = (recommendations as { id: string; title: string }[]).map((rec, index) => {
      const aiRec = aiResult.recommendations.find(r => r.id === rec.id);
      return aiRec || { id: rec.id, priority: 100 + index, note: '' };
    });

    // 3. Cache'e kaydet
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    
    await prisma.aIRecommendationCache.upsert({
      where: { profileHash },
      create: {
        profileHash,
        surveyId,
        recommendations: processedRecs as unknown as object,
        expiresAt
      },
      update: {
        recommendations: processedRecs as unknown as object,
        expiresAt
      }
    });

    // Arka planda süresi dolmuş cache'leri temizle
    cleanExpiredCache();

    return NextResponse.json({
      recommendations: processedRecs,
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
