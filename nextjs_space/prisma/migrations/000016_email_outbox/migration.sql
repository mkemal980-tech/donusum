-- E-posta gönderimi HTTP isteğinin dışına taşınır.
--
-- İki rota, aynı sorunun iki zıt ucundaydı:
--
-- - Kampanya hatırlatması iç içe iki döngüde her alıcıya **sıralı** ve zaman
--   aşımsız `await sendEmail` yapıyordu. 200 üye x 3 kullanıcı = 600 sıralı
--   HTTP çağrısı; istek kesin biçimde zaman aşımına düşüyor ve kaçının
--   gittiği bilinmiyordu. İdempotent de değildi: iki tık iki kat spam.
--
-- - Toplu davet ise `Promise.all` ile 500 daveti **eşzamanlı** gönderiyordu;
--   sağlayıcının saniyelik sınırı aşılıyor ve çoğu başarısız oluyordu.
--
-- Kuyruk ikisini de çözer: istek kaydı yazıp hemen döner, gönderim arka planda
-- sağlayıcının kaldırabileceği hızda akar, başarısız olan yeniden denenir.

CREATE TABLE IF NOT EXISTS "EmailOutbox" (
  "id" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "text" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  -- Aynı işin iki kez kuyruğa girmesini engeller (ör. hatırlatma butonuna
  -- iki kez basılması).
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");
