-- Bir kuruluşun bir ankette tek değerlendirmesi olur.
--
-- `getOrCreateAssessment` önce arayıp sonra oluşturuyordu ve arada koruma
-- yoktu; şemada da bu ikiliye tekillik kısıtı tanımlı değildi. Aynı kuruluştan
-- iki kişinin ilk cevaplarını aynı anda kaydetmesi -- çok kullanıcılı doldurma
-- tam olarak bunu teşvik ediyor -- iki ayrı Assessment üretebiliyordu.
--
-- Sonucu sessizdi: cevaplar ikiye bölünüyor, `@@unique([assessmentId, questionId])`
-- artık aynı soruya iki cevabı engellemiyor, puanlama iki değerlendirmenin
-- puanlarını toplayıp tavanı bir kez hesapladığı için yüzde %100'ü aşıyor ve
-- gönderim kilidi yalnızca birine uygulanıyordu.
--
-- Kısmi indeks: kampanya değerlendirmeleri zaten `campaignRecipientId` üzerinden
-- tekil (o kolon @unique), bu yüzden kapsam dışı bırakılır.

-- Önce varsa mükerrerleri raporla; veri temizlenmeden indeks kurulamaz.
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count FROM (
        SELECT 1 FROM "Assessment"
        WHERE "unitId" IS NOT NULL AND "campaignRecipientId" IS NULL
        GROUP BY "surveyId", "unitId" HAVING COUNT(*) > 1
    ) AS d;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Mukerrer kuruluş değerlendirmesi var (% grup). Once birlestirilmeli: scripts/merge-duplicate-assessments.ts',
            duplicate_count;
    END IF;

    SELECT COUNT(*) INTO duplicate_count FROM (
        SELECT 1 FROM "Assessment"
        WHERE "ownerUserId" IS NOT NULL AND "campaignRecipientId" IS NULL
        GROUP BY "surveyId", "ownerUserId" HAVING COUNT(*) > 1
    ) AS d;

    IF duplicate_count > 0 THEN
        RAISE EXCEPTION
            'Mukerrer kisisel değerlendirme var (% grup). Once birlestirilmeli: scripts/merge-duplicate-assessments.ts',
            duplicate_count;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_survey_unit_key"
  ON "Assessment"("surveyId", "unitId")
  WHERE "unitId" IS NOT NULL AND "campaignRecipientId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_survey_owner_key"
  ON "Assessment"("surveyId", "ownerUserId")
  WHERE "ownerUserId" IS NOT NULL AND "campaignRecipientId" IS NULL;
