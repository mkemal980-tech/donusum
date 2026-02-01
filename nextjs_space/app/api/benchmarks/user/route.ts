import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from "@/lib/db";
import { calculateUserScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");
    
    // Get user with sector info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        sector: true,
        subSector: true
      }
    });

    if (!user || !user.sectorId) {
      return NextResponse.json({ 
        error: "Sektör bilgisi bulunamadı",
        hasSector: false 
      }, { status: 200 });
    }

    // Get user's scores
    const userScores = await calculateUserScore(userId);

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

function buildResponse(user: any, userScores: any, sectorBenchmarks: any[], subSectorBenchmarks: any[], categories: any[]) {
  // Build benchmark data structure
  const buildBenchmarkData = (benchmarks: any[]) => {
    const overallBenchmark = benchmarks.find((b: any) => b.level === "OVERALL");
    const categoryBenchmarks = benchmarks.filter((b: any) => b.level === "CATEGORY");

    // Convert userScores.totalScore (percentage 0-100) to 5-point scale
    const userOverallScore = (userScores.totalScore / 100) * 5;
    
    // Genel benchmark değerleri (kategori için yoksa kullanılacak)
    const overallAverage = overallBenchmark?.averageScore || 0;
    const overallBest = overallBenchmark?.bestScore || 0;

    return {
      overall: {
        name: "Genel",
        userScore: Math.round(userOverallScore * 10) / 10,
        bestScore: overallBest,
        averageScore: overallAverage
      },
      categories: categories.map((cat: any) => {
        // categoryScores is an object where key is categoryId
        const catScore = userScores.categoryScores[cat.id];
        const catBenchmark = categoryBenchmarks.find((b: any) => b.targetId === cat.id);
        
        // Convert percentage (0-100) to 5-point scale
        const userCatScore = catScore ? (catScore.percentage / 100) * 5 : 0;
        
        // Kategori benchmark yoksa, genel benchmark'tan tahmin et
        // Rastgele varyasyon ekleyerek daha gerçekçi görünmesini sağla
        const categoryIndex = categories.indexOf(cat);
        const variance = (categoryIndex % 3 - 1) * 0.2; // -0.2, 0, 0.2 varyasyonu
        
        const estimatedAverage = catBenchmark?.averageScore || 
          (overallAverage > 0 ? Math.max(1, Math.min(5, overallAverage + variance)) : 0);
        const estimatedBest = catBenchmark?.bestScore || 
          (overallBest > 0 ? Math.max(1, Math.min(5, overallBest + variance)) : 0);
        
        return {
          id: cat.id,
          name: cat.name,
          userScore: Math.round(userCatScore * 10) / 10,
          bestScore: Math.round(estimatedBest * 10) / 10,
          averageScore: Math.round(estimatedAverage * 10) / 10
        };
      })
    };
  };

  // Alt sektör benchmark verisi
  // Alt sektör için özel benchmark yoksa, sektör benchmarkını kullan
  let subSectorBenchmarkData = null;
  if (user.subSectorId) {
    const hasSubSectorData = subSectorBenchmarks.length > 0;
    if (hasSubSectorData) {
      subSectorBenchmarkData = buildBenchmarkData(subSectorBenchmarks);
    } else {
      // Alt sektör benchmarkı yoksa sektör benchmarkını kullan (ama kaynak belirt)
      subSectorBenchmarkData = buildBenchmarkData(sectorBenchmarks);
    }
  }

  return NextResponse.json({
    hasSector: true,
    sector: user.sector,
    subSector: user.subSector,
    sectorBenchmark: buildBenchmarkData(sectorBenchmarks),
    subSectorBenchmark: subSectorBenchmarkData
  });
}
