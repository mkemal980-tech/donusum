export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

/**
 * Seçilen önerileri tek istekte siler.
 *
 * Tek tek DELETE atmak yerine tek istek: 284 satırlık bir yüklemeyi geri almak
 * gerektiğinde 284 istek hem yavaş hem de yarısı gitmiş bir liste bırakabilir.
 * Silme `deleteMany` ile tek sorguda yapılır; bulunamayan id sessizce atlanır,
 * bu yüzden yanıt gerçekten silinen adedi döner.
 */

/** Tek seferde silinebilecek en fazla öneri — kazara gönderilen dev listeyi keser. */
const MAX_IDS = 1000;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const raw = (body as { ids?: unknown } | null)?.ids;

    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "Silinecek öneri listesi (ids) gerekli." }, { status: 400 });
    }

    const ids = Array.from(
      new Set(raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
    );

    if (ids.length === 0) {
      return NextResponse.json({ error: "Silinecek öneri seçilmedi." }, { status: 400 });
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Tek seferde en fazla ${MAX_IDS} öneri silinebilir.` },
        { status: 400 }
      );
    }

    const result = await prisma.recommendation.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ success: true, deleted: result.count, requested: ids.length });
  } catch (error) {
    console.error("Error bulk deleting recommendations:", error);
    return NextResponse.json({ error: "Öneriler silinemedi." }, { status: 500 });
  }
}
