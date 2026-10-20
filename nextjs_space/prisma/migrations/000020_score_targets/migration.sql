-- Kuruluşun kendi hedefi: anketin geneli ya da bir kategori için 100 üzerinden
-- puan ve isteğe bağlı tarih. Hedef yoksa panoda hedef gösterilmez.
CREATE TABLE "ScoreTarget" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "unitId" TEXT,
    "ownerUserId" TEXT,
    "categoryId" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL,
    "targetDate" TIMESTAMP(3),
    "setById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreTarget_pkey" PRIMARY KEY ("id"),
    -- Hedef ya bir birimin ya bir kişinin (kişisel değerlendirme); ikisi birden değil.
    CONSTRAINT "ScoreTarget_single_owner" CHECK (("unitId" IS NULL) <> ("ownerUserId" IS NULL)),
    CONSTRAINT "ScoreTarget_percentage_range" CHECK ("percentage" > 0 AND "percentage" <= 100)
);

CREATE INDEX "ScoreTarget_surveyId_unitId_idx" ON "ScoreTarget"("surveyId", "unitId");
CREATE INDEX "ScoreTarget_surveyId_ownerUserId_idx" ON "ScoreTarget"("surveyId", "ownerUserId");

-- Bir sahibin bir ankette tek genel hedefi ve kategori başına tek hedefi olur.
-- NULL'lar tekil indekste birbirinden farklı sayıldığı için COALESCE ile.
CREATE UNIQUE INDEX "ScoreTarget_owner_scope_key" ON "ScoreTarget"(
    "surveyId", COALESCE("unitId", ''), COALESCE("ownerUserId", ''), COALESCE("categoryId", '')
);

ALTER TABLE "ScoreTarget" ADD CONSTRAINT "ScoreTarget_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreTarget" ADD CONSTRAINT "ScoreTarget_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreTarget" ADD CONSTRAINT "ScoreTarget_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreTarget" ADD CONSTRAINT "ScoreTarget_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreTarget" ADD CONSTRAINT "ScoreTarget_setById_fkey"
  FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
