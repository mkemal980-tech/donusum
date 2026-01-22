import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// NAICS Sektör ve Alt Sektör Verileri
const naicsData = [
  {
    code: '11',
    name: 'Tarım, Ormancılık, Balıkçılık',
    subSectors: [
      { code: '111', name: 'Bitkisel Üretim' },
      { code: '112', name: 'Hayvansal Üretim' },
      { code: '113', name: 'Ormancılık ve Tomrukçuluk' },
      { code: '114', name: 'Balıkçılık ve Avcılık' },
      { code: '115', name: 'Tarım/Ormancılık Destek Hizmetleri' },
    ],
  },
  {
    code: '21',
    name: 'Madencilik, Petrol ve Gaz',
    subSectors: [
      { code: '211', name: 'Petrol ve Gaz Çıkarımı' },
      { code: '212', name: 'Madencilik (Petrol/Gaz Hariç)' },
      { code: '213', name: 'Madencilik Destek Faaliyetleri' },
    ],
  },
  {
    code: '22',
    name: 'Kamu Hizmetleri (Utilities)',
    subSectors: [
      { code: '221', name: 'Elektrik, Gaz ve Su Tedariki' },
    ],
  },
  {
    code: '23',
    name: 'İnşaat',
    subSectors: [
      { code: '236', name: 'Bina İnşaatı' },
      { code: '237', name: 'Ağır ve Sivil Mühendislik' },
      { code: '238', name: 'Özel Ticari Müteahhitler' },
    ],
  },
  {
    code: '31-33',
    name: 'İmalat (Sanayi)',
    subSectors: [
      { code: '311', name: 'Gıda' },
      { code: '312', name: 'İçecek ve Tütün' },
      { code: '313', name: 'Tekstil Fabrikaları' },
      { code: '315', name: 'Giyim' },
      { code: '325', name: 'Kimyasal' },
      { code: '326', name: 'Plastik ve Kauçuk' },
      { code: '331', name: 'Ana Metal' },
      { code: '333', name: 'Makine' },
      { code: '334', name: 'Bilgisayar ve Elektronik' },
      { code: '336', name: 'Ulaşım Ekipmanları' },
    ],
  },
  {
    code: '42',
    name: 'Toptan Ticaret',
    subSectors: [
      { code: '423', name: 'Dayanıklı Tüketim Malları' },
      { code: '424', name: 'Dayanıksız Tüketim Malları' },
      { code: '425', name: 'Toptan Satış Temsilcileri ve Brokerlar' },
    ],
  },
  {
    code: '44-45',
    name: 'Perakende Ticaret',
    subSectors: [
      { code: '441', name: 'Motorlu Taşıtlar' },
      { code: '444', name: 'Yapı Malzemeleri ve Bahçe Ekipmanları' },
      { code: '445', name: 'Gıda ve İçecek Mağazaları' },
      { code: '452', name: 'Genel Mağazalar' },
      { code: '454', name: 'Mağaza Dışı Perakende' },
    ],
  },
  {
    code: '48-49',
    name: 'Ulaştırma ve Depolama',
    subSectors: [
      { code: '481', name: 'Havayolu' },
      { code: '482', name: 'Demiryolu' },
      { code: '484', name: 'Karayolu Nakliyesi' },
      { code: '485', name: 'Yolcu Taşımacılığı' },
      { code: '486', name: 'Boru Hattı' },
      { code: '492', name: 'Kurye ve Paket Servisi' },
      { code: '493', name: 'Depolama' },
    ],
  },
  {
    code: '51',
    name: 'Bilgi ve İletişim',
    subSectors: [
      { code: '511', name: 'Yayıncılık (Yazılım dahil)' },
      { code: '512', name: 'Film ve Ses Kaydı' },
      { code: '515', name: 'Yayıncılık (TV/Radyo)' },
      { code: '517', name: 'Telekomünikasyon' },
      { code: '518', name: 'Veri İşleme ve Hosting' },
    ],
  },
  {
    code: '52',
    name: 'Finans ve Sigorta',
    subSectors: [
      { code: '521', name: 'Merkez Bankacılığı' },
      { code: '522', name: 'Kredi Aracılığı' },
      { code: '523', name: 'Menkul Kıymetler ve Yatırım' },
      { code: '524', name: 'Sigorta Faaliyetleri' },
      { code: '525', name: 'Fonlar ve Diğer Finansal Araçlar' },
    ],
  },
  {
    code: '53',
    name: 'Gayrimenkul ve Kiralama',
    subSectors: [
      { code: '531', name: 'Gayrimenkul' },
      { code: '532', name: 'Kiralama ve Leasing' },
      { code: '533', name: 'Maddi Olmayan Varlıkların Lisanslanması' },
    ],
  },
  {
    code: '54',
    name: 'Mesleki ve Teknik Hizmetler',
    subSectors: [
      { code: '541', name: 'Hukuk, Muhasebe, Mimarlık, Mühendislik, Tasarım, Bilgisayar Sistemleri, Ar-Ge ve Reklamcılık' },
    ],
  },
  {
    code: '55',
    name: 'Şirket ve Teşebbüs Yönetimi',
    subSectors: [
      { code: '551', name: 'Holdingler ve Şirket Yönetim Merkezleri' },
    ],
  },
  {
    code: '56',
    name: 'İdari Destek ve Atık Yönetimi',
    subSectors: [
      { code: '561', name: 'İdari ve Destek Hizmetleri' },
      { code: '562', name: 'Atık Yönetimi ve İyileştirme Hizmetleri' },
    ],
  },
  {
    code: '61',
    name: 'Eğitim Hizmetleri',
    subSectors: [
      { code: '611', name: 'Okullar, Kolejler, Üniversiteler ve Eğitim Merkezleri' },
    ],
  },
  {
    code: '62',
    name: 'Sağlık ve Sosyal Yardım',
    subSectors: [
      { code: '621', name: 'Ayakta Sağlık Hizmetleri' },
      { code: '622', name: 'Hastaneler' },
      { code: '623', name: 'Bakım Evleri' },
      { code: '624', name: 'Sosyal Yardım' },
    ],
  },
  {
    code: '71',
    name: 'Sanat, Eğlence ve Rekreasyon',
    subSectors: [
      { code: '711', name: 'Gösteri Sanatları ve Spor' },
      { code: '712', name: 'Müzeler ve Tarihi Yerler' },
      { code: '713', name: 'Eğlence ve Kumar' },
    ],
  },
  {
    code: '72',
    name: 'Konaklama ve Yiyecek',
    subSectors: [
      { code: '721', name: 'Konaklama' },
      { code: '722', name: 'Yiyecek Hizmetleri ve İçki Mekanları' },
    ],
  },
  {
    code: '81',
    name: 'Diğer Hizmetler',
    subSectors: [
      { code: '811', name: 'Tamir ve Bakım' },
      { code: '812', name: 'Kişisel Hizmetler' },
      { code: '813', name: 'Sivil Toplum ve Dini Kuruluşlar' },
    ],
  },
  {
    code: '92',
    name: 'Kamu Yönetimi',
    subSectors: [
      { code: '921', name: 'Genel Yönetim' },
      { code: '922', name: 'Adalet ve Güvenlik' },
      { code: '926', name: 'Ekonomik Programların Yönetimi' },
    ],
  },
];

async function seedNAICS() {
  console.log('🌱 NAICS Sektör ve Alt Sektör verileri ekleniyor...');

  for (let i = 0; i < naicsData.length; i++) {
    const sectorData = naicsData[i];
    
    // Sektör oluştur veya güncelle
    const sector = await prisma.sector.upsert({
      where: { name: sectorData.name },
      update: {
        naicsCode: sectorData.code,
        order: i + 1,
      },
      create: {
        name: sectorData.name,
        naicsCode: sectorData.code,
        order: i + 1,
      },
    });

    console.log(`✅ Sektör: [${sectorData.code}] ${sectorData.name}`);

    // Alt sektörleri oluştur
    for (let j = 0; j < sectorData.subSectors.length; j++) {
      const subSectorData = sectorData.subSectors[j];
      
      await prisma.subSector.upsert({
        where: {
          sectorId_name: {
            sectorId: sector.id,
            name: subSectorData.name,
          },
        },
        update: {
          order: j + 1,
        },
        create: {
          name: `[${subSectorData.code}] ${subSectorData.name}`,
          sectorId: sector.id,
          order: j + 1,
        },
      });
    }
    
    console.log(`   └─ ${sectorData.subSectors.length} alt sektör eklendi`);
  }

  console.log('\n🎉 NAICS verileri başarıyla eklendi!');
}

seedNAICS()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
