-- Birim katılım kodları: kullanıcı kendi kaydolurken geçerli bir kodla
-- belirli bir üye kuruluşa, onun sektör profiline ve isteğe bağlı ankete bağlanır.
CREATE TABLE IF NOT EXISTS "UnitJoinCode" (
  "id" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "label" TEXT,
  "codeHash" TEXT NOT NULL,
  "codePreview" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "surveyId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UnitJoinCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UnitJoinCodeUse" (
  "id" TEXT NOT NULL,
  "joinCodeId" TEXT NOT NULL,
  "userId" TEXT,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UnitJoinCodeUse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UnitJoinCode_codeHash_key" ON "UnitJoinCode"("codeHash");
CREATE INDEX IF NOT EXISTS "UnitJoinCode_unitId_isActive_idx" ON "UnitJoinCode"("unitId", "isActive");
CREATE INDEX IF NOT EXISTS "UnitJoinCode_expiresAt_idx" ON "UnitJoinCode"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "UnitJoinCodeUse_userId_key" ON "UnitJoinCodeUse"("userId");
CREATE INDEX IF NOT EXISTS "UnitJoinCodeUse_joinCodeId_usedAt_idx" ON "UnitJoinCodeUse"("joinCodeId", "usedAt");

DO $$ BEGIN
  ALTER TABLE "UnitJoinCode" ADD CONSTRAINT "UnitJoinCode_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCode" ADD CONSTRAINT "UnitJoinCode_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCode" ADD CONSTRAINT "UnitJoinCode_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCodeUse" ADD CONSTRAINT "UnitJoinCodeUse_joinCodeId_fkey"
    FOREIGN KEY ("joinCodeId") REFERENCES "UnitJoinCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCodeUse" ADD CONSTRAINT "UnitJoinCodeUse_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
