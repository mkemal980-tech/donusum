export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { SCOPE_LEVELS, type ScopeLevelKey, scopeFromLevel } from "@/lib/sector-scope";

/**
 * Sektör × bölüm kapsam matrisi.
 *
 * Kayıt yokluğu bir durum bilgisidir: kuralı olmayan bölüm varsayılan olarak
 * kapsamdadır ve ağırlığı 1'dir. Bu yüzden "Orta" seçildiğinde kayıt silinir,
 * satır şişmez ve yeni eklenen bölümler kendiliğinden herkese açık gelir.
 */

/** Matris ekranının ihtiyaç duyduğu her şey tek istekte. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const surveyId = new URL(request.url).searchParams.get("surveyId");
    if (!surveyId) {
      return NextResponse.json({ error: "surveyId gerekli" }, { status: 400 });
    }

    const [sectors, categories, rules] = await Promise.all([
      prisma.sector.findMany({
        select: {
          id: true,
          name: true,
          subSectors: { select: { id: true, name: true }, orderBy: { order: "asc" } },
        },
        orderBy: { order: "asc" },
      }),
      prisma.category.findMany({
        where: { surveyId, archivedAt: null },
        select: {
          id: true,
          name: true,
          subCategories: {
            where: { archivedAt: null },
            select: { id: true, name: true },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { order: "asc" },
      }),
      prisma.sectorScopeRule.findMany({ where: { surveyId } }),
    ]);

    return NextResponse.json({
      sectors,
      categories,
      rules,
      levels: SCOPE_LEVELS,
    });
  } catch (error) {
    console.error("Error fetching sector scope:", error);
    return NextResponse.json({ error: "Kapsam kuralları alınamadı" }, { status: 500 });
  }
}

/**
 * Tek bir hücreyi günceller.
 *
 * Varsayılan seviye ("Orta") seçilirse kayıt silinir — varsayılanı satır
 * olarak saklamak matrisi gereksiz büyütür ve "kural yok" ile "kural var ama
 * varsayılan" ayrımı hiçbir işe yaramaz.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { sectorId, surveyId, subCategoryId, level } = body ?? {};
    const subSectorId: string | null = body?.subSectorId || null;

    if (!sectorId || !surveyId || !subCategoryId) {
      return NextResponse.json(
        { error: "sectorId, surveyId ve subCategoryId gerekli" },
        { status: 400 }
      );
    }
    if (!SCOPE_LEVELS.some((entry) => entry.key === level)) {
      return NextResponse.json({ error: "Geçersiz seviye" }, { status: 400 });
    }

    const scope = scopeFromLevel(level as ScopeLevelKey);
    const where = { sectorId, subSectorId, surveyId, subCategoryId };

    // Varsayılana dönülüyorsa kaydı sil.
    if (level === "NORMAL") {
      await prisma.sectorScopeRule.deleteMany({ where });
      return NextResponse.json({ success: true, removed: true });
    }

    // subSectorId null olabildiği için @@unique upsert'e güvenilmez
    // (Postgres NULL'ları farklı sayar); açık arama yapılır.
    const existing = await prisma.sectorScopeRule.findFirst({ where });

    const rule = existing
      ? await prisma.sectorScopeRule.update({
          where: { id: existing.id },
          data: { applicable: scope.applicable, weight: scope.weight },
        })
      : await prisma.sectorScopeRule.create({
          data: { ...where, applicable: scope.applicable, weight: scope.weight },
        });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Error saving sector scope rule:", error);
    return NextResponse.json({ error: "Kural kaydedilemedi" }, { status: 500 });
  }
}
