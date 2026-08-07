import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth } from '@/lib/api-utils';
import { callLLMForJSON, isLLMConfigured } from '@/lib/llm';
import {
  calculateUserScore,
  getAccessibleSurveyIds,
  getRecommendationsForUser
} from '@/lib/scoring';

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

function buildFallbackRecommendations(
  recommendations: { id: string; title: string }[]
): AIEnhancedRecommendation[] {
  return recommendations.map((rec, index) => ({
    id: rec.id,
    priority: index + 1,
    note: 'Mevcut skor ve öneri sırasına göre önceliklendirildi'
  }));
}

/**
 * Profil hash'i oluşturur - benzer profiller aynı hash'i alır.
 *
 * Öneri kimlikleri de anahtara girer: aynı sektör ve puan profiline sahip iki
 * kullanıcı farklı sorulara cevap verdiyse öneri listeleri de farklı olur ve
 * birinin sıralaması diğerine servis edilemez.
 */
function createProfileHash(
  sectorId: string | null,
  surveyId: string,
  scores: Record<string, number>,
  recommendationIds: string[]
): string {
  const sectorKey = sectorId || 'nosector';
  const recDigest = createHash('sha256')
    .update([...recommendationIds].sort().join(','))
    .digest('hex')
    .slice(0, 16);

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
  
  return `${sectorKey}_${surveyId}_w${weakAreas}_m${midAreas}_s${strongAreas}_r${recDigest}`;
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
  // Kimlik doğrulama zorunlu: userId istekten değil oturumdan gelir.
  // (LLM çağrısı pahalı olduğu için ayrıca dar bir rate limit uygulanır.)
  const auth = await withAuth(request, { rateLimit: 'ai' });
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedSurveyId: string | undefined = body?.surveyId || undefined;

    // Kullanıcının gerçekten erişebildiği anket — istekten gelen değer
    // yalnızca daraltma amacıyla kullanılır, yetki genişletemez.
    const accessibleSurveyIds = await getAccessibleSurveyIds(userId, requestedSurveyId);
    if (accessibleSurveyIds.length === 0) {
      return NextResponse.json(
        { error: 'Erişebileceğiniz bir anket bulunamadı.' },
        { status: 403 }
      );
    }
    // Anket verilmediyse öneri listesi daraltılmaz (Öneriler sayfası da tüm
    // erişilebilir anketleri gösterir); cache satırı yabancı anahtar taşıdığı
    // için yine gerçek bir ankete sabitlenir.
    const scopeSurveyId = requestedSurveyId;
    const surveyId = requestedSurveyId ?? [...accessibleSurveyIds].sort()[0];

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

    // Öneriler ve puanlar sunucuda türetilir; istemciden gelen listeye
    // güvenilmez (başka kullanıcının önerileri sıraya sokulamasın diye).
    const userRecommendations = await getRecommendationsForUser(userId, {
      surveyId: scopeSurveyId
    });
    const recommendations = userRecommendations.map(r => ({ id: r.id, title: r.title }));

    if (recommendations.length === 0) {
      return NextResponse.json({
        recommendations: [],
        fromCache: false,
        fromAI: false,
        cacheExpires: null
      });
    }

    const { categoryScores: scoreDetail } = await calculateUserScore(userId, scopeSurveyId);
    const categoryScores: Record<string, number> = {};
    for (const detail of Object.values(scoreDetail)) {
      categoryScores[detail.name] = detail.scoreOn5;
    }

    // Profil hash'i oluştur
    const profileHash = createProfileHash(
      user.sectorId,
      surveyId,
      categoryScores,
      recommendations.map(r => r.id)
    );

    // 1. Önce cache'i kontrol et
    const cachedResult = await prisma.aIRecommendationCache.findUnique({
      where: { profileHash }
    });

    if (cachedResult && cachedResult.expiresAt > new Date()) {
      // Cache'den döndür
      return NextResponse.json({
        recommendations: cachedResult.recommendations,
        fromCache: true,
        fromAI: true,
        cacheExpires: cachedResult.expiresAt
      });
    }

    // 2. LLM'e batch istek yap
    const sectorName = user.sector?.name || 'Genel';
    const subSectorName = user.subSector?.name || '';
    
    // Zayıf ve güçlü alanları belirle
    const weakAreas = Object.entries(categoryScores)
      .filter(([, s]) => s < 2.5)
      .map(([name, score]) => `${name} (${score.toFixed(1)})`)
      .join(', ');
    
    const strongAreas = Object.entries(categoryScores)
      .filter(([, s]) => s >= 4)
      .map(([name, score]) => `${name} (${score.toFixed(1)})`)
      .join(', ');

    // Öneri sayısını sınırla (max 15)
    const limitedRecs = recommendations.slice(0, 15);
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

    if (!isLLMConfigured()) {
      return NextResponse.json({
        recommendations: buildFallbackRecommendations(limitedRecs),
        fromCache: false,
        fromAI: false,
        cacheExpires: null
      });
    }

    let aiResult: AIResponse;
    try {
      aiResult = await callLLMForJSON<AIResponse>(prompt, systemPrompt, {
        temperature: 0.3,
        maxTokens: 2000
      });
    } catch (aiError) {
      console.error('AI provider unavailable, using fallback recommendations:', aiError);
      return NextResponse.json({
        recommendations: buildFallbackRecommendations(limitedRecs),
        fromCache: false,
        fromAI: false,
        cacheExpires: null
      });
    }

    // Eksik önerileri varsayılan öncelikle ekle.
    // Model bozuk JSON döndürürse `recommendations` alanı olmayabilir.
    const aiRecs = Array.isArray(aiResult?.recommendations) ? aiResult.recommendations : [];
    const processedRecs = recommendations.map((rec, index) => {
      const aiRec = aiRecs.find(r => r?.id === rec.id);
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
      fromAI: true,
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
