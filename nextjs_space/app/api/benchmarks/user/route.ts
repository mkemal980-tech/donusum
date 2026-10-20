import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { calculateProgressBreakdown, getScoringProfile } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (!auth.success) return auth.response;
  const userId = auth.userId;

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");
    
    /**
     * Kıyas, soruları puanlayan profille aynı sektörden yapılır: birime bağlı
     * kullanıcıda birimin sektörü, değilse kendi profili. Eskiden kullanıcının
     * kendi profili okunuyordu; sorular birimin sektörüne göre puanlanıp başka
     * bir sektörle kıyaslanabiliyordu.
     */
    const user = await getScoringProfile(userId);

    if (!user || !user.sectorId) {
      return NextResponse.json({ 
        error: "Sektör bilgisi bulunamadı",
        hasSector: false 
      }, { status: 200 });
    }

    /**
     * Puan seçili anketle sınırlanır ve ilerleme motorundan gelir: panonun
     * öbür kartları, birim panosu ve yol haritasıyla aynı "mevcut puan".
     */
    const userScores = await calculateProgressBreakdown(userId, { surveyId: surveyId ?? undefined });

    // Build benchmark query - include surveyId filter if provided
    const benchmarkWhere: any = {
      sectorId: user.sectorId,
      subSectorId: null
    };
    if (surveyId) {
      benchmarkWhere.surveyId = surveyId;
    }

    // Get benchmarks for user's sector
    const sectorBenchmarks = await prisma.benchmark.findMany({
      where: benchmarkWhere
    });

    // Get benchmarks for user's subsector if exists
    const subSectorBenchmarkWhere: any = {
      sectorId: user.sectorId,
      subSectorId: user.subSectorId
    };
    if (surveyId) {
      subSectorBenchmarkWhere.surveyId = surveyId;
    }
    
    const subSectorBenchmarks = user.subSectorId ? await prisma.benchmark.findMany({
      where: subSectorBenchmarkWhere
    }) : [];

    // Get categories for category-level benchmarks
    const categoriesWhere: any = { orderBy: { order: "asc" } };
    if (surveyId) {
      const categories = await prisma.category.findMany({
        where: { surveyId },
        orderBy: { order: "asc" }
      });
      return buildResponse(user, userScores, sectorBenchmarks, subSectorBenchmarks, categories);
    } else {
      const categories = await prisma.category.findMany({
        orderBy: { order: "asc" }
      });
      return buildResponse(user, userScores, sectorBenchmarks, subSectorBenchmarks, categories);
    }
  } catch (error) {
    console.error("Error fetching user benchmarks:", error);
    return NextResponse.json({ error: "Failed to fetch benchmarks" }, { status: 500 });
  }
}

function buildResponse(user: any, userScores: Awaited<ReturnType<typeof calculateProgressBreakdown>>, sectorBenchmarks: any[], subSectorBenchmarks: any[], categories: any[]) {
  const categoryNodes = new Map(userScores.categories.map(category => [category.id, category]));
  // Build benchmark data structure
  const buildBenchmarkData = (benchmarks: any[]) => {
    const overallBenchmark = benchmarks.find((b: any) => b.level === "OVERALL");
    const categoryBenchmarks = benchmarks.filter((b: any) => b.level === "CATEGORY");

    // Motorun 1-5 puanı doğrudan kullanılır (%0 → 1.0, %100 → 5.0); kıyaslar da bu ölçekte.
    const userOverallScore = userScores.scores.overallScore;
    
    // Genel benchmark değerleri (kategori için yoksa kullanılacak)
    const overallAverage = overallBenchmark?.averageScore || 0;
    const overallBest = overallBenchmark?.bestScore || 0;

    return {
      overall: {
        name: "Genel",
        userScore: Math.round(userOverallScore * 10) / 10,
        hasBenchmark: Boolean(overallBenchmark),
        bestScore: overallBenchmark ? overallBest : null,
        averageScore: overallBenchmark ? overallAverage : null
      },
      categories: categories.map((cat: any) => {
        const catScore = categoryNodes.get(cat.id);
        const catBenchmark = categoryBenchmarks.find((b: any) => b.targetId === cat.id);

        // Kategori de 1-5 ölçeğinde: eskiden `yüzde / 100 × 5` kullanılıyordu ve
        // %50 alan kategori 2,5 görünüyor, 3,0 olan sektör ortalamasının altında kalıyordu.
        const userCatScore = catScore?.responseCount ? catScore.totalScore : 0;
        
        /**
         * Kategori kıyası yoksa gösterilmez.
         *
         * Burada eskiden genel kıyasa `(index % 3 - 1) * 0.2` varyansı
         * eklenip kategori ortalaması üretiliyordu; koddaki yorum amacı
         * açıkça "daha gerçekçi görünmesini sağla" diye yazıyordu. Ölçülmemiş
         * sayı, ölçülmüş gibi gösterilemez.
         */
        const hasBenchmark = Boolean(catBenchmark);

        return {
          id: cat.id,
          name: cat.name,
          userScore: Math.round(userCatScore * 10) / 10,
          hasBenchmark,
          bestScore: hasBenchmark ? Math.round((catBenchmark!.bestScore ?? 0) * 10) / 10 : null,
          averageScore: hasBenchmark ? Math.round((catBenchmark!.averageScore ?? 0) * 10) / 10 : null
        };
      })
    };
  };

  // Alt sektör benchmark verisi
  // Alt sektör için özel benchmark yoksa, sektör benchmarkını kullan
  /**
   * Alt sektör kıyası yoksa sekme açılmaz.
   *
   * Eskiden sektör verisi alt sektör sekmesine kopyalanıyordu; koddaki yorum
   * "ama kaynak belirt" diyordu ama hiçbir kaynak alanı dönmüyordu. Kullanıcı
   * iki sekmede aynı sayıları görüp aradaki farkı arıyordu.
   */
  let subSectorBenchmarkData = null;
  if (user.subSectorId && subSectorBenchmarks.length > 0) {
    subSectorBenchmarkData = buildBenchmarkData(subSectorBenchmarks);
  }

  return NextResponse.json({
    hasSector: true,
    sector: user.sector,
    subSector: user.subSector,
    sectorBenchmark: buildBenchmarkData(sectorBenchmarks),
    subSectorBenchmark: subSectorBenchmarkData
  });
}
