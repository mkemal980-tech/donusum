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
  void drainOutbox().catch((error) => {
    console.error("[email-queue] drain failed:", error);
  });

  return result.count;
}

/** Bekleyen e-postaları sınırlı eşzamanlılıkla gönderir. */
export async function drainOutbox(limit: number = DRAIN_BATCH) {
  if (!isEmailConfigured()) {
    return { sent: 0, failed: 0, skipped: true as const };
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
  return { sent, failed, skipped: false as const };
}
