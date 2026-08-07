/**
 * NACE Rev. 2.1 sektör ve alt sektör listesi.
 *
 * NEDEN NACE
 * Avrupa'nın resmî ekonomik faaliyet sınıflandırması. Regulation (EU)
 * 2023/137 ile kabul edildi, 2025'ten beri yürürlükte ve 27 AB ülkesi +
 * AEA'da şirket kaydı, KDV ve istatistik için zorunlu. CSRD, EU Taxonomy
 * ve SFDR raporlamaları da bu koda dayanıyor.
 *
 * Önceki tohumlayıcı (seed-naics.ts) NAICS kullanıyordu — Kuzey Amerika
 * sınıflandırması. Avrupa'da faaliyet gösteren bir değerlendirme sistemi
 * için yanlış anahtardı.
 *
 * EŞLEME
 *   Sector    → NACE section  (harf, 22 adet)
 *   SubSector → NACE division (2 hane, 87 adet)
 * Grup (3 hane) ve sınıf (4 hane) seviyeleri kapsam kuralı yazmak için
 * fazla ince olduğundan alınmadı.
 *
 * KULLANIM
 *   npm run seed:sectors              # ekler / günceller
 *   npm run seed:sectors -- --dry-run # ne yapılacağını yazar
 *
 * Upsert kullanır: tekrar çalıştırılabilir, elle eklediğiniz sektörlere
 * dokunmaz ve elle düzelttiğiniz isimleri geri almaz (yalnızca sırayı
 * günceller).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Section = {
  code: string;
  name: string;
  divisions: { code: string; name: string }[];
};

/**
 * Bölüm ve alt bölüm adları NACE Rev. 2.1 resmî başlıklarının Türkçe
 * karşılıklarıdır. Yönetim panelinden düzenlenebilir; kurum diline göre
 * kısaltmak veya değiştirmek serbesttir.
 */
export const NACE_SECTIONS: Section[] = [
  {
    code: "A",
    name: "Tarım, ormancılık ve balıkçılık",
    divisions: [
      { code: "01", name: "Bitkisel ve hayvansal üretim, avcılık" },
      { code: "02", name: "Ormancılık ve tomrukçuluk" },
      { code: "03", name: "Balıkçılık ve su ürünleri yetiştiriciliği" },
    ],
  },
  {
    code: "B",
    name: "Madencilik ve taş ocakçılığı",
    divisions: [
      { code: "05", name: "Kömür ve linyit çıkarımı" },
      { code: "06", name: "Ham petrol ve doğal gaz çıkarımı" },
      { code: "07", name: "Metal cevheri madenciliği" },
      { code: "08", name: "Diğer madencilik ve taş ocakçılığı" },
      { code: "09", name: "Madenciliği destekleyici hizmetler" },
    ],
  },
  {
    code: "C",
    name: "İmalat",
    divisions: [
      { code: "10", name: "Gıda ürünleri imalatı" },
      { code: "11", name: "İçecek imalatı" },
      { code: "12", name: "Tütün ürünleri imalatı" },
      { code: "13", name: "Tekstil ürünleri imalatı" },
      { code: "14", name: "Giyim eşyası imalatı" },
      { code: "15", name: "Deri ve ilgili ürünlerin imalatı" },
      { code: "16", name: "Ağaç ve mantar ürünleri imalatı" },
      { code: "17", name: "Kâğıt ve kâğıt ürünleri imalatı" },
      { code: "18", name: "Kayıtlı medyanın basılması ve çoğaltılması" },
      { code: "19", name: "Kok kömürü ve rafine petrol ürünleri imalatı" },
      { code: "20", name: "Kimyasal madde ve ürünlerin imalatı" },
      { code: "21", name: "Temel eczacılık ürünleri imalatı" },
      { code: "22", name: "Kauçuk ve plastik ürünleri imalatı" },
      { code: "23", name: "Diğer metalik olmayan mineral ürünler imalatı" },
      { code: "24", name: "Ana metal sanayii" },
      { code: "25", name: "Fabrikasyon metal ürünleri imalatı" },
      { code: "26", name: "Bilgisayar, elektronik ve optik ürünler imalatı" },
      { code: "27", name: "Elektrikli teçhizat imalatı" },
      { code: "28", name: "Başka yerde sınıflandırılmamış makine imalatı" },
      { code: "29", name: "Motorlu kara taşıtı ve römork imalatı" },
      { code: "30", name: "Diğer ulaşım araçlarının imalatı" },
      { code: "31", name: "Mobilya imalatı" },
      { code: "32", name: "Diğer imalatlar" },
      { code: "33", name: "Makine ve ekipmanların kurulumu ve onarımı" },
    ],
  },
  {
    code: "D",
    name: "Elektrik, gaz, buhar ve iklimlendirme üretimi ve dağıtımı",
    divisions: [{ code: "35", name: "Elektrik, gaz, buhar ve iklimlendirme" }],
  },
  {
    code: "E",
    name: "Su temini, kanalizasyon, atık yönetimi ve iyileştirme",
    divisions: [
      { code: "36", name: "Suyun toplanması, arıtılması ve dağıtımı" },
      { code: "37", name: "Kanalizasyon" },
      { code: "38", name: "Atık toplama, işleme ve bertarafı; geri kazanım" },
      { code: "39", name: "İyileştirme ve diğer atık yönetimi hizmetleri" },
    ],
  },
  {
    code: "F",
    name: "İnşaat",
    divisions: [
      { code: "41", name: "Bina inşaatı" },
      { code: "42", name: "Bina dışı yapıların inşaatı" },
      { code: "43", name: "Özel inşaat faaliyetleri" },
    ],
  },
  {
    code: "G",
    name: "Toptan ve perakende ticaret",
    divisions: [
      { code: "46", name: "Toptan ticaret (motorlu taşıtlar hariç)" },
      { code: "47", name: "Perakende ticaret (motorlu taşıtlar hariç)" },
    ],
  },
  {
    code: "H",
    name: "Ulaştırma ve depolama",
    divisions: [
      { code: "49", name: "Kara taşımacılığı ve boru hattı taşımacılığı" },
      { code: "50", name: "Su yolu taşımacılığı" },
      { code: "51", name: "Havayolu taşımacılığı" },
      { code: "52", name: "Depolama ve taşımacılığı destekleyici faaliyetler" },
      { code: "53", name: "Posta ve kurye faaliyetleri" },
    ],
  },
  {
    code: "I",
    name: "Konaklama ve yiyecek hizmetleri",
    divisions: [
      { code: "55", name: "Konaklama" },
      { code: "56", name: "Yiyecek ve içecek hizmeti faaliyetleri" },
    ],
  },
  {
    code: "J",
    name: "Yayıncılık, içerik üretimi ve dağıtımı",
    divisions: [
      { code: "58", name: "Yayımcılık faaliyetleri" },
      { code: "59", name: "Film, video, TV programı ve müzik yapımcılığı" },
      { code: "60", name: "Programcılık ve yayıncılık faaliyetleri" },
    ],
  },
  {
    code: "K",
    name: "Telekomünikasyon, bilgisayar programlama ve bilgi hizmetleri",
    divisions: [
      { code: "61", name: "Telekomünikasyon" },
      { code: "62", name: "Bilgisayar programlama ve danışmanlık" },
      { code: "63", name: "Bilgi hizmeti faaliyetleri ve bilişim altyapısı" },
    ],
  },
  {
    code: "L",
    name: "Finans ve sigorta faaliyetleri",
    divisions: [
      { code: "64", name: "Finansal hizmet faaliyetleri (sigorta hariç)" },
      { code: "65", name: "Sigorta, reasürans ve emeklilik fonları" },
      { code: "66", name: "Finansal hizmetler için yardımcı faaliyetler" },
    ],
  },
  {
    code: "M",
    name: "Gayrimenkul faaliyetleri",
    divisions: [{ code: "68", name: "Gayrimenkul faaliyetleri" }],
  },
  {
    code: "N",
    name: "Mesleki, bilimsel ve teknik faaliyetler",
    divisions: [
      { code: "69", name: "Hukuki ve muhasebe faaliyetleri" },
      { code: "70", name: "İdare merkezi faaliyetleri; yönetim danışmanlığı" },
      { code: "71", name: "Mimarlık ve mühendislik; teknik test ve analiz" },
      { code: "72", name: "Bilimsel araştırma ve geliştirme" },
      { code: "73", name: "Reklamcılık ve pazar araştırması" },
      { code: "74", name: "Diğer mesleki, bilimsel ve teknik faaliyetler" },
      { code: "75", name: "Veterinerlik hizmetleri" },
    ],
  },
  {
    code: "O",
    name: "İdari ve destek hizmet faaliyetleri",
    divisions: [
      { code: "77", name: "Kiralama ve leasing faaliyetleri" },
      { code: "78", name: "İstihdam faaliyetleri" },
      { code: "79", name: "Seyahat acentesi ve tur operatörü faaliyetleri" },
      { code: "80", name: "Güvenlik ve soruşturma faaliyetleri" },
      { code: "81", name: "Bina ve çevre düzenleme hizmetleri" },
      { code: "82", name: "Büro yönetimi ve iş destek faaliyetleri" },
    ],
  },
  {
    code: "P",
    name: "Kamu yönetimi ve savunma; zorunlu sosyal güvenlik",
    divisions: [{ code: "84", name: "Kamu yönetimi ve savunma" }],
  },
  {
    code: "Q",
    name: "Eğitim",
    divisions: [{ code: "85", name: "Eğitim" }],
  },
  {
    code: "R",
    name: "İnsan sağlığı ve sosyal hizmetler",
    divisions: [
      { code: "86", name: "İnsan sağlığı hizmetleri" },
      { code: "87", name: "Yatılı bakım faaliyetleri" },
      { code: "88", name: "Barınacak yer sağlanmaksızın sosyal hizmetler" },
    ],
  },
  {
    code: "S",
    name: "Sanat, spor ve eğlence",
    divisions: [
      { code: "90", name: "Yaratıcı sanatlar ve gösteri sanatları" },
      { code: "91", name: "Kütüphane, arşiv, müze ve kültürel faaliyetler" },
      { code: "92", name: "Kumar ve müşterek bahis faaliyetleri" },
      { code: "93", name: "Spor, eğlence ve dinlence faaliyetleri" },
    ],
  },
  {
    code: "T",
    name: "Diğer hizmet faaliyetleri",
    divisions: [
      { code: "94", name: "Üye olunan kuruluşların faaliyetleri" },
      { code: "95", name: "Bilgisayar ve kişisel eşyaların onarımı" },
      { code: "96", name: "Diğer kişisel hizmet faaliyetleri" },
    ],
  },
  {
    code: "U",
    name: "Hane halklarının işveren olarak faaliyetleri",
    divisions: [
      { code: "97", name: "Ev içi personel çalıştıran hane halkları" },
      { code: "98", name: "Hane halklarının kendi kullanımına yönelik üretimi" },
    ],
  },
  {
    code: "V",
    name: "Uluslararası örgütler ve temsilcilikler",
    divisions: [{ code: "99", name: "Uluslararası örgüt ve temsilcilik faaliyetleri" }],
  },
];

/**
 * NACE Rev. 2.1 resmî olarak 22 bölüm ve 87 alt bölüm içerir.
 * Liste elle yazıldığı için sayı tutmuyorsa bir şey atlanmış demektir;
 * sessizce eksik veri tohumlamaktansa hata vermek yeğdir.
 */
const EXPECTED_SECTIONS = 22;
const EXPECTED_DIVISIONS = 87;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const divisionCount = NACE_SECTIONS.reduce((sum, s) => sum + s.divisions.length, 0);

  if (NACE_SECTIONS.length !== EXPECTED_SECTIONS || divisionCount !== EXPECTED_DIVISIONS) {
    throw new Error(
      `NACE listesi eksik: ${NACE_SECTIONS.length} bölüm / ${divisionCount} alt bölüm ` +
        `(beklenen ${EXPECTED_SECTIONS} / ${EXPECTED_DIVISIONS})`
    );
  }

  console.log(`\n🇪🇺 NACE Rev. 2.1 — ${NACE_SECTIONS.length} sektör · ${divisionCount} alt sektör`);

  if (dryRun) {
    for (const section of NACE_SECTIONS) {
      console.log(`  [${section.code}] ${section.name}  (${section.divisions.length} alt sektör)`);
    }
    console.log("\nÖn izleme bitti. Kurmak için --dry-run olmadan çalıştırın.\n");
    return;
  }

  let created = 0;
  let updated = 0;

  for (const [index, section] of NACE_SECTIONS.entries()) {
    const name = `[${section.code}] ${section.name}`;

    const existing = await prisma.sector.findUnique({ where: { name } });
    const sector = await prisma.sector.upsert({
      where: { name },
      // Elle düzeltilmiş isimler korunur; yalnızca sıra ve kod güncellenir.
      update: { order: index + 1, naicsCode: section.code },
      create: { name, order: index + 1, naicsCode: section.code },
    });
    existing ? updated++ : created++;

    for (const [subIndex, division] of section.divisions.entries()) {
      const subName = `[${division.code}] ${division.name}`;
      await prisma.subSector.upsert({
        where: { sectorId_name: { sectorId: sector.id, name: subName } },
        update: { order: subIndex + 1 },
        create: { name: subName, sectorId: sector.id, order: subIndex + 1 },
      });
    }
  }

  const totalSectors = await prisma.sector.count();
  const totalSubSectors = await prisma.subSector.count();

  console.log(`\n✅ ${created} sektör eklendi, ${updated} sektör güncellendi.`);
  console.log(`   Sistemdeki toplam: ${totalSectors} sektör · ${totalSubSectors} alt sektör`);
  console.log(
    "   (Fark varsa elle eklenmiş sektörlerdir — bu betik onlara dokunmaz.)\n"
  );
}

main()
  .catch((error) => {
    console.error("\n❌ Hata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
