-- Gönderim adımı: değerlendirmeyi kimin kapattığının izi.
--
-- status ve submittedAt alanları 000005'te ileriyi düşünerek eklenmişti ama
-- kullanılmıyordu. Gönderim artık gerçek bir adım: kapatan kişi de tutuluyor,
-- çünkü "bu puanı kim kesinleştirdi" sorusunun cevabı sonradan aranıyor ve
-- tarih tek başına yetmiyor.
--
-- Geri alma bilinçli olarak ayrı bir alan tutmuyor: geri alınan gönderim
-- durumu IN_PROGRESS'e döndürüp izi temizler, kalıcı kayıt ScoreHistory'de
-- (triggerType = 'SUBMISSION') zaten duruyor.

ALTER TABLE "Assessment" ADD COLUMN IF NOT EXISTS "submittedById" TEXT;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_submittedById_fkey"
        FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
