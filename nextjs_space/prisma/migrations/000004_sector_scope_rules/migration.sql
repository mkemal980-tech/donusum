-- Sektöre göre kapsam ve ağırlık kuralları.
--
-- Aynı anket her sektöre aynı ölçüde hitap etmiyor: bir bölüm bir sektörde
-- kritikken diğerinde hiç sorulmaması gerekiyor. Anket tek kalıyor; bu tablo
-- sektör × bölüm bazında hangi bölümün sorulacağını ve ne kadar sayılacağını
-- belirliyor. Kayıt yoksa varsayılan geçerli: kapsamda, ağırlık 1.
--
-- SectorCategoryWeight kaldırılıyor. O tablo kategori düzeyindeydi, hiçbir
-- puana etki etmiyordu (hesabı yazan kod hiç yazılmamıştı) ve hem yerel hem
-- üretim ortamında 0 kayıt içeriyordu — veri kaybı yok. Yerini bölüm
-- düzeyinde çalışan ve gerçekten puana giren SectorScopeRule alıyor.
--
-- Idempotent yazıldı: kısmen uygulanmış veritabanlarında da güvenle çalışır.

-- CreateTable
CREATE TABLE IF NOT EXISTS "SectorScopeRule" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "subSectorId" TEXT,
    "surveyId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "applicable" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectorScopeRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SectorScopeRule_sectorId_subSectorId_surveyId_subCategoryId_key"
    ON "SectorScopeRule"("sectorId", "subSectorId", "surveyId", "subCategoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SectorScopeRule_surveyId_sectorId_idx"
    ON "SectorScopeRule"("surveyId", "sectorId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "SectorScopeRule" ADD CONSTRAINT "SectorScopeRule_sectorId_fkey"
        FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectorScopeRule" ADD CONSTRAINT "SectorScopeRule_subSectorId_fkey"
        FOREIGN KEY ("subSectorId") REFERENCES "SubSector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectorScopeRule" ADD CONSTRAINT "SectorScopeRule_surveyId_fkey"
        FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectorScopeRule" ADD CONSTRAINT "SectorScopeRule_subCategoryId_fkey"
        FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DropTable — kullanılmayan ve boş
DROP TABLE IF EXISTS "SectorCategoryWeight";
