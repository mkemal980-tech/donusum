-- Oda/STK kampanyaları: her üye kuruluş ayrı değerlendirme üretir.
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "CampaignPrivacyMode" AS ENUM ('IDENTIFIED', 'ANONYMOUS');

CREATE TABLE "SurveyCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantUnitId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "privacyMode" "CampaignPrivacyMode" NOT NULL DEFAULT 'IDENTIFIED',
    "minimumCohortSize" INTEGER NOT NULL DEFAULT 5,
    "deadline" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "memberUnitId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Assessment" ADD COLUMN "campaignRecipientId" TEXT;
ALTER TABLE "ScoreHistory" ADD COLUMN "categoryScores" JSONB;

-- Eski tek-kuruluş değerlendirmeleri uygulama tarafında surveyId + unitId
-- ile bulunmaya devam eder. Kampanyalı değerlendirmelerde aynı üye kuruluşun
-- aynı anketi farklı dönemlerde yeniden yanıtlayabilmesi gerekir.
DROP INDEX IF EXISTS "Assessment_surveyId_unitId_key";
DROP INDEX IF EXISTS "Assessment_surveyId_ownerUserId_key";
CREATE INDEX "Assessment_surveyId_unitId_idx" ON "Assessment"("surveyId", "unitId");
CREATE INDEX "Assessment_surveyId_ownerUserId_idx" ON "Assessment"("surveyId", "ownerUserId");
CREATE UNIQUE INDEX "Assessment_legacy_survey_unit_key"
    ON "Assessment"("surveyId", "unitId")
    WHERE "campaignRecipientId" IS NULL AND "unitId" IS NOT NULL;
CREATE UNIQUE INDEX "Assessment_legacy_survey_owner_key"
    ON "Assessment"("surveyId", "ownerUserId")
    WHERE "campaignRecipientId" IS NULL AND "ownerUserId" IS NOT NULL;
CREATE UNIQUE INDEX "Assessment_campaignRecipientId_key" ON "Assessment"("campaignRecipientId");

CREATE UNIQUE INDEX "CampaignRecipient_campaignId_memberUnitId_key"
    ON "CampaignRecipient"("campaignId", "memberUnitId");
CREATE INDEX "CampaignRecipient_memberUnitId_idx" ON "CampaignRecipient"("memberUnitId");
CREATE INDEX "SurveyCampaign_tenantUnitId_status_idx" ON "SurveyCampaign"("tenantUnitId", "status");
CREATE INDEX "SurveyCampaign_surveyId_status_idx" ON "SurveyCampaign"("surveyId", "status");

ALTER TABLE "SurveyCampaign"
    ADD CONSTRAINT "SurveyCampaign_tenantUnitId_fkey"
    FOREIGN KEY ("tenantUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyCampaign"
    ADD CONSTRAINT "SurveyCampaign_surveyId_fkey"
    FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SurveyCampaign"
    ADD CONSTRAINT "SurveyCampaign_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient"
    ADD CONSTRAINT "CampaignRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "SurveyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignRecipient"
    ADD CONSTRAINT "CampaignRecipient_memberUnitId_fkey"
    FOREIGN KEY ("memberUnitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment"
    ADD CONSTRAINT "Assessment_campaignRecipientId_fkey"
    FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
