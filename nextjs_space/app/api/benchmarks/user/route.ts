import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateUserScore } from "@/lib/scoring";

// Test user ID for development
const TEST_USER_ID = "cmkhjzaa70000x50t7n7fsjxo";

export async function GET() {
  try {
    const userId = TEST_USER_ID;
    
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

    // Get benchmarks for user's sector
    const sectorBenchmarks = await prisma.benchmark.findMany({
      where: {
        sectorId: user.sectorId,
        subSectorId: null
      }
    });

    // Get benchmarks for user's subsector if exists
    const subSectorBenchmarks = user.subSectorId ? await prisma.benchmark.findMany({
      where: {
        sectorId: user.sectorId,
        subSectorId: user.subSectorId
      }
    }) : [];

    // Get categories for category-level benchmarks
    const categories = await prisma.category.findMany({
      orderBy: { order: "asc" }
    });

    // Build benchmark data structure
    const buildBenchmarkData = (benchmarks: any[]) => {
      const overallBenchmark = benchmarks.find((b: any) => b.level === "OVERALL");
      const categoryBenchmarks = benchmarks.filter((b: any) => b.level === "CATEGORY");

      // Convert userScores.totalScore (percentage 0-100) to 5-point scale
      const userOverallScore = (userScores.totalScore / 100) * 5;

      return {
        overall: {
          name: "Genel",
          userScore: Math.round(userOverallScore * 10) / 10,
          bestScore: overallBenchmark?.bestScore || 0,
          averageScore: overallBenchmark?.averageScore || 0
        },
        categories: categories.map((cat: any) => {
          // categoryScores is an object where key is categoryId
          const catScore = userScores.categoryScores[cat.id];
          const catBenchmark = categoryBenchmarks.find((b: any) => b.targetId === cat.id);
          
          // Convert percentage (0-100) to 5-point scale
          const userCatScore = catScore ? (catScore.percentage / 100) * 5 : 0;
          
          return {
            id: cat.id,
            name: cat.name,
            userScore: Math.round(userCatScore * 10) / 10,
            bestScore: catBenchmark?.bestScore || 0,
            averageScore: catBenchmark?.averageScore || 0
          };
        })
      };
    };

    return NextResponse.json({
      hasSector: true,
      sector: user.sector,
      subSector: user.subSector,
      sectorBenchmark: buildBenchmarkData(sectorBenchmarks),
      subSectorBenchmark: user.subSectorId ? buildBenchmarkData(subSectorBenchmarks) : null
    });
  } catch (error) {
    console.error("Error fetching user benchmarks:", error);
    return NextResponse.json({ error: "Failed to fetch benchmarks" }, { status: 500 });
  }
}
