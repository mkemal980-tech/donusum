-- Soft-delete için içerik ağacına archivedAt eklenir ve kullanılmayan
-- UserRecommendationCompletion tablosu kaldırılır.
-- Idempotent yazıldı (IF NOT EXISTS / DROP TABLE IF EXISTS): sürüklenmiş (drift)
-- veya kısmen uygulanmış veritabanlarında da güvenle çalışır.
-- Not: DROP TABLE, tablonun kendi kısıtlarını (constraint) da kaldırdığından
-- ayrıca DROP CONSTRAINT gerekmez.

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubCategory" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubLevel" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE IF EXISTS "UserRecommendationCompletion";
