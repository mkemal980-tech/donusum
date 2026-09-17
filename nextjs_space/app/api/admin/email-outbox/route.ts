export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { drainOutbox, outboxStatus, retryFailed } from "@/lib/email-queue";

/**
 * E-posta kuyruğunun durumu ve elle tetiklenen tahliye.
 *
 * Gönderim artık isteğin dışında, kuyrukta yapılıyor. Kuyruk normalde yeni bir
 * e-posta sıraya girdiğinde kendiliğinden akıyor; ama sağlayıcı geçici olarak
 * düşerse ya da süreç tahliyenin ortasında yeniden başlarsa bekleyen kayıtları
 * kimse almaz. Bu uç nokta o kolu sağlıyor: yönetici ekrandan tetikleyebilir,
 * ayrıca zamanlanmış bir iş (Railway cron) dakikada bir çağırabilir.
 *
 * Tahliyenin kendisi idempotent: her kayıt gönderilince SENT'e geçiyor,
 * üç denemeden sonra FAILED oluyor ve bir daha denenmiyor.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  return NextResponse.json(await outboxStatus());
}

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: "admin" });
  if (!auth.success) return auth.response;

  const action = request.nextUrl.searchParams.get("action");

  if (action === "retry-failed") {
    const requeued = await retryFailed();
    return NextResponse.json({ requeued, ...(await outboxStatus()) });
  }

  // Varsayılan: bekleyenleri gönder ve sonucu bildir.
  const result = await drainOutbox();
  return NextResponse.json({ ...result, ...(await outboxStatus()) });
}
