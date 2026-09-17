-- Hesap bağlantısı token'ları özetlenerek saklanır ve davet kendi alanını alır.
--
-- İki ayrı sorun:
--
-- 1) `passwordResetToken` ve `emailVerificationToken` düz metin tutuluyordu.
--    Bir yedek sızıntısı doğrudan hesap devralmaya çevrilebilecek canlı
--    bağlantılar veriyordu. Projenin daha yeni parçası (UnitJoinCode.codeHash)
--    aynı işi zaten özetleyerek yapıyordu.
--
-- 2) Davet bağlantısı `passwordResetToken` alanını ödünç alıyordu. Davet edilen
--    kullanıcı "şifremi unuttum"a bastığında davet bağlantısı ölüyordu -- ve
--    tersi. Destek tarafında "davet linki çalışmıyor" olarak görünüyordu.
--
-- Bu göç, o an elde olan sıfırlama/doğrulama bağlantılarını geçersiz kılar:
-- düz metin sütunları temizleniyor. Kullanıcılar bağlantıyı yeniden isteyebilir.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationExpires" TIMESTAMP(3);

-- Var olan düz metin token'ları özete çevrilemez (özet tek yönlü); temizlenir.
UPDATE "User"
   SET "passwordResetToken" = NULL,
       "passwordResetExpires" = NULL
 WHERE "passwordResetToken" IS NOT NULL;

UPDATE "User"
   SET "emailVerificationToken" = NULL,
       "emailVerificationExpires" = NULL
 WHERE "emailVerificationToken" IS NOT NULL AND "emailVerified" = true;

CREATE INDEX IF NOT EXISTS "User_invitationTokenHash_idx" ON "User"("invitationTokenHash");
CREATE INDEX IF NOT EXISTS "User_passwordResetToken_idx" ON "User"("passwordResetToken");
CREATE INDEX IF NOT EXISTS "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");
