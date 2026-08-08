-- Bölüm bazlı görev dağılımı.
--
-- Değerlendirmenin sahibi kuruluş olduktan sonra sıradaki soru "kim neyi
-- dolduracak" oluyor. Anketin tamamını herkese açık bırakmak iki şeyi birden
-- bozuyordu: kimse kendini sorumlu hissetmiyor ve iki kişi aynı soruyu
-- birbirinin üzerine yazabiliyordu.
--
-- Dağıtım bölüm (alt kategori) düzeyindedir; bir bölüm tek kişiye atanır.
-- Tekillik veritabanı düzeyinde zorlanır — uygulama katmanındaki bir kontrol
-- eşzamanlı iki isteğe karşı yeterli olmazdı.
--
-- Kayıt yokluğu bir durum bilgisidir: hiç atama yoksa dağıtım yapılmamıştır
-- ve anket herkese açıktır (dağıtım isteğe bağlı bir özellik).

CREATE TABLE IF NOT EXISTS "SectionAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "subCategoryId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionAssignment_pkey" PRIMARY KEY ("id")
);

-- Bir bölüm tek kişiye.
CREATE UNIQUE INDEX IF NOT EXISTS "SectionAssignment_assessmentId_subCategoryId_key"
    ON "SectionAssignment"("assessmentId", "subCategoryId");

-- "Bu kişiye ne atandı" sorgusu anket ekranının her açılışında çalışır.
CREATE INDEX IF NOT EXISTS "SectionAssignment_assessmentId_assigneeId_idx"
    ON "SectionAssignment"("assessmentId", "assigneeId");

DO $$ BEGIN
    ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assessmentId_fkey"
        FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_subCategoryId_fkey"
        FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assigneeId_fkey"
        FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "SectionAssignment" ADD CONSTRAINT "SectionAssignment_assignedById_fkey"
        FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
