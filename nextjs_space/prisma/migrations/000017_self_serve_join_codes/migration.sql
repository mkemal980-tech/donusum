-- Birim seviyesinde katılım kodu: üye kuruluşu kaydolan kişi getirir.
--
-- Katılım kodu yalnızca **önceden oluşturulmuş** bir üye kuruluşu hedefleyebiliyordu
-- (`getDescendantUnitIds` kökü bilerek dışarıda bırakır). Tersane2026 gibi, üyesi
-- kendi başvuran bir yapıda bu ters: yönetici her şirketi elle açmadan kod
-- dağıtamıyordu.
--
-- Kullanıcıları doğrudan köke bağlamak çözüm değil: Assessment kuruluşa bağlı
-- (`{ surveyId, unitId }`) ve migration 000013 bunu tekil kılıyor; kökü paylaşan
-- bütün şirketler tek bir değerlendirmeyi paylaşır, birbirlerinin cevaplarını
-- görür ve üzerine yazarlardı. Şema notunun "aynı odanın üyeleri birbirinin
-- cevaplarını paylaşmaz" dediği şey tam olarak bu.
--
-- Çözüm: kod köke bağlanır ama üye kuruluşu kaydolan kişinin yazdığı şirket
-- adından **otomatik** açar. Kullanıcı açısından tek adım; veri modeli açısından
-- izolasyon korunur. Aynı ad ikinci kez gelirse mevcut kuruluşa bağlanır --
-- aynı şirketten ikinci kişi aynı değerlendirmeye katkı verir.

-- Kodun kendisi hangi sektörü getirdiğini taşır. Böylece kök birime ayrıca
-- sektör atamak gerekmez ve farklı sektörler için ayrı kod açılabilir.
ALTER TABLE "UnitJoinCode" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;
ALTER TABLE "UnitJoinCode" ADD COLUMN IF NOT EXISTS "subSectorId" TEXT;

-- true ise `unitId` katılınacak kuruluş değil, altına kuruluş açılacak **üst**
-- birimdir.
ALTER TABLE "UnitJoinCode"
  ADD COLUMN IF NOT EXISTS "createsMemberUnit" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCode" ADD CONSTRAINT "UnitJoinCode_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UnitJoinCode" ADD CONSTRAINT "UnitJoinCode_subSectorId_fkey"
    FOREIGN KEY ("subSectorId") REFERENCES "SubSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
