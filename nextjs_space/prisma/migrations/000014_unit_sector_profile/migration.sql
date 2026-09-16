-- Kuruluşun sektör profili kendi alanı olur.
--
-- Önceden sektör "birimdeki en eski aktif kullanıcı"dan türetiliyordu; katılım
-- kodu (lib/organization-join-code-server) ve kampanya panosu
-- (lib/organization-campaign) aynı varsayımı paylaşıyordu. O kişi başka
-- sektörden bir danışmansa kodla katılan herkes yanlış sektöre bağlanıyor,
-- yanlış kapsam kuralları ve yanlış kıyas alıyordu; kişi devre dışı kalınca
-- profil kendiliğinden değişiyordu.

ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "sectorId" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "subSectorId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Unit" ADD CONSTRAINT "Unit_sectorId_fkey"
    FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Unit" ADD CONSTRAINT "Unit_subSectorId_fkey"
    FOREIGN KEY ("subSectorId") REFERENCES "SubSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Unit_sectorId_idx" ON "Unit"("sectorId");

-- Mevcut davranışı koru: bugüne kadar profil neyse o taşınır (birimdeki en
-- eski aktif ve sektörü olan kullanıcı). Böylece taşıma sonrası hiçbir
-- kuruluşun kıyası ya da kapsamı değişmez.
UPDATE "Unit" u
   SET "sectorId" = src."sectorId",
       "subSectorId" = src."subSectorId"
  FROM (
    SELECT DISTINCT ON ("unitId") "unitId", "sectorId", "subSectorId"
      FROM "User"
     WHERE "unitId" IS NOT NULL AND "isActive" = true AND "sectorId" IS NOT NULL
     ORDER BY "unitId", "createdAt" ASC
  ) AS src
 WHERE u."id" = src."unitId" AND u."sectorId" IS NULL;
