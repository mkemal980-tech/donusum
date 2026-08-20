/**
 * Toplu soru yükleme Excel şablonlarının ortak içeriği.
 *
 * İki şablon da (tekil alt seviye şablonu ve anket geneli şablonu) aynı
 * kolonları, aynı örnekleri ve aynı yardım sayfalarını kullanır.
 *
 * Tasarım notu: kullanılan `xlsx` sürümü hücre biçimi (kalın yazı, renk,
 * "metni kaydır") yazamaz — yalnızca kolon genişliği ve satır yüksekliği
 * korunur. Bu yüzden anlaşılırlık biçimlendirmeyle değil, içerikle sağlanır:
 * seçenekler tek satırda yazılır ve örnekler ayrı sayfalara alınır.
 */

import * as XLSX from "xlsx";

export type TemplateColumn = {
  key: string;
  width: number;
  /** "Zorunlu" / "Opsiyonel" / "COKTAN_SECMELI için zorunlu" gibi */
  requirement: string;
  description: string;
  example: string;
};

/** Yalnızca anket geneli şablonunda bulunan yapı kolonları. */
export const STRUCTURE_COLUMNS: TemplateColumn[] = [
  {
    key: "kategori_adi",
    width: 25,
    requirement: "Zorunlu",
    description: 'Kategori adı — "Anket Yapısı" sayfasından birebir kopyalayın.',
    example: "Çevre",
  },
  {
    key: "alt_kategori_adi",
    width: 25,
    requirement: "Zorunlu",
    description: 'Alt kategori adı — "Anket Yapısı" sayfasından birebir kopyalayın.',
    example: "Emisyon Yönetimi",
  },
  {
    key: "alt_seviye_adi",
    width: 25,
    requirement: "Varsa zorunlu",
    description:
      'Alt seviye adı. Alt kategorinin alt seviyeleri varsa doldurun, yoksa boş bırakın — "Anket Yapısı" sayfasında görebilirsiniz.',
    example: "Ölçüm ve İzleme",
  },
];

export const QUESTION_COLUMNS: TemplateColumn[] = [
  {
    key: "soru_metni",
    width: 60,
    requirement: "Zorunlu",
    description: "Kullanıcıya sorulacak soru. Boş bırakılan satırlar yüklenmez.",
    example: "Tersaneniz emisyon azaltımı için hangi yaklaşımı izliyor?",
  },
  {
    key: "soru_tipi",
    width: 22,
    requirement: "Zorunlu",
    description:
      'Dört tipten biri: COKTAN_SECMELI, OLCEK_1_5, EVET_HAYIR, KADEMELI_PUANLAMA. Hangi tipte hangi kolonların dolacağı "Soru Tipleri" sayfasında.',
    example: "COKTAN_SECMELI",
  },
  {
    key: "soru_agirligi",
    width: 15,
    requirement: "Zorunlu",
    description:
      "Sorunun puan çarpanı. Ondalık yazılabilir (1,5 veya 1.5). Ağırlığı yüksek soru toplam puanı daha çok etkiler.",
    example: "1,5",
  },
  {
    key: "ironman_ekseni",
    width: 18,
    requirement: "Zorunlu",
    description:
      "VELOCITY (hız) veya ENDURANCE (olgunluk). Sorunun Ironman analizinde hangi eksene sayılacağını belirler.",
    example: "VELOCITY",
  },
  {
    key: "sira",
    width: 8,
    requirement: "Opsiyonel",
    description: "Soruların gösterim sırası. Boş bırakılırsa Excel'deki satır sırası kullanılır.",
    example: "3",
  },
  {
    key: "kanit_gerekli",
    width: 15,
    requirement: "Opsiyonel",
    description: "TRUE ise kullanıcıdan bu soru için belge yüklemesi istenir. Boş bırakılırsa FALSE kabul edilir.",
    example: "FALSE",
  },
  {
    key: "secenekler",
    width: 55,
    requirement: "COKTAN_SECMELI için zorunlu",
    description:
      'Şıklar ve puanları. Hepsi TEK HÜCREYE, tek satırda: "Etiket = puan" ve aralarında ";". Ayrıntı için "Seçenek Yazımı" sayfasına bakın.',
    example: "Düşük = 1; Orta = 3; Yüksek = 5",
  },
  {
    key: "evet_puani",
    width: 12,
    requirement: "EVET_HAYIR için zorunlu",
    description: 'Kullanıcı "Evet" derse alacağı puan. Ondalık yazılabilir.',
    example: "5",
  },
  {
    key: "hayir_puani",
    width: 12,
    requirement: "EVET_HAYIR için zorunlu",
    description: 'Kullanıcı "Hayır" derse alacağı puan. Ondalık yazılabilir.',
    example: "1",
  },
  {
    key: "esik_sorusu",
    width: 45,
    requirement: "KADEMELI_PUANLAMA için zorunlu",
    description: 'Önce sorulan evet/hayır sorusu. "Evet" seçilirse alt_secenekler listesi açılır.',
    example: "ISO sertifikalarınız var mı?",
  },
  {
    key: "evet_etiketi",
    width: 15,
    requirement: "Opsiyonel",
    description: 'Eşik sorusundaki evet seçeneğinin metni. Boşsa "Evet" kullanılır.',
    example: "Evet, var",
  },
  {
    key: "hayir_etiketi",
    width: 15,
    requirement: "Opsiyonel",
    description: 'Eşik sorusundaki hayır seçeneğinin metni. Boşsa "Hayır" kullanılır.',
    example: "Hayır, yok",
  },
  {
    key: "alt_secenekler",
    width: 55,
    requirement: "KADEMELI_PUANLAMA için zorunlu",
    description:
      '"Evet" seçilince gösterilen, birden fazla işaretlenebilen seçenekler. Yazımı secenekler ile aynıdır; puanlar toplanır (en fazla 5).',
    example: "ISO 9001 = 2; ISO 14001 = 2; ISO 27001 = 1",
  },
];

type TemplateRow = Record<string, string | number>;

function emptyRow(columns: TemplateColumn[]): TemplateRow {
  return Object.fromEntries(columns.map((column) => [column.key, ""]));
}

/** Her soru tipi için birer örnek satır — "Örnekler" sayfasında gösterilir. */
export function buildExampleRows(columns: TemplateColumn[], structure: TemplateRow = {}): TemplateRow[] {
  const base = { ...emptyRow(columns), ...structure };

  return [
    {
      ...base,
      soru_metni: "Karbon ayak izi takibini hangi düzeyde yapıyorsunuz?",
      soru_tipi: "COKTAN_SECMELI",
      soru_agirligi: 1.5,
      ironman_ekseni: "VELOCITY",
      sira: 1,
      kanit_gerekli: "FALSE",
      secenekler: "Takip yok = 1; Basit takip = 2; Detaylı takip = 4; Entegre sistem = 5",
    },
    {
      ...base,
      soru_metni: "Enerji verimliliği çalışmalarınızı nasıl değerlendirirsiniz?",
      soru_tipi: "OLCEK_1_5",
      soru_agirligi: 2,
      ironman_ekseni: "ENDURANCE",
      sira: 2,
      kanit_gerekli: "TRUE",
    },
    {
      ...base,
      soru_metni: "Kuruluşunuz sürdürülebilirlik hedefleri belirlemiş mi?",
      soru_tipi: "EVET_HAYIR",
      soru_agirligi: 1,
      ironman_ekseni: "VELOCITY",
      sira: 3,
      kanit_gerekli: "FALSE",
      evet_puani: 5,
      hayir_puani: 1,
    },
    {
      ...base,
      soru_metni: "Sahip olduğunuz yönetim sistemi sertifikaları",
      soru_tipi: "KADEMELI_PUANLAMA",
      soru_agirligi: 2,
      ironman_ekseni: "ENDURANCE",
      sira: 4,
      kanit_gerekli: "FALSE",
      esik_sorusu: "ISO sertifikalarınız var mı?",
      evet_etiketi: "Evet, var",
      hayir_etiketi: "Hayır, yok",
      alt_secenekler: "ISO 9001 = 2; ISO 14001 = 2; ISO 27001 = 1; ISO 45001 = 1",
    },
  ];
}

function applyWidths(sheet: XLSX.WorkSheet, widths: number[]): XLSX.WorkSheet {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  return sheet;
}

/** Doldurulacak sayfa. Satır verilmezse yalnızca başlık satırı yazılır. */
export function buildQuestionSheet(columns: TemplateColumn[], rows: TemplateRow[] = []): XLSX.WorkSheet {
  const header = columns.map((column) => column.key);
  const sheet = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header })
    : XLSX.utils.aoa_to_sheet([header]);

  return applyWidths(sheet, columns.map((column) => column.width));
}

export function buildColumnGuideSheet(columns: TemplateColumn[]): XLSX.WorkSheet {
  const rows = columns.map((column) => ({
    Kolon: column.key,
    "Zorunlu mu?": column.requirement,
    Açıklama: column.description,
    Örnek: column.example,
  }));

  return applyWidths(XLSX.utils.json_to_sheet(rows), [20, 30, 95, 45]);
}

export function buildQuestionTypeSheet(): XLSX.WorkSheet {
  const rows = [
    {
      "Soru Tipi": "COKTAN_SECMELI",
      "Nasıl görünür": "Kullanıcı listeden tek şık seçer.",
      "Doldurulacak kolonlar": "secenekler",
      "Boş bırakılacak kolonlar": "evet_puani, hayir_puani, esik_sorusu, alt_secenekler",
      Puanlama: "Seçilen şıkkın puanı × soru_agirligi",
    },
    {
      "Soru Tipi": "OLCEK_1_5",
      "Nasıl görünür": "Kullanıcı 1-5 arası bir değer seçer.",
      "Doldurulacak kolonlar": "— (ek kolon yok)",
      "Boş bırakılacak kolonlar": "secenekler, evet_puani, hayir_puani, esik_sorusu, alt_secenekler",
      Puanlama: "Seçilen değer (1-5) × soru_agirligi — otomatiktir",
    },
    {
      "Soru Tipi": "EVET_HAYIR",
      "Nasıl görünür": "Kullanıcı Evet veya Hayır seçer.",
      "Doldurulacak kolonlar": "evet_puani, hayir_puani",
      "Boş bırakılacak kolonlar": "secenekler, esik_sorusu, alt_secenekler",
      Puanlama: "Seçilen cevabın puanı × soru_agirligi",
    },
    {
      "Soru Tipi": "KADEMELI_PUANLAMA",
      "Nasıl görünür": 'Önce evet/hayır sorulur; "Evet" seçilirse alt seçenekler açılır ve birden fazlası işaretlenebilir.',
      "Doldurulacak kolonlar": "esik_sorusu, alt_secenekler (evet_etiketi / hayir_etiketi opsiyonel)",
      "Boş bırakılacak kolonlar": "secenekler, evet_puani, hayir_puani",
      Puanlama: 'İşaretlenen alt seçeneklerin puan toplamı (en fazla 5) × soru_agirligi. "Hayır" → 0',
    },
  ];

  return applyWidths(XLSX.utils.json_to_sheet(rows), [24, 55, 50, 55, 60]);
}

/**
 * Şablonun en çok kafa karıştıran kısmı: seçeneklerin tek hücreye nasıl
 * yazılacağı. Serbest yerleşim için tablo yerine satır dizisi kullanılır.
 */
export function buildOptionGuideSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    ["SEÇENEK YAZIMI — secenekler ve alt_secenekler kolonları"],
    [],
    ["KURAL 1", 'Her şık "Etiket = puan" şeklinde yazılır.', "Örn: Orta = 3"],
    ["KURAL 2", 'Şıklar noktalı virgül ";" ile ayrılır.', "Örn: Düşük = 1; Orta = 3"],
    ["KURAL 3", "Tüm şıklar TEK HÜCREYE, tek satır halinde yazılır.", "Her şık için ayrı hücre/satır açmayın."],
    ["KURAL 4", "Puan ondalıklı olabilir.", "Örn: Kısmen = 2,5"],
    [],
    ["ÖRNEK"],
    ["Hücreye yazacağınız:", "Düşük = 1; Orta = 3; Yüksek = 5"],
    ["Ankette görünecek:", "( ) Düşük     ( ) Orta     ( ) Yüksek"],
    ["Puanlama:", 'Kullanıcı "Orta" seçerse soru 3 puan alır; bu puan soru_agirligi ile çarpılır.'],
    [],
    ["HANGİ KOLONA YAZILIR?"],
    ["COKTAN_SECMELI", "secenekler kolonuna", "Kullanıcı tek şık seçer."],
    ["KADEMELI_PUANLAMA", "alt_secenekler kolonuna", '"Evet" seçilince açılan, çoklu işaretlenebilen liste.'],
    ["OLCEK_1_5", "Yazılmaz — boş bırakın", "Puanlama 1-5 arası otomatiktir."],
    ["EVET_HAYIR", "Yazılmaz — boş bırakın", "Bunun yerine evet_puani ve hayir_puani kolonlarını doldurun."],
    [],
    ["SIK YAPILAN HATALAR"],
    ["YANLIŞ", "Düşük; Orta; Yüksek", "Puanlar eksik — her şıkkın puanı olmalı."],
    ["YANLIŞ", "Düşük 1, Orta 3", 'Ayırıcılar yanlış — "=" ve ";" kullanın.'],
    ["YANLIŞ", "Her şıkkı ayrı satıra yazmak", "Şıklar tek hücrede olmalı; ayrı satır yeni bir soru demektir."],
    ["DOĞRU", "Düşük = 1; Orta = 3; Yüksek = 5", ""],
    [],
    ["ESKİ ŞABLONLAR"],
    ["", 'Önceki "deger|etiket|puan" yazımı da kabul edilmeye devam eder.', "Örn: dusuk|Düşük|1"],
  ];

  return applyWidths(XLSX.utils.aoa_to_sheet(rows), [26, 62, 70]);
}
