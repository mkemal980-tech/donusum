-- Tanıtım anketi işareti.
--
-- Kendi kaydolan kullanıcı e-postasını doğrulayıp giriş yaptığında "Henüz
-- Anket Atanmadı" görüyordu: yönetici ona anket atayana kadar yapabileceği
-- hiçbir şey yok. Tanıtım anketi otomatik atanınca döngüyü kendi başına
-- görebiliyor (doldur → puan → öneri → yol haritası).
--
-- Ama bu, gerçek veriyle tanıtım verisini aynı havuza koyar: ziyaretçilerin
-- rastgele cevapları yönetici panosundaki puan ortalamalarını ve sektör
-- istatistiklerini bozar. İşaret bu ayrımı mümkün kılıyor.

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Mevcut demo anketi işaretlenir (adıyla tanınıyor; başka kurulumda kayıt
-- yoksa hiçbir şey olmaz).
UPDATE "Survey" SET "isDemo" = true WHERE "name" LIKE '%(Demo)%';
