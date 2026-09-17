import { prisma } from "./db";
import { isEmailConfigured, sendEmail, type SendEmailInput } from "./email";

/**
 * E-posta kuyruğu.
 *
 * Gönderim eskiden HTTP isteğinin içinde yapılıyordu ve iki rota aynı sorunun
 * iki zıt ucundaydı: kampanya hatırlatması alıcı başına **sıralı** ve zaman
 * aşımsız bekliyordu (600 çağrı = kesin zaman aşımı, kaçının gittiği belirsiz,
 * iki tık iki kat spam), toplu davet ise 500 çağrıyı **birden** açıp
 * sağlayıcının saniyelik sınırını aşıyordu.
 *
 * Kuyruk isteği hemen serbest bırakır; gönderim sağlayıcının kaldırabileceği
 * eşzamanlılıkta akar ve başarısız olan yeniden denenir. `dedupeKey` aynı işin
 * iki kez kuyruğa girmesini engeller.
 */

const MAX_ATTEMPTS = 3;
const CONCURRENCY = 4;
const DRAIN_BATCH = 50;

export type QueuedEmail = SendEmailInput & { dedupeKey?: string };

export type DrainResult = { sent: number; failed: number; skipped: boolean };

export async function queueEmails(emails: QueuedEmail[]): Promise<number> {
  if (emails.length === 0) return 0;

  const result = await prisma.emailOutbox.createMany({
    data: emails.map((email) => ({
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text ?? null,
      dedupeKey: email.dedupeKey ?? null,
    })),
    // Aynı dedupeKey ikinci kez gelirse sessizce atlanır.
    skipDuplicates: true,
  });

  // Kuyruğu arka planda boşalt; isteği bekletme.
  void drainOutbox().catch((error: unknown) => {
    console.error("[email-queue] drain failed:", error);
  });

  return result.count;
}

/** Bekleyen e-postaları sınırlı eşzamanlılıkla gönderir. */
export async function drainOutbox(limit: number = DRAIN_BATCH): Promise<DrainResult> {
  if (!isEmailConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const pending = await prisma.emailOutbox.findMany({
    where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  // Sabit boyutlu havuz: sağlayıcının saniyelik sınırını aşmadan ilerler.
  const queue = [...pending];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const result = await sendEmail({
        to: item.to,
        subject: item.subject,
        html: item.html,
        text: item.text ?? undefined,
      });

      if (result.success) {
        sent += 1;
        await prisma.emailOutbox.update({
          where: { id: item.id },
          data: { status: "SENT", sentAt: new Date(), attempts: item.attempts + 1, lastError: null },
        });
      } else {
        failed += 1;
        const attempts = item.attempts + 1;
        await prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            attempts,
            // Hakkı bitenler FAILED olur ve bir daha denenmez; kayıt durur.
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            lastError: result.error?.slice(0, 500) ?? "unknown",
          },
        });
      }
    }
  });

  await Promise.all(workers);

  /**
   * Parti doluysa devamı var demektir.
   *
   * Tek tahliye en fazla `DRAIN_BATCH` kayıt alıyor; 500 davetlik bir
   * aktarımda geri kalanı kimse almazdı. Kalanı kuyruğun kendisi sürüklüyor.
   * `guard` sonsuz döngüye karşı: her tur en az bir kaydın durumunu
   * değiştiriyor, değiştirmiyorsa durulur.
   */
  const progressed = sent + failed > 0;
  if (pending.length === limit && progressed) {
    const next = await drainOutbox(limit);
    return { sent: sent + next.sent, failed: failed + next.failed, skipped: false };
  }

  return { sent, failed, skipped: false };
}

/** Kuyruğun o anki hâli — yönetim ekranı ve izleme için. */
export async function outboxStatus() {
  const [pending, failed, sent] = await Promise.all([
    prisma.emailOutbox.count({ where: { status: "PENDING" } }),
    prisma.emailOutbox.count({ where: { status: "FAILED" } }),
    prisma.emailOutbox.count({ where: { status: "SENT" } }),
  ]);

  const oldestPending = pending > 0
    ? await prisma.emailOutbox.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      })
    : null;

  const lastFailure = failed > 0
    ? await prisma.emailOutbox.findFirst({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        select: { lastError: true, createdAt: true },
      })
    : null;

  return {
    pending,
    failed,
    sent,
    oldestPendingAt: oldestPending?.createdAt ?? null,
    lastError: lastFailure?.lastError ?? null,
    lastErrorAt: lastFailure?.createdAt ?? null,
  };
}

/** Hakkı bitmiş kayıtları yeniden kuyruğa alır (sağlayıcı sorunu geçtikten sonra). */
export async function retryFailed(): Promise<number> {
  const result = await prisma.emailOutbox.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", attempts: 0, lastError: null },
  });
  if (result.count > 0) {
    void drainOutbox().catch((error: unknown) => {
      console.error("[email-queue] retry drain failed:", error);
    });
  }
  return result.count;
}
