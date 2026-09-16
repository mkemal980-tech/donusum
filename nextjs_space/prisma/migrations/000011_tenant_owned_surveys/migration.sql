-- Oda/STK yöneticilerinin diğer tenant'ları etkilemeden kendi anketlerini
-- oluşturabilmesi ve platform anketlerinden güvenli kopyalar türetebilmesi.
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "ownerUnitId" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "sourceSurveyId" TEXT;

CREATE INDEX IF NOT EXISTS "Survey_ownerUnitId_archivedAt_idx"
  ON "Survey"("ownerUnitId", "archivedAt");
CREATE INDEX IF NOT EXISTS "Survey_sourceSurveyId_idx"
  ON "Survey"("sourceSurveyId");

DO $$ BEGIN
  ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_ownerUnitId_fkey"
    FOREIGN KEY ("ownerUnitId") REFERENCES "Unit"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Survey"
    ADD CONSTRAINT "Survey_sourceSurveyId_fkey"
    FOREIGN KEY ("sourceSurveyId") REFERENCES "Survey"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
