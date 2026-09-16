-- Tersanelerin geniş "Diğer ulaşım araçlarının imalatı" başlığı yerine
-- doğrudan kendi faaliyetini seçebilmesi için NACE 30.1 seçeneğini ekler.
-- Mevcut kullanıcı/benchmark bağlantıları olan elle eklenmiş kaydı korur.
DO $$
DECLARE
    manufacturing_sector_id TEXT;
    existing_choice_id TEXT;
BEGIN
    SELECT "id"
      INTO manufacturing_sector_id
      FROM "Sector"
     WHERE "naicsCode" = 'C'
     ORDER BY "createdAt" ASC
     LIMIT 1;

    IF manufacturing_sector_id IS NULL THEN
        RETURN;
    END IF;

    SELECT "id"
      INTO existing_choice_id
      FROM "SubSector"
     WHERE "sectorId" = manufacturing_sector_id
       AND (
           "name" LIKE '[30.1] %'
           OR "name" = 'Gemi, tekne ve yüzer yapı inşası'
       )
     ORDER BY "createdAt" ASC
     LIMIT 1;

    IF existing_choice_id IS NULL THEN
        UPDATE "SubSector"
           SET "order" = "order" + 1
         WHERE "sectorId" = manufacturing_sector_id
           AND "order" >= 22;

        INSERT INTO "SubSector" ("id", "name", "sectorId", "order", "createdAt")
        VALUES (
            'nace_30_1_shipbuilding',
            '[30.1] Gemi, tekne ve yüzer yapı inşası',
            manufacturing_sector_id,
            22,
            CURRENT_TIMESTAMP
        );
    ELSE
        UPDATE "SubSector"
           SET "name" = '[30.1] Gemi, tekne ve yüzer yapı inşası'
         WHERE "id" = existing_choice_id;
    END IF;
END $$;
