-- Değerlendirmenin sahibini kişiden kuruluşa taşır.
--
-- Büyük bir şirkette anketin farklı bölümlerini farklı departmanlar doldurur
-- (atık → çevre, enerji → teknik, sosyal → İK) ve ortaya tek bir kurumsal puan
-- çıkması gerekir. Cevaplar kişiye bağlıyken bu mümkün değildi: üç kişi üç
-- ayrı yarım değerlendirme üretiyordu.
--
-- Artık Assessment = (kuruluş, anket). Cevaplar, yol haritası ve puan geçmişi
-- bu nesneye bağlı; cevabı kimin girdiği yalnızca denetim izi olarak tutulur.
-- Kuruluşu olmayan kullanıcı için tek kişilik değerlendirme açılır ve davranış
-- bugünküyle aynı kalır.
--
-- VERİ KAYBI YOK: sistem henüz canlıya alınmadı; üretimde 0 cevap, 0 yol
-- haritası, 0 puan geçmişi kaydı bulunuyor (doğrulandı). Bu yüzden eski
-- sütunlar taşınmadan doğrudan değiştiriliyor.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AssessmentStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "unitId" TEXT,
    "ownerUserId" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_surveyId_unitId_key" ON "Assessment"("surveyId", "unitId");
CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_surveyId_ownerUserId_key" ON "Assessment"("surveyId", "ownerUserId");

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_surveyId_fkey"
        FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_unitId_fkey"
        FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_ownerUserId_fkey"
        FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SurveyResponse: userId → assessmentId + answeredById
ALTER TABLE "SurveyResponse" DROP CONSTRAINT IF EXISTS "SurveyResponse_userId_fkey";
DROP INDEX IF EXISTS "SurveyResponse_userId_questionId_key";
ALTER TABLE "SurveyResponse" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "assessmentId" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "answeredById" TEXT;
-- Eski cevaplar bir değerlendirmeye eşlenemez (kişiye bağlıydılar, kuruluş
-- kavramı yoktu). Üretimde hiç cevap yok; varsa test verisidir.
DELETE FROM "SurveyResponse" WHERE "assessmentId" IS NULL;
ALTER TABLE "SurveyResponse" ALTER COLUMN "assessmentId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SurveyResponse_assessmentId_questionId_key"
    ON "SurveyResponse"("assessmentId", "questionId");

DO $$ BEGIN
    ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_answeredById_fkey"
        FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RoadmapItem: userId → assessmentId
ALTER TABLE "RoadmapItem" DROP CONSTRAINT IF EXISTS "RoadmapItem_userId_fkey";
DROP INDEX IF EXISTS "RoadmapItem_userId_recommendationId_key";
ALTER TABLE "RoadmapItem" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "RoadmapItem" ADD COLUMN IF NOT EXISTS "assessmentId" TEXT;
DELETE FROM "RoadmapItem" WHERE "assessmentId" IS NULL;
ALTER TABLE "RoadmapItem" ALTER COLUMN "assessmentId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "RoadmapItem_assessmentId_recommendationId_key"
    ON "RoadmapItem"("assessmentId", "recommendationId");

DO $$ BEGIN
    ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ScoreHistory: userId → assessmentId
DROP INDEX IF EXISTS "ScoreHistory_userId_recordedAt_idx";
DROP INDEX IF EXISTS "ScoreHistory_userId_surveyId_recordedAt_idx";
ALTER TABLE "ScoreHistory" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "ScoreHistory" ADD COLUMN IF NOT EXISTS "assessmentId" TEXT;
DELETE FROM "ScoreHistory" WHERE "assessmentId" IS NULL;
ALTER TABLE "ScoreHistory" ALTER COLUMN "assessmentId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ScoreHistory_assessmentId_recordedAt_idx"
    ON "ScoreHistory"("assessmentId", "recordedAt");
CREATE INDEX IF NOT EXISTS "ScoreHistory_assessmentId_surveyId_recordedAt_idx"
    ON "ScoreHistory"("assessmentId", "surveyId", "recordedAt");

DO $$ BEGIN
    ALTER TABLE "ScoreHistory" ADD CONSTRAINT "ScoreHistory_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
