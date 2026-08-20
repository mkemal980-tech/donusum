-- Kademeli (devralmalı) öneri tetiklemesi.
--
-- Öneri artık tek bir şıkka değil, cevabın puan eşiğine bağlanabilir:
-- kullanıcının o soruya verdiği cevabın puanı bu değere eşit veya altındaysa
-- öneri gösterilir. Böylece A'yı seçen kullanıcı B, C ve D'nin önerilerini de
-- devralır ve olgunluk basamakları atlanamaz.
--
-- NULL bırakılırsa mevcut davranış (triggerOptions ile tam eşleşme) sürer;
-- bu yüzden veri göçü gerekmez.
-- Idempotent yazıldı: kısmen uygulanmış veritabanlarında da güvenle çalışır.

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN IF NOT EXISTS "triggerMaxAnswerScore" DOUBLE PRECISION;
