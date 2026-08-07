/**
 * Toplu öneri yükleme Excel şablonunun içeriği.
 *
 * `lib/question-template.ts` ile aynı yaklaşım: kullanılan `xlsx` sürümü hücre
 * biçimi yazamadığı için anlaşılırlık biçimlendirmeyle değil içerikle sağlanır
 * — örnekler ayrı sayfada durur, her kolonun açıklaması ayrı sayfadadır.
 */

import * as XLSX from "xlsx";
import { RECOMMENDATION_IMPORT_FIELDS } from "./recommendation-import";

export type TemplateColumn = {
  key: string;
  width: number;
  requirement: string;
  description: string;
  example: string;
};

export const RECOMMENDATION_COLUMNS: TemplateColumn[] = [
  {
    key: "soru_metni",
    width: 60,
    requirement: "Zorunlu",
    description:
      'Önerinin bağlanacağı soru. "Anket Soruları" sayfasından birebir kopyalayın — eşleşme metin üzerinden yapılır.',
    example: "Tersaneniz emisyon azaltımı için hangi yaklaşımı izliyor?",
  },
  {
    key: "tetikleyici",
    width: 28,
    requirement: "Zorunlu",
    description:
      'Önerinin gösterileceği şık. Şıkkın etiketini yazın (örn: "Takip yok"). Ölçek sorularında 1-5 arası sayı, evet/hayır sorularında "Evet" veya "Hayır".',
    example: "Takip yok",
  },
  {
    key: "kademeli",
    width: 12,
    requirement: "Zorunlu",
    description:
      'EVET ise öneri bu şıkta VE altındaki tüm şıklarda gösterilir (devralma). HAYIR ise yalnızca bu şıkta gösterilir. Olgunluk merdiveni kuruyorsanız EVET yazın.',
    example: "EVET",
  },
  {
    key: "baslik",
    width: 50,
    requirement: "Zorunlu",
    description: "Kullanıcının göreceği öneri başlığı. Ne yapılacağını tek cümlede anlatın.",
    example: "Kapsam 1-2 emisyon envanteri oluşturun",
  },
  {
    key: "aciklama",
    width: 70,
    requirement: "Opsiyonel",
    description: "Önerinin nasıl uygulanacağını anlatan açıklama.",
    example: "GHG Protocol'e göre yakıt ve elektrik tüketiminizi aylık olarak kayıt altına alın.",
  },
  {
    key: "vade",
    width: 12,
    requirement: "Zorunlu",
    description: "KISA (0-6 ay), ORTA (6-18 ay) veya UZUN (18+ ay).",
    example: "KISA",
  },
  {
    key: "strateji",
    width: 18,
    requirement: "Zorunlu",
    description: "HIZLI_KAZANIM, PROJE veya BUYUK_YATIRIM.",
    example: "HIZLI_KAZANIM",
  },
  {
    key: "maliyet",
    width: 12,
    requirement: "Opsiyonel",
    description: "OPEX (işletme gideri) veya CAPEX (yatırım). Boş bırakılırsa OPEX kabul edilir.",
    example: "OPEX",
  },
  {
    key: "etki",
    width: 10,
    requirement: "Zorunlu",
    description:
      "Tahmini etki, 1-10 arası. Öneri grafiğinde baloncuğun boyutunu ve dikey konumunu belirler.",
    example: "7",
  },
  {
    key: "puan",
    width: 10,
    requirement: "Kademeli = HAYIR ise opsiyonel",
    description:
      'Kaç soruluk ilerlemeye denk olduğu: 1 = bir soruyu en alttan tavana çıkarmak, 0,5 = yarısı. Boş bırakılırsa 0,5. Kademeli = EVET ise bu alan yok sayılır (katkı basamaktan türetilir).',
    example: "0,5",
  },
  {
    key: "video_url",
    width: 40,
    requirement: "Opsiyonel",
    description: '"Nasıl yapılır" videosunun bağlantısı. http:// veya https:// ile başlamalı.',
    example: "https://www.youtube.com/watch?v=ornek",
  },
  {
    key: "sira",
    width: 8,
    requirement: "Opsiyonel",
    description: "Aynı sorudaki öneriler arasındaki sıra. Boş bırakılırsa satır sırası kullanılır.",
    example: "1",
  },
];

type TemplateRow = Record<string, string>;

/** Kolon anahtarları içe aktarma alanlarıyla birebir aynı olmalı. */
export function templateColumnKeys(): string[] {
  return RECOMMENDATION_COLUMNS.map((column) => column.key);
}

export function buildExampleRows(): TemplateRow[] {
  // Dört basamaklı bir merdivenin tamamı — yöneticinin kopyalayacağı kalıp.
  const shared = {
    soru_metni: "Tersaneniz emisyon azaltımı için hangi yaklaşımı izliyor?",
    kademeli: "EVET",
    maliyet: "OPEX",
    video_url: "",
    puan: "",
  };

  return [
    {
      ...shared,
      tetikleyici: "Takip yok",
      baslik: "Kapsam 1-2 emisyon envanteri oluşturun",
      aciklama: "GHG Protocol'e göre yakıt ve elektrik tüketiminizi aylık kayıt altına alın.",
      vade: "KISA",
      strateji: "HIZLI_KAZANIM",
      etki: "7",
      sira: "1",
    },
    {
      ...shared,
      tetikleyici: "Manuel takip",
      baslik: "Ölçümü dijital bir sisteme taşıyın",
      aciklama: "Elektronik tabloları bırakıp veriyi otomatik toplayan bir araca geçin.",
      vade: "ORTA",
      strateji: "PROJE",
      etki: "6",
      sira: "2",
    },
    {
      ...shared,
      tetikleyici: "Dijital takip",
      baslik: "Azaltım hedefi belirleyip doğrulatın",
      aciklama: "Bilim temelli bir azaltım hedefi koyun ve bağımsız doğrulama alın.",
      vade: "ORTA",
      strateji: "PROJE",
      etki: "8",
      sira: "3",
    },
    {
      ...shared,
      tetikleyici: "Entegre sistem",
      baslik: "Tedarik zinciri emisyonlarını (Kapsam 3) kapsama alın",
      aciklama: "Tedarikçilerinizden veri toplayarak envanteri Kapsam 3'e genişletin.",
      vade: "UZUN",
      strateji: "BUYUK_YATIRIM",
      etki: "9",
      sira: "4",
    },
  ];
}

function sheetFromRows(columns: TemplateColumn[], rows: TemplateRow[]): XLSX.WorkSheet {
  const keys = columns.map((column) => column.key);
  const data = rows.map((row) => keys.map((key) => row[key] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet([keys, ...data]);
  sheet["!cols"] = columns.map((column) => ({ wch: column.width }));
  return sheet;
}

export function buildRecommendationSheet(rows: TemplateRow[] = []): XLSX.WorkSheet {
  return sheetFromRows(RECOMMENDATION_COLUMNS, rows);
}

export function buildColumnGuideSheet(): XLSX.WorkSheet {
  const rows = RECOMMENDATION_COLUMNS.map((column) => [
    column.key,
    column.requirement,
    column.description,
    column.example,
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([["kolon", "durum", "açıklama", "örnek"], ...rows]);
  sheet["!cols"] = [{ wch: 18 }, { wch: 26 }, { wch: 80 }, { wch: 45 }];
  return sheet;
}

export function buildCascadeGuideSheet(): XLSX.WorkSheet {
  const rows = [
    ["Kademeli tetikleme nasıl çalışır?", ""],
    ["", ""],
    ["Şıkların puanı olgunluk sırasını taşır.", 'Örn: "Takip yok"=0, "Manuel"=1, "Dijital"=2, "Entegre"=3'],
    [
      "kademeli = EVET yazarsanız",
      'Öneri, seçtiğiniz şıkta VE puanı ondan düşük tüm şıklarda gösterilir.',
    ],
    [
      "Sonuç",
      '"Entegre" için yazdığınız öneriyi, "Takip yok" seçen kullanıcı da görür — ama sırası gelmeden yapamaz.',
    ],
    ["", ""],
    ["Örnek merdiven (4 şıklı bir soru)", ""],
    ["Kullanıcı 'Entegre' seçtiyse", "1 öneri görür"],
    ["Kullanıcı 'Dijital' seçtiyse", "2 öneri görür (kendi + Entegre'ninki)"],
    ["Kullanıcı 'Manuel' seçtiyse", "3 öneri görür"],
    ["Kullanıcı 'Takip yok' seçtiyse", "4 öneri görür"],
    ["", ""],
    [
      "Sıra kilidi",
      "Kullanıcı yalnızca kendi basamağındaki öneriyi tamamlayabilir; üsttekiler kilitli görünür ve o bitince açılır.",
    ],
    [
      "Puanlama",
      "Kademeli öneri tamamlanınca kullanıcı bir üst şıkka çıkmış sayılır; gelişim puanına katkısı bundan türetilir, elle puan girilmez.",
    ],
    ["", ""],
    ["Ne zaman kademeli = HAYIR?", ""],
    [
      "Tek bir şıkka özel öneri",
      "Yalnızca o şıkkı seçenlere gösterilir, devralma olmaz. Bu durumda puan kolonunu doldurabilirsiniz.",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 38 }, { wch: 95 }];
  return sheet;
}

/** Anketteki soruları ve şıklarını yöneticinin kopyalayabilmesi için listeler. */
export function buildQuestionReferenceSheet(
  questions: { text: string; choices: { label: string; score: number }[] }[]
): XLSX.WorkSheet {
  const rows = questions.map((question) => [
    question.text,
    question.choices.map((choice) => `${choice.label} (${choice.score})`).join(" | "),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([["soru_metni", "şıklar (puan)"], ...rows]);
  sheet["!cols"] = [{ wch: 70 }, { wch: 70 }];
  return sheet;
}

/** Şablon kolonlarının içe aktarma alanlarıyla uyumunu doğrular. */
export function templateMatchesImportFields(): boolean {
  const templateKeys = templateColumnKeys();
  return (
    templateKeys.length === RECOMMENDATION_IMPORT_FIELDS.length &&
    RECOMMENDATION_IMPORT_FIELDS.every((field, index) => templateKeys[index] === field)
  );
}
