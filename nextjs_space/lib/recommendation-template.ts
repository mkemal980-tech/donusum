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
    // Merdiven kurulamayan soru: şıklar birbirinin alternatifi, biri
    // diğerinden "daha olgun" değil. Devralma olmadığı için puan elle verilir.
    {
      soru_metni: "Atık sularınızı hangi yöntemle arıtıyorsunuz?",
      tetikleyici: "Arıtma yok, doğrudan deşarj",
      kademeli: "HAYIR",
      baslik: "Atık su arıtma ünitesi kurun",
      aciklama:
        "Tersane atık suyunda yağ, boya ve ağır metal bulunur. Fiziksel-kimyasal arıtma ünitesi kurup deşarj öncesi analiz zorunluluğu getirin.",
      vade: "UZUN",
      strateji: "BUYUK_YATIRIM",
      maliyet: "CAPEX",
      etki: "9",
      puan: "1",
      video_url: "",
      sira: "1",
    },
    // Ölçek sorusu: tetikleyici, şık etiketi yerine 1-5 arası sayı.
    {
      soru_metni: "İş sağlığı ve güvenliği eğitimlerinin kapsamını nasıl değerlendirirsiniz?",
      tetikleyici: "2",
      kademeli: "EVET",
      baslik: "Saha personeline yılda iki kez İSG tazeleme eğitimi verin",
      aciklama:
        "Alt yüklenici çalışanlarını da kapsayacak şekilde yükseklik, sıcak iş ve kapalı alan başlıklarında eğitim planı kurun; katılımı imzayla kayıt altına alın.",
      vade: "KISA",
      strateji: "HIZLI_KAZANIM",
      maliyet: "OPEX",
      etki: "7",
      puan: "",
      video_url: "",
      sira: "1",
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

/**
 * Anketin her sorusu × her şıkkı için hazır satır üretir.
 *
 * Şablonun boş gelmesi, doldurma işinin en yorucu kısmını yöneticiye
 * bırakıyordu: soru metnini ve şık etiketini elle kopyalamak. Metin
 * eşleştirmesiyle çalışan bir içe aktarmada bu aynı zamanda en büyük hata
 * kaynağı — tek harflik fark satırı düşürüyor.
 *
 * Satırlar en düşük şıktan en yükseğe sıralanır: merdiven gözle görünür olur
 * ve yukarı çıktıkça önerinin de olgunlaşması gerektiği kendiliğinden anlaşılır.
 * En üst basamak çoğu soruda öneri istemez (kullanıcı zaten en iyisini
 * yapıyordur); o satır silinebilir.
 */
export function buildPrefilledRows(
  questions: { text: string; choices: { label: string; score: number }[] }[]
): TemplateRow[] {
  const rows: TemplateRow[] = [];

  for (const question of questions) {
    if (question.choices.length === 0) continue; // şıksız soruya tetikleyici yazılamaz

    const ordered = [...question.choices].sort((a, b) => a.score - b.score);
    ordered.forEach((choice, index) => {
      rows.push({
        soru_metni: question.text,
        tetikleyici: choice.label,
        // Merdiven kurmak yaygın hâl; tek şıkka özel öneri için HAYIR yapılır.
        kademeli: "EVET",
        baslik: "",
        aciklama: "",
        vade: "",
        strateji: "",
        maliyet: "",
        etki: "",
        puan: "",
        video_url: "",
        sira: String(index + 1),
      });
    });
  }

  return rows;
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


/**
 * Yapay zekâya verilecek yönerge sayfası.
 *
 * Şablonu bir modele "şunu doldur" diye vermek işe yaramıyor: model ürünü
 * tanımadan öneri yazınca genel geçer cümleler üretiyor ("sürdürülebilirlik
 * politikanızı geliştirin") ve kolon kurallarını uydurmaya başlıyor. Bu sayfa
 * modelin bilmesi gereken her şeyi tek yerde veriyor: önerinin nerede
 * göründüğü, hangi kuralla tetiklendiği, hangi kolona ne yazılacağı ve neyin
 * yapılmayacağı.
 */
export function buildAiBriefSheet(surveyName?: string): XLSX.WorkSheet {
  const rows: string[][] = [
    ["YAPAY ZEKÂ YÖNERGESİ — bu dosyayı doldururken uyulacak kurallar", ""],
    ["", ""],
    ["Anket", surveyName ?? "(şablon anket seçilmeden indirildi)"],
    ["", ""],

    ["1. BAĞLAM — bu öneriler nerede kullanılıyor?", ""],
    [
      "Ürün",
      "Kuruluşlar bir olgunluk anketini dolduruyor. Her sorunun şıkları bir olgunluk basamağını temsil ediyor ve verilen cevaplardan 1-5 arası bir puan çıkıyor.",
    ],
    [
      "Öneri nedir",
      "Kuruluşun bir sonraki adımı. Kullanıcı anketi bitirince Öneriler ekranında ve yol haritasında bunları görür; seçtiklerini görev olarak üstlenir ve tamamlayınca puanı yükselir.",
    ],
    [
      "Kime yazıyorsun",
      "Cevabı veren kuruluşun sorumlusuna. Konuyu bilir ama uzmanı değildir; ne yapacağını somut olarak bilmek ister.",
    ],
    ["", ""],

    ["2. GÖREV", ""],
    [
      "Ne yapacaksın",
      '"Öneriler" sayfasındaki her satır için öneri yazacaksın. Satırların soru_metni ve tetikleyici kolonları HAZIR GELİYOR; onlara dokunma.',
    ],
    [
      "Dolduracağın kolonlar",
      "baslik, aciklama, vade, strateji, maliyet, etki. Gerekirse kademeli ve sira kolonlarını da düzeltebilirsin.",
    ],
    [
      "Satır silme",
      "En üst basamak (en yüksek puanlı şık) çoğu soruda öneri istemez — kullanıcı zaten en iyisini yapıyordur. O satırı silebilirsin.",
    ],
    ["", ""],

    ["3. TETİKLEME MANTIĞI — en kritik kısım", ""],
    [
      "Satırlar merdiven",
      "Aynı sorunun satırları en düşük şıktan en yükseğe sıralı. Alt satır 'hiç yapmıyor', üst satır 'en olgun' demek.",
    ],
    [
      "kademeli = EVET (varsayılan)",
      "Öneri, o şıkta VE ondan daha düşük tüm şıklarda gösterilir. Yani 'Dijital takip' için yazdığın öneriyi 'Takip yok' diyen de görür, ama sırası gelince yapabilir.",
    ],
    [
      "Bunun sana anlamı",
      "Her satır, O BASAMAKTAN BİR ÜSTE ÇIKMAK için yapılacak işi anlatmalı. 'Takip yok' satırı ilk ölçümü kurdurur; 'Dijital takip' satırı hedef koydurur. Aynı işi iki satıra yazma.",
    ],
    [
      "kademeli = HAYIR",
      "Yalnızca o şıkkı seçene gösterilir, devralma olmaz. Basamak ilişkisi kurulamayan sorularda kullan (örn. birbirinin alternatifi olan şıklar).",
    ],
    ["", ""],

    ["4. KOLON KURALLARI", ""],
    ["baslik", "Emir kipiyle tek cümle, en fazla ~80 karakter. Ne yapılacağını söyler. Örn: 'Kapsam 1-2 emisyon envanteri oluşturun'."],
    [
      "aciklama",
      "2-4 cümle. NASIL yapılacağını anlatır: ilk adım, kullanılacak standart/araç, kimin sorumlu olacağı. Somut ol; 'iyileştirin', 'gözden geçirin' gibi boş fiillerden kaçın.",
    ],
    ["vade", "Yalnızca KISA (0-6 ay), ORTA (6-18 ay) veya UZUN (18+ ay). Başka değer yazma."],
    [
      "strateji",
      "Yalnızca HIZLI_KAZANIM (düşük maliyet, hızlı sonuç), PROJE (planlama ve kaynak ister) veya BUYUK_YATIRIM (ciddi bütçe/dönüşüm).",
    ],
    ["maliyet", "OPEX (işletme gideri) veya CAPEX (yatırım). Boş bırakırsan OPEX sayılır."],
    [
      "etki",
      "1-10 arası tam sayı. Kuruluşun olgunluğuna yapacağı katkı. Alt basamaklardaki temel adımlar genelde 6-8, üst basamaktaki ileri işler 8-10, küçük düzenlemeler 3-5.",
    ],
    ["sira", "Aynı sorudaki öneriler arasında sıra. Hazır geliyor, dokunmana gerek yok."],
    ["puan", "kademeli = EVET ise BOŞ BIRAK. Sistem katkıyı basamaktan hesaplar."],
    ["video_url", "Varsa 'nasıl yapılır' videosu. Yoksa boş bırak — uydurma."],
    ["", ""],

    ["5. YAZIM KURALLARI", ""],
    ["Dil", "Türkçe, kuruluşa 'siz' diye hitap et."],
    ["Somutluk", "Ölçülebilir ve uygulanabilir yaz. 'Sürdürülebilirlik bilincini artırın' değil; 'Yılda iki kez, tüm saha personeline atık ayrıştırma eğitimi verin' gibi."],
    ["Sektör dili", "Anketin sektörünü kullan. Tersane anketinde 'atölye', 'havuz', 'boya kabini' gibi o dünyanın kelimeleri geçmeli."],
    ["Tekrar", "Aynı öneriyi farklı sorulara kopyalama. Her satır kendi sorusunun cevabı olmalı."],
    ["Uzunluk", "Başlık kısa, açıklama 2-4 cümle. Uzun metin okunmuyor."],
    ["", ""],

    ["6. YAPMAYACAKLARIN", ""],
    ["Kolon ekleme/çıkarma", "Kolon başlıklarını ve sırasını değiştirme. Yükleyici bunlara göre okuyor."],
    ["soru_metni'ni değiştirme", "Eşleştirme birebir metinle yapılıyor; tek harflik fark satırı düşürür."],
    ["Şık etiketini değiştirme", "tetikleyici kolonundaki etiket ankettekiyle aynı kalmalı."],
    ["Serbest değer yazma", "vade/strateji/maliyet kolonlarında yukarıdaki sabit değerler dışında bir şey yazma."],
    ["Boş bırakma", "baslik, vade, strateji ve etki zorunlu. Boş satır yükleme sırasında reddedilir."],
    ["", ""],

    ["7. TESLİM", ""],
    [
      "Çıktı",
      'Yalnızca "Öneriler" sayfasını doldurup dosyayı geri ver. Diğer sayfalar (Örnekler, Açıklamalar, Anket Soruları, bu sayfa) rehberdir; yükleme sırasında okunmaz.',
    ],
    [
      "Kontrol listesi",
      "Her satırda baslik/vade/strateji/etki dolu mu · sabit değerler doğru mu · aynı sorunun satırları birbirini tekrar etmiyor mu · en üst basamak satırı gerekli mi?",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 32 }, { wch: 110 }];
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
