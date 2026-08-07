/**
 * "Dijital Olgunluk Değerlendirmesi (Demo)" anketinin içeriği.
 *
 * Bu anket, sistemi kullanacak yöneticilere referans olmak için vardır:
 * doğru kurulmuş bir olgunluk anketinin nasıl göründüğünü, kademeli öneri
 * merdiveninin nasıl kurulduğunu ve dört soru tipinin nerede kullanıldığını
 * canlı örnek üzerinden gösterir.
 *
 * TASARIM KURALLARI (kopyalanabilir kalıp)
 *
 * 1. Her çoktan seçmeli soru dört olgunluk basamağı taşır ve puanları
 *    0 → 1 → 2 → 3 şeklinde artar. Puan, basamağın sırasını taşıyan tek
 *    bilgidir; kademeli tetikleme eşiği buradan türetilir.
 *
 * 2. Her basamağın bir "aksiyonu" vardır: o basamaktaki kurumu bir üst
 *    basamağa çıkaracak öneri. En üst basamağın aksiyonu ise mevcut durumu
 *    daha da ileri taşır. Öneri, basamağın kendi puanına eşik olarak
 *    bağlanır — böylece alt basamaktakiler üsttekileri de devralır.
 *
 * 3. Vade, strateji, maliyet ve etki elle girilmez; basamak sırasından
 *    türetilir (bkz. STEP_DEFAULTS). Olgunluk arttıkça vade uzar, strateji
 *    ağırlaşır. Gerektiğinde tek tek ezilebilir.
 *
 * İçerik sektörden bağımsızdır; her kurumun cevaplayabileceği genel dijital
 * olgunluk soruları seçilmiştir.
 */

export const DEMO_SURVEY_NAME = "Dijital Olgunluk Değerlendirmesi (Demo)";

export const DEMO_SURVEY_DESCRIPTION =
  "Kurumunuzun dijital olgunluğunu beş boyutta ölçen 30 soruluk örnek anket. " +
  "Sistemi tanımak ve kendi anketinizi kurarken kalıp olarak kullanmak için hazırlanmıştır.";

export type Timeframe = "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";
export type StrategicType = "QUICK_WIN" | "PROJECT" | "BIG_BET";
export type CostType = "OPEX" | "CAPEX";
export type AxisType = "VELOCITY" | "ENDURANCE";

/**
 * Basamak sırasına göre öneri varsayılanları.
 * En alttaki basamak hızlı ve ucuz bir adımla başlar; yukarı çıktıkça
 * yatırım ve süre artar.
 */
export const STEP_DEFAULTS: {
  timeframe: Timeframe;
  strategicType: StrategicType;
  costType: CostType;
  estimatedImpact: number;
}[] = [
  { timeframe: "SHORT_TERM", strategicType: "QUICK_WIN", costType: "OPEX", estimatedImpact: 5 },
  { timeframe: "SHORT_TERM", strategicType: "QUICK_WIN", costType: "OPEX", estimatedImpact: 6 },
  { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", costType: "OPEX", estimatedImpact: 7 },
  { timeframe: "LONG_TERM", strategicType: "BIG_BET", costType: "CAPEX", estimatedImpact: 9 },
];

/** Bir olgunluk basamağı: şık + o basamaktan çıkaran öneri. */
export type DemoLevel = {
  /** Kullanıcıya gösterilen şık metni. */
  label: string;
  /** Olgunluk puanı — kademeli tetikleme eşiği bu değerden gelir. */
  score: number;
  /** Bu basamaktakine verilecek önerinin başlığı. */
  action: string;
  /** Önerinin açıklaması. */
  detail: string;
  /** Varsayılan vade/strateji/etki ezilecekse. */
  overrides?: Partial<(typeof STEP_DEFAULTS)[number]>;
};

export type DemoQuestion = {
  text: string;
  type: "MULTIPLE_CHOICE" | "SCALE" | "YES_NO" | "CONDITIONAL_CHOICE";
  weight: number;
  axisType: AxisType;
  levels?: DemoLevel[];
  /** Yalnızca CONDITIONAL_CHOICE için. */
  conditional?: {
    thresholdQuestion: string;
    yesLabel: string;
    noLabel: string;
    options: { label: string; score: number }[];
    /** Puan aralığına bağlı öneriler (kademeli değil). */
    rangeRecommendations: {
      title: string;
      description: string;
      minScoreThreshold: number;
      maxScoreThreshold: number;
      points: number;
      timeframe: Timeframe;
      strategicType: StrategicType;
      costType: CostType;
      estimatedImpact: number;
    }[];
  };
};

export type DemoSubCategory = {
  name: string;
  description: string;
  questions: DemoQuestion[];
};

export type DemoCategory = {
  name: string;
  description: string;
  questions: DemoSubCategory[];
};

/** Dört basamaklı çoktan seçmeli sorularda kullanılan ortak puanlar. */
const S = [0, 1, 2, 3];

export const DEMO_CATEGORIES: {
  name: string;
  description: string;
  subCategories: DemoSubCategory[];
}[] = [
  // ─────────────────────────────────────────────────────────────────────
  {
    name: "Strateji ve Yönetişim",
    description:
      "Dijitalleşmenin bir yönü, sahibi ve bütçesi var mı? Dönüşümün en sık takıldığı yer teknoloji değil, yönetişimdir.",
    subCategories: [
      {
        name: "Dijital Vizyon",
        description: "Nereye gidildiği yazılı mı, ölçülüyor mu?",
        questions: [
          {
            text: "Kurumunuzun yazılı bir dijital dönüşüm stratejisi var mı?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Yazılı bir strateji yok",
                score: S[0],
                action: "Bir sayfalık dijital yol haritası çıkarın",
                detail:
                  "Üst yönetimle yarım günlük bir çalışma yapıp önümüzdeki 12 ayda dijitalleşmede nereye varmak istediğinizi tek sayfaya yazın.",
              },
              {
                label: "Sözlü hedefler var, yazılı değil",
                score: S[1],
                action: "Hedefleri ölçülebilir maddelere dönüştürün",
                detail:
                  "Her hedefe bir sayısal gösterge ve sorumlu isim ekleyin; ölçülemeyen hedef takip edilemez.",
              },
              {
                label: "Yazılı strateji var, iş planına bağlı değil",
                score: S[2],
                action: "Stratejiyi yıllık bütçe ve iş planına bağlayın",
                detail:
                  "Dijital hedefleri bölüm iş planlarına ve bütçe kalemlerine indirin; strateji ancak kaynakla eşleşince gerçek olur.",
              },
              {
                label: "Strateji iş planına ve bütçeye bağlı",
                score: S[3],
                action: "Stratejiyi altı ayda bir gözden geçirme ritmine alın",
                detail:
                  "Pazar ve teknoloji hızla değişiyor; sabit bir yıllık plan yerine altı aylık gözden geçirme döngüsü kurun.",
              },
            ],
          },
          {
            text: "Dijital girişimler üst yönetimde nasıl takip ediliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Takip edilmiyor",
                score: S[0],
                action: "Aylık yönetim gündemine dijital başlığı ekleyin",
                detail:
                  "Mevcut yönetim toplantısına 15 dakikalık sabit bir dijital gündem maddesi koyun; yeni toplantı kurmayın.",
              },
              {
                label: "Ad hoc, sorun çıkınca konuşuluyor",
                score: S[1],
                action: "Sabit bir gündem ve karar tutanağı oluşturun",
                detail:
                  "Her toplantıda aynı başlıkları konuşun ve alınan kararları yazılı takip edin; sorun odaklı gündem ilerlemeyi göstermez.",
              },
              {
                label: "Düzenli toplantı var, göstergesiz",
                score: S[2],
                action: "Az sayıda gösterge belirleyip panoya bağlayın",
                detail:
                  "Beşi geçmeyen gösterge seçin ve otomatik güncellenen bir panoda gösterin; slayt hazırlamak zaman kaybıdır.",
              },
              {
                label: "Göstergelerle düzenli takip ediliyor",
                score: S[3],
                action: "Göstergeleri sonuç metrikleriyle ilişkilendirin",
                detail:
                  "Dijital göstergeleri maliyet, süre ve müşteri memnuniyeti gibi iş sonuçlarına bağlayarak dönüşümün getirisini gösterin.",
              },
            ],
          },
          {
            text: "Dijital dönüşüm için ayrılan bütçe nasıl belirleniyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Ayrı bir bütçe yok",
                score: S[0],
                action: "Küçük de olsa ayrı bir dijital bütçe kalemi açın",
                detail:
                  "Yıllık bütçede sembolik bir kalem açmak bile önceliklendirmeyi görünür kılar ve harcamayı izlenebilir yapar.",
              },
              {
                label: "İhtiyaç çıktıkça talep ediliyor",
                score: S[1],
                action: "Yıllık dijital bütçeyi önceden planlayın",
                detail:
                  "Beklenen projeleri yılbaşında listeleyip kaba bütçe ayırın; talep bazlı yaklaşım her seferinde onay beklemeye yol açar.",
              },
              {
                label: "Yıllık bütçe var, getirisi ölçülmüyor",
                score: S[2],
                action: "Her yatırım için beklenen getiriyi yazın",
                detail:
                  "Proje başlamadan önce hangi tasarrufu veya geliri hedeflediğinizi yazın; bitiminde ölçüp karşılaştırın.",
              },
              {
                label: "Bütçe var, getirisi ölçülüyor",
                score: S[3],
                action: "Portföy yaklaşımına geçin",
                detail:
                  "Yatırımları hızlı kazanım, dönüşüm ve deneysel olarak sınıflayıp her sınıfa bütçe payı ayırın; tek tek proje kararı yerine portföy dengesi yönetin.",
              },
            ],
          },
        ],
      },
      {
        name: "Yönetişim ve Sahiplik",
        description: "İşin sahibi kim, öncelik nasıl belirleniyor?",
        questions: [
          {
            text: "Dijital dönüşümden sorumlu tanımlı bir rol veya birim var mı?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Kimse sorumlu değil",
                score: S[0],
                action: "Mevcut yöneticilerden birine sahiplik verin",
                detail:
                  "Yeni kadro açmadan, dijitalleşmeyi görev tanımına ekleyeceğiniz bir yönetici belirleyin; sahipsiz iş ilerlemez.",
              },
              {
                label: "BT birimi gönüllü olarak yürütüyor",
                score: S[1],
                action: "İş birimlerinden temsilcilerle bir çalışma grubu kurun",
                detail:
                  "Dijitalleşme BT'nin tek başına taşıyabileceği bir yük değildir; süreç sahiplerini masaya alın.",
              },
              {
                label: "Tanımlı sorumlu var, yetkisi sınırlı",
                score: S[2],
                action: "Sorumluya bütçe ve karar yetkisi tanımlayın",
                detail:
                  "Belirli bir tutara kadar harcama ve süreç değiştirme yetkisi verin; yetkisiz sorumluluk yalnızca gecikme üretir.",
              },
              {
                label: "Yetkili ve bütçeli bir sahip var",
                score: S[3],
                action: "Birimlerde dijital elçi ağı kurun",
                detail:
                  "Her birimden bir gönüllüyü dijital elçi olarak belirleyip düzenli buluşturun; dönüşüm merkezden değil, içeriden yayılır.",
              },
            ],
          },
          {
            text: "Dijital projeler arasında öncelik nasıl belirleniyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Talep geldikçe, sırayla",
                score: S[0],
                action: "Tüm talepleri tek bir listede toplayın",
                detail:
                  "Nereden gelirse gelsin bütün dijital talepleri tek listeye yazın; görünmeyen talep önceliklendirilemez.",
              },
              {
                label: "En çok baskı yapan birim öne geçiyor",
                score: S[1],
                action: "Basit bir etki–efor puanlaması uygulayın",
                detail:
                  "Her talebi etki ve efor olarak 1-5 arası puanlayın; tartışma kişiselden çıkıp ölçüte oturur.",
              },
              {
                label: "Etki–efor değerlendirmesi yapılıyor",
                score: S[2],
                action: "Önceliklendirmeyi düzenli bir karar kuruluna bağlayın",
                detail:
                  "Aylık toplanan küçük bir kurul listeyi gözden geçirsin; puanlama ancak düzenli karar ritmiyle işe yarar.",
              },
              {
                label: "Kurul kararıyla, stratejiye göre",
                score: S[3],
                action: "Kapasiteyi de hesaba katan bir portföy planı yapın",
                detail:
                  "Onaylanan projeleri ekip kapasitesiyle karşılaştırıp gerçekçi bir takvime yayın; aynı anda çok iş başlatmak hepsini yavaşlatır.",
              },
            ],
          },
          {
            text: "Dijital olgunluğunuzu düzenli olarak ölçüyor musunuz?",
            type: "YES_NO",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Hayır",
                score: 0,
                action: "Yılda bir kez olgunluk değerlendirmesi yapın",
                detail:
                  "Bu anketin kendisi gibi basit bir öz değerlendirmeyi yılda bir tekrarlayın; ilerlemeyi ancak karşılaştırarak görürsünüz.",
              },
              {
                label: "Evet",
                score: 5,
                action: "Ölçüm sonuçlarını sektör kıyasıyla birlikte yorumlayın",
                detail:
                  "Kendi geçmişinizle karşılaştırmak yetmez; sektör ortalamasına göre nerede olduğunuzu da izleyin.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 6 },
              },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    name: "Süreçler ve Otomasyon",
    description:
      "İşin kendisi ne kadar dijital yürüyor? Kağıt ve kopyala-yapıştır ne kadar azaldı?",
    subCategories: [
      {
        name: "Süreç Dijitalleşmesi",
        description: "Günlük iş dijital ortamda mı akıyor?",
        questions: [
          {
            text: "Temel iş süreçleriniz ne ölçüde dijital ortamda yürüyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Çoğunlukla kağıt ve sözlü",
                score: S[0],
                action: "En çok tekrarlanan üç süreci dijitale taşıyın",
                detail:
                  "Hepsini birden değil, en sık tekrarlanan üç süreci seçip basit formlara alın; ilk kazanım güveni büyütür.",
              },
              {
                label: "Ofis dosyalarıyla yürüyor",
                score: S[1],
                action: "Elektronik tabloları paylaşımlı bir uygulamaya taşıyın",
                detail:
                  "Herkesin kendi kopyasında çalıştığı dosyalar sürüm karmaşası üretir; ortak bir araçta tek kayıt tutun.",
              },
              {
                label: "Bazı süreçler özel uygulamalarda",
                score: S[2],
                action: "Kalan kritik süreçleri de sisteme alın",
                detail:
                  "Uçtan uca akışın yarısı sistemde yarısı dışarıdaysa veri bütünlüğü kurulamaz; boşluk kalan adımları kapatın.",
              },
              {
                label: "Uçtan uca dijital yürüyor",
                score: S[3],
                action: "Süreçleri veriye bakarak yeniden tasarlayın",
                detail:
                  "Dijitalleşmiş süreçlerin verisini analiz edip darboğazları giderin; dijitalleştirmek ile iyileştirmek aynı şey değildir.",
              },
            ],
          },
          {
            text: "Onay ve imza süreçleriniz nasıl işliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Islak imza, fiziksel dolaşım",
                score: S[0],
                action: "Düşük riskli onaylarda e-postayı resmî kabul edin",
                detail:
                  "Belirli bir tutarın altındaki onaylar için e-posta onayını yeterli sayan bir kural yazın; hemen uygulanabilir.",
              },
              {
                label: "E-posta ile onay alınıyor",
                score: S[1],
                action: "Onay akışlarını bir iş akışı aracına taşıyın",
                detail:
                  "E-postada onayın nerede beklediği görünmez; akış aracı kimde beklediğini ve ne kadar süredir beklediğini gösterir.",
              },
              {
                label: "İş akışı aracı var, e-imza yok",
                score: S[2],
                action: "Yasal geçerlilik gerektiren belgelerde e-imzaya geçin",
                detail:
                  "Sözleşme ve resmî yazışmalarda elektronik imza kullanarak fiziksel dolaşımı tamamen kaldırın.",
              },
              {
                label: "E-imzalı, uçtan uca dijital",
                score: S[3],
                action: "Onay sürelerini ölçüp eşik uyarıları kurun",
                detail:
                  "Belirlenen sürede tamamlanmayan onaylar için otomatik hatırlatma ve yükseltme kuralları tanımlayın.",
              },
            ],
          },
          {
            text: "Tekrarlayan manuel işler için otomasyon kullanıyor musunuz?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Hayır, her şey elle yapılıyor",
                score: S[0],
                action: "Tekrarlayan işleri bir hafta boyunca kayıt altına alın",
                detail:
                  "Ekibe bir hafta boyunca hangi işi kaç kez tekrarladığını not ettirin; otomasyon fırsatı ancak ölçülünce görünür.",
              },
              {
                label: "Birkaç kişi kendi kısayollarını kullanıyor",
                score: S[1],
                action: "Kişisel çözümleri kurumsal araçlara taşıyın",
                detail:
                  "Tek kişinin bilgisayarında çalışan makrolar o kişi ayrılınca kaybolur; ortak platformda çalışacak hâle getirin.",
              },
              {
                label: "Belirli süreçlerde otomasyon var",
                score: S[2],
                action: "Otomasyonu bir program hâline getirin",
                detail:
                  "Fırsatları düzenli tarayan, önceliklendiren ve kazanımı ölçen küçük bir program kurun; dağınık girişimler ölçeklenmez.",
              },
              {
                label: "Sistemli bir otomasyon programı var",
                score: S[3],
                action: "Karar gerektiren adımlarda yapay zekâ destekli otomasyonu değerlendirin",
                detail:
                  "Kural tabanlı otomasyonun yetmediği, yorum gerektiren adımlar için yapay zekâ destekli çözümleri pilot edin.",
              },
            ],
          },
        ],
      },
      {
        name: "Sistem Entegrasyonu",
        description: "Sistemler birbiriyle konuşuyor mu?",
        questions: [
          {
            text: "Sistemler arasında veri aktarımı nasıl yapılıyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Elle yeniden giriliyor",
                score: S[0],
                action: "Mükerrer veri girişi yapılan noktaları listeleyin",
                detail:
                  "Aynı verinin kaç sistemde elle girildiğini çıkarın; her mükerrer giriş hem zaman kaybı hem hata kaynağıdır.",
              },
              {
                label: "Dosya dışa/içe aktarımıyla",
                score: S[1],
                action: "Dosya aktarımlarını zamanlanmış hâle getirin",
                detail:
                  "Elle yapılan dışa/içe aktarımı otomatik çalışan bir görevle değiştirin; ara adım olarak hızlı kazanım sağlar.",
              },
              {
                label: "Bazı sistemler entegre",
                score: S[2],
                action: "Kritik sistemler için arayüz tabanlı entegrasyona geçin",
                detail:
                  "Dosya aktarımı gecikmeli ve kırılgandır; en kritik iki sistem arasında gerçek zamanlı bağlantı kurun.",
              },
              {
                label: "Sistemler arayüzlerle entegre",
                score: S[3],
                action: "Entegrasyonları merkezî bir katmanda yönetin",
                detail:
                  "Nokta nokta bağlantılar zamanla karmaşıklaşır; ortak bir entegrasyon katmanı bakım yükünü düşürür.",
              },
            ],
          },
          {
            text: "Müşteri ve tedarikçilerinizle veri alışverişi nasıl yürüyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "Telefon ve e-posta ile",
                score: S[0],
                action: "Standart form ve şablonlar tanımlayın",
                detail:
                  "Serbest metin yerine sabit alanları olan formlar kullanın; standartlaşmayan veri dijitalleştirilemez.",
              },
              {
                label: "Standart dosya şablonlarıyla",
                score: S[1],
                action: "Paydaşlar için self servis bir portal açın",
                detail:
                  "Sık kullanılan bilgileri paydaşın kendisinin girebileceği veya görebileceği bir ekran sunun.",
              },
              {
                label: "Portal üzerinden",
                score: S[2],
                action: "Büyük paydaşlarla sistem entegrasyonu kurun",
                detail:
                  "İş hacminin çoğunu oluşturan birkaç paydaşla doğrudan sistem bağlantısı kurmak en yüksek getiriyi verir.",
              },
              {
                label: "Sistemler doğrudan entegre",
                score: S[3],
                action: "Paydaş verisini kendi analitiğinize dahil edin",
                detail:
                  "Tedarik ve talep verisini kendi tahminlerinize katarak planlama doğruluğunu artırın.",
              },
            ],
          },
          {
            text: "Süreç performansınızı ölçme olgunluğunuzu 1-5 arasında değerlendirin.",
            type: "SCALE",
            weight: 1,
            axisType: "VELOCITY",
            levels: [
              {
                label: "1 puan",
                score: 1,
                action: "Bir sürecin süresini ölçmeye başlayın",
                detail:
                  "Tek bir süreç seçip başlangıç ve bitiş zamanını kaydedin; ölçmeye tek noktadan başlamak en kolayıdır.",
              },
              {
                label: "2 puan",
                score: 2,
                action: "Ölçümü düzenli raporlanan bir göstergeye çevirin",
                detail: "Ölçtüğünüz süreyi aylık olarak raporlayın ve eğilimi izleyin.",
              },
              {
                label: "3 puan",
                score: 3,
                action: "Ölçümü tüm kritik süreçlere yayın",
                detail:
                  "Tek süreçten çıkıp uçtan uca akışın her adımını ölçün; darboğaz ancak bütünü görünce anlaşılır.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 7 },
              },
              {
                label: "4 puan",
                score: 4,
                action: "Hedef değerler ve sapma uyarıları tanımlayın",
                detail:
                  "Her gösterge için hedef koyup sapma hâlinde otomatik uyarı üretin; rapor beklemeden müdahale edin.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 7 },
              },
              {
                label: "5 puan",
                score: 5,
                action: "Süreç madenciliğiyle gerçek akışı analiz edin",
                detail:
                  "Sistem kayıtlarından süreçlerin gerçekte nasıl aktığını çıkarın; tasarlanan ile yaşanan akış çoğu zaman farklıdır.",
                overrides: { timeframe: "LONG_TERM", strategicType: "BIG_BET", costType: "CAPEX", estimatedImpact: 8 },
              },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    name: "Veri ve Analitik",
    description:
      "Veriye güveniliyor mu, kararlar veriye mi dayanıyor? Dijitalleşmenin uzun vadeli taşıyıcısı budur.",
    subCategories: [
      {
        name: "Veri Yönetimi",
        description: "Veri güvenilir, tekil ve sahipli mi?",
        questions: [
          {
            text: "Temel verileriniz için tek bir doğru kaynak var mı?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Her birim kendi kaydını tutuyor",
                score: S[0],
                action: "En kritik veri kümesi için tek kaynak belirleyin",
                detail:
                  "Müşteri veya ürün gibi tek bir veri kümesi seçip hangi sistemin resmî kaynak olduğunu ilan edin.",
              },
              {
                label: "Ana sistem var ama kopyalar dolaşıyor",
                score: S[1],
                action: "Kopya listelerin kullanımını kurala bağlayın",
                detail:
                  "Raporların ana sistemden beslenmesini zorunlu kılın; elle tutulan kopyalar zamanla ana kaynakla çelişir.",
              },
              {
                label: "Tek kaynak var, senkronizasyon gecikiyor",
                score: S[2],
                action: "Veri güncelleme sıklığını iş ihtiyacına göre ayarlayın",
                detail:
                  "Hangi verinin ne sıklıkta güncel olması gerektiğini belirleyip aktarım takvimini buna göre kurun.",
              },
              {
                label: "Tek kaynak, gerçek zamanlı",
                score: S[3],
                action: "Ana veri yönetimi disiplinini kurumsallaştırın",
                detail:
                  "Veri tanımları, sahipleri ve değişiklik süreçlerini yazılı hâle getirip düzenli denetleyin.",
              },
            ],
          },
          {
            text: "Veri kalitesi nasıl yönetiliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Yönetilmiyor, hatalar kullanınca fark ediliyor",
                score: S[0],
                action: "Sık karşılaşılan veri hatalarını listeleyin",
                detail:
                  "Kullanıcılardan bir ay boyunca karşılaştıkları hataları toplayın; en sık üç hata genelde toplam sorunun çoğunu oluşturur.",
              },
              {
                label: "Fark edildikçe elle düzeltiliyor",
                score: S[1],
                action: "Giriş ekranlarına doğrulama kuralları ekleyin",
                detail:
                  "Hatalı veriyi sonradan temizlemek yerine girişte engelleyin; en ucuz düzeltme hiç oluşmamasıdır.",
              },
              {
                label: "Giriş kontrolleri var, ölçüm yok",
                score: S[2],
                action: "Veri kalitesi göstergeleri tanımlayıp izleyin",
                detail:
                  "Eksik alan oranı ve mükerrer kayıt sayısı gibi birkaç göstergeyi düzenli ölçün.",
              },
              {
                label: "Ölçülüyor ve düzenli iyileştiriliyor",
                score: S[3],
                action: "Veri kalitesini sahiplere ait hedeflere bağlayın",
                detail:
                  "Her veri kümesinin sahibine kalite hedefi verin; sahipsiz kalite zamanla geriler.",
              },
            ],
          },
          {
            text: "Verilerinizin sahipliği ve gizlilik sınıflandırması yapılmış mı?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Yapılmamış",
                score: S[0],
                action: "Hangi verinin nerede tutulduğunu envanterleyin",
                detail:
                  "Basit bir tabloyla veri kümesi, konum ve sorumlu bilgisini çıkarın; korunacak şeyin ne olduğunu bilmeden koruma kurulamaz.",
              },
              {
                label: "Envanter var, sınıflandırma yok",
                score: S[1],
                action: "Üç seviyeli bir gizlilik sınıflandırması uygulayın",
                detail:
                  "Açık, iç kullanım ve gizli şeklinde sade bir sınıflandırma yeterlidir; karmaşık şemalar uygulanmaz.",
              },
              {
                label: "Sınıflandırma var, erişimle eşleşmiyor",
                score: S[2],
                action: "Erişim yetkilerini sınıflandırmaya göre yeniden kurun",
                detail:
                  "Gizli veriye erişimi rol bazlı kısıtlayın ve düzenli gözden geçirin.",
              },
              {
                label: "Sınıflandırma erişimle eşleşmiş",
                score: S[3],
                action: "Veri saklama ve imha sürelerini tanımlayın",
                detail:
                  "Her sınıf için ne kadar süre saklanacağını ve nasıl imha edileceğini yazıp otomatikleştirin.",
              },
            ],
          },
        ],
      },
      {
        name: "Analitik Yetkinlik",
        description: "Veriden karar çıkıyor mu?",
        questions: [
          {
            text: "Yönetim raporlarınız nasıl üretiliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Elle derlenip sunum hâline getiriliyor",
                score: S[0],
                action: "En çok istenen raporu standart bir şablona bağlayın",
                detail:
                  "Her ay sıfırdan hazırlanan raporu sabit bir şablona oturtun; standartlaşan rapor otomatikleştirilebilir.",
              },
              {
                label: "Elektronik tablolarda yarı otomatik",
                score: S[1],
                action: "Raporu doğrudan kaynak sisteme bağlayın",
                detail:
                  "Elle veri kopyalama adımını kaldırın; her kopyalama hem gecikme hem hata riski taşır.",
              },
              {
                label: "Otomatik panolar var, sınırlı kullanılıyor",
                score: S[2],
                action: "Panoları karar toplantılarının merkezine alın",
                detail:
                  "Toplantıda slayt yerine canlı panoyu açın; kullanılmayan pano yatırımı boşa gider.",
              },
              {
                label: "Panolar karar süreçlerinin merkezinde",
                score: S[3],
                action: "Self servis analitiği iş birimlerine yayın",
                detail:
                  "İş birimlerinin kendi sorularını kendilerinin cevaplayabileceği araçlar ve eğitim sağlayın.",
              },
            ],
          },
          {
            text: "Kararlarınızda veri ne ölçüde kullanılıyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Ağırlıkla tecrübe ve sezgiyle",
                score: S[0],
                action: "Önemli kararlarda tek bir veri sorusu sorun",
                detail:
                  'Her karar öncesi "bunu destekleyen veri ne?" sorusunu gündeme koyun; alışkanlık küçük başlar.',
              },
              {
                label: "Veri destekleyici olarak kullanılıyor",
                score: S[1],
                action: "Karar öncesi veri özetini zorunlu kılın",
                detail:
                  "Yönetim kararlarına gelen konularda kısa bir veri özeti şartı getirin.",
              },
              {
                label: "Kararlar veriye dayanıyor, sonuç ölçülmüyor",
                score: S[2],
                action: "Kararların sonucunu geriye dönük ölçün",
                detail:
                  "Alınan kararın beklenen etkiyi verip vermediğini birkaç ay sonra ölçüp kayda geçin.",
              },
              {
                label: "Kararlar veriye dayanıyor ve sonucu ölçülüyor",
                score: S[3],
                action: "Kontrollü deney kültürü kurun",
                detail:
                  "Büyük değişiklikleri önce sınırlı bir grupta deneyip sonucu karşılaştırın; varsayımla yaygınlaştırmayın.",
              },
            ],
          },
          {
            text: "İleri analitik ve yapay zekâ kullanımınızı 1-5 arasında değerlendirin.",
            type: "SCALE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "1 puan",
                score: 1,
                action: "Ekibe temel veri okuryazarlığı eğitimi verin",
                detail:
                  "İleri analitikten önce ekibin veriyi doğru okuması gerekir; kısa bir farkındalık eğitimiyle başlayın.",
              },
              {
                label: "2 puan",
                score: 2,
                action: "Somut bir tahminleme sorusu belirleyin",
                detail:
                  "Talep tahmini veya arıza öngörüsü gibi net getirisi olan tek bir problem seçin.",
              },
              {
                label: "3 puan",
                score: 3,
                action: "Seçtiğiniz problemde pilot model kurun",
                detail:
                  "Küçük ölçekli bir model geliştirip mevcut yöntemle karşılaştırın; başarısız pilot da öğreticidir.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 7 },
              },
              {
                label: "4 puan",
                score: 4,
                action: "Başarılı modelleri günlük sürece gömün",
                detail:
                  "Model çıktısını rapor olarak sunmak yerine karar anında kullanıcının önüne getirin.",
                overrides: { timeframe: "LONG_TERM", strategicType: "PROJECT", estimatedImpact: 8 },
              },
              {
                label: "5 puan",
                score: 5,
                action: "Model performansını ve etik kullanımı izleyin",
                detail:
                  "Modellerin zamanla bozulmasını takip eden bir izleme kurun ve kullanım ilkelerini yazılı hâle getirin.",
                overrides: { timeframe: "LONG_TERM", strategicType: "BIG_BET", costType: "CAPEX", estimatedImpact: 9 },
              },
            ],
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    name: "Teknoloji ve Güvenlik",
    description:
      "Altyapı dönüşümü taşıyabilir mi, riskler yönetiliyor mu? Görünmez ama en pahalı boyut budur.",
    subCategories: [
      {
        name: "Altyapı ve Süreklilik",
        description: "Sistemler ayakta ve güncel kalıyor mu?",
        questions: [
          {
            text: "Uygulamalarınız ağırlıklı olarak nerede çalışıyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Ofisteki fiziksel sunucularda",
                score: S[0],
                action: "Sunucu envanteri ve yaş analizi çıkarın",
                detail:
                  "Hangi sunucunun kaç yaşında olduğunu ve neyi çalıştırdığını listeleyin; yenileme planı buradan doğar.",
              },
              {
                label: "Kısmen barındırma hizmetinde",
                score: S[1],
                action: "Kritik olmayan iş yüklerini buluta taşıyın",
                detail:
                  "Riski düşük bir uygulamayla başlayarak bulut operasyon deneyimi kazanın.",
              },
              {
                label: "Ağırlıkla bulutta, elle yönetiliyor",
                score: S[2],
                action: "Altyapıyı kod olarak tanımlayın",
                detail:
                  "Elle kurulan ortamlar tekrarlanamaz; tanımları koda dökerek kurulum ve geri dönüşü güvenilir yapın.",
              },
              {
                label: "Bulutta, otomatik yönetiliyor",
                score: S[3],
                action: "Maliyet ve kapasiteyi düzenli optimize edin",
                detail:
                  "Kullanılmayan kaynakları tespit eden bir gözden geçirme ritmi kurun; bulut maliyeti denetlenmezse büyür.",
              },
            ],
          },
          {
            text: "Yedekleme ve olağanüstü durum hazırlığınız hangi düzeyde?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Düzenli yedek alınmıyor",
                score: S[0],
                action: "Kritik sistemler için otomatik günlük yedek kurun",
                detail:
                  "Elle alınan yedek er geç unutulur; en kritik sistemlerden başlayarak otomatik yedeklemeyi devreye alın.",
              },
              {
                label: "Yedek alınıyor, geri dönüş denenmiyor",
                score: S[1],
                action: "Yedekten geri dönüşü test edin",
                detail:
                  "Denenmemiş yedek yedek sayılmaz; yılda en az bir kez gerçek geri dönüş tatbikatı yapın.",
              },
              {
                label: "Geri dönüş test ediliyor, planı yok",
                score: S[2],
                action: "Yazılı bir olağanüstü durum planı hazırlayın",
                detail:
                  "Kimin ne yapacağını, hangi sistemin hangi sırayla ayağa kalkacağını yazın ve erişilebilir tutun.",
              },
              {
                label: "Test edilmiş yazılı plan var",
                score: S[3],
                action: "Kurtarma sürelerini hedeflere bağlayıp tatbikat yapın",
                detail:
                  "Her kritik sistem için hedef kurtarma süresi belirleyip yıllık tatbikatlarla doğrulayın.",
              },
            ],
          },
          {
            text: "Yazılım güncelleme ve yaşam döngüsü yönetiminiz nasıl?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Sorun çıkmadıkça güncellenmiyor",
                score: S[0],
                action: "Desteği bitmiş yazılımları tespit edin",
                detail:
                  "Üreticisi tarafından artık güncellenmeyen ürünleri listeleyin; bunlar en büyük güvenlik açığınızdır.",
              },
              {
                label: "Ara sıra, planlamasız güncelleniyor",
                score: S[1],
                action: "Aylık güncelleme penceresi tanımlayın",
                detail:
                  "Sabit bir bakım penceresi belirleyip güncellemeleri o pencereye toplayın.",
              },
              {
                label: "Düzenli güncelleniyor, test ortamı yok",
                score: S[2],
                action: "Güncellemeleri önce test ortamında deneyin",
                detail:
                  "Canlıya doğrudan uygulanan güncelleme kesinti riski taşır; ayrı bir test ortamı kurun.",
              },
              {
                label: "Test ortamlı, planlı güncelleme",
                score: S[3],
                action: "Güncelleme sürecini otomatikleştirin",
                detail:
                  "Test ve yayına alma adımlarını otomatik hâle getirerek hem hızı hem güvenilirliği artırın.",
              },
            ],
          },
        ],
      },
      {
        name: "Siber Güvenlik",
        description: "Erişim, farkındalık ve belgelendirme",
        questions: [
          {
            text: "Sistem erişim yetkileri nasıl yönetiliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Ortak hesaplar ve paylaşılan şifreler var",
                score: S[0],
                action: "Ortak hesapları kişisel hesaplara ayırın",
                detail:
                  "Paylaşılan hesapta kimin ne yaptığı bilinemez; her kullanıcıya kendi hesabını tanımlayın.",
              },
              {
                label: "Kişisel hesaplar var, yetkiler geniş",
                score: S[1],
                action: "Rol bazlı yetkilendirmeye geçin",
                detail:
                  "Herkese her yetkiyi vermek yerine görev tanımına göre roller oluşturun.",
              },
              {
                label: "Rol bazlı yetki var, gözden geçirilmiyor",
                score: S[2],
                action: "Yetkileri altı ayda bir gözden geçirin",
                detail:
                  "Görev değişikliklerinde eski yetkiler birikir; düzenli gözden geçirme bu birikmeyi temizler.",
              },
              {
                label: "Yetkiler düzenli gözden geçiriliyor",
                score: S[3],
                action: "Kritik sistemlerde çok faktörlü doğrulamayı zorunlu kılın",
                detail:
                  "Şifre tek başına yeterli değildir; en kritik sistemlerde ikinci doğrulama adımı ekleyin.",
              },
            ],
          },
          {
            text: "Çalışanlara siber güvenlik farkındalık eğitimi veriliyor mu?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Verilmiyor",
                score: S[0],
                action: "Tek seferlik bir farkındalık oturumu düzenleyin",
                detail:
                  "Bir saatlik temel oturum bile oltalama saldırılarına karşı ciddi koruma sağlar.",
              },
              {
                label: "İşe girişte bir kez veriliyor",
                score: S[1],
                action: "Eğitimi yıllık tekrara bağlayın",
                detail:
                  "Tehditler değişiyor; yılda bir kez güncel içerikle tekrarlayın.",
              },
              {
                label: "Düzenli veriliyor, ölçülmüyor",
                score: S[2],
                action: "Simülasyonla farkındalığı ölçün",
                detail:
                  "Kontrollü oltalama testleriyle gerçek davranışı ölçün; eğitimin etkisi ancak böyle görünür.",
              },
              {
                label: "Düzenli veriliyor ve ölçülüyor",
                score: S[3],
                action: "Riskli gruplara hedefli eğitim verin",
                detail:
                  "Simülasyon sonuçlarına göre zorlanan grupları belirleyip onlara özel içerik sunun.",
              },
            ],
          },
          {
            text: "Kurumunuzda geçerli yönetim sistemi sertifikaları var mı?",
            type: "CONDITIONAL_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            conditional: {
              thresholdQuestion: "Geçerli bir yönetim sistemi sertifikanız var mı?",
              yesLabel: "Evet, var",
              noLabel: "Hayır, yok",
              options: [
                { label: "ISO 27001 (Bilgi Güvenliği)", score: 2 },
                { label: "ISO 9001 (Kalite)", score: 1 },
                { label: "ISO 22301 (İş Sürekliliği)", score: 1 },
                { label: "KVKK uyum belgelendirmesi", score: 1 },
              ],
              rangeRecommendations: [
                {
                  title: "Bilgi güvenliği yönetim sistemi kurmayı planlayın",
                  description:
                    "Sertifikasyon hedeflemeseniz bile ISO 27001 çerçevesi, güvenlik açıklarını sistemli biçimde görmenizi sağlar. Önce boşluk analiziyle başlayın.",
                  minScoreThreshold: 0,
                  maxScoreThreshold: 40,
                  points: 0.5,
                  timeframe: "LONG_TERM",
                  strategicType: "BIG_BET",
                  costType: "CAPEX",
                  estimatedImpact: 8,
                },
                {
                  title: "Mevcut sertifikaların kapsamını genişletin",
                  description:
                    "Sahip olduğunuz belgelerin kapsamı çoğu zaman tek bir birimle sınırlıdır. Kapsamı kritik süreçlerin tamamına yayarak gerçek koruma elde edin.",
                  minScoreThreshold: 41,
                  maxScoreThreshold: 100,
                  points: 0.5,
                  timeframe: "MEDIUM_TERM",
                  strategicType: "PROJECT",
                  costType: "OPEX",
                  estimatedImpact: 6,
                },
              ],
            },
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────
  {
    name: "İnsan ve Kültür",
    description:
      "Dönüşümü taşıyacak yetkinlik ve istek var mı? Teknoloji alınabilir, kültür alınamaz.",
    subCategories: [
      {
        name: "Dijital Yetkinlik",
        description: "Çalışanlar araçları kullanabiliyor mu?",
        questions: [
          {
            text: "Çalışanların dijital yetkinliği nasıl geliştiriliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1.5,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Kendi imkânlarıyla, plansız",
                score: S[0],
                action: "Temel dijital araçlar için kısa eğitimler açın",
                detail:
                  "Herkesin kullandığı ofis ve iletişim araçlarıyla başlayın; en yaygın araç en yüksek getiriyi verir.",
              },
              {
                label: "Talep oldukça eğitim alınıyor",
                score: S[1],
                action: "Rollere göre bir eğitim planı hazırlayın",
                detail:
                  "Hangi rolün hangi yetkinliğe ihtiyacı olduğunu belirleyip yıllık plana bağlayın.",
              },
              {
                label: "Planlı eğitim var, yetkinlik ölçülmüyor",
                score: S[2],
                action: "Yetkinlik seviyelerini ölçüp boşlukları belirleyin",
                detail:
                  "Basit bir öz değerlendirmeyle mevcut seviyeyi ölçün ve eğitimi boşluğa göre yönlendirin.",
              },
              {
                label: "Ölçülüyor ve boşluğa göre planlanıyor",
                score: S[3],
                action: "Yetkinliği kariyer gelişimine bağlayın",
                detail:
                  "Dijital yetkinliği terfi ve görev değişikliği kriterlerine dahil ederek kalıcı hâle getirin.",
              },
            ],
          },
          {
            text: "Yeni bir dijital araç devreye alındığında kullanıcı desteği nasıl sağlanıyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Destek sağlanmıyor, kullanıcı kendi öğreniyor",
                score: S[0],
                action: "Devreye alma öncesi kısa bir tanıtım yapın",
                detail:
                  "Yarım saatlik bir tanıtım bile benimseme oranını ciddi biçimde artırır.",
              },
              {
                label: "Bir kez eğitim veriliyor",
                score: S[1],
                action: "Kısa kullanım kılavuzları ve videolar hazırlayın",
                detail:
                  "İhtiyaç anında başvurulabilecek kısa içerikler, tek seferlik eğitimden daha kalıcıdır.",
              },
              {
                label: "Doküman var, aktif destek yok",
                score: S[2],
                action: "Her birimde bir süper kullanıcı belirleyin",
                detail:
                  "Yanındaki kişiye sormak en hızlı destek kanalıdır; her birimde bir gönüllüyü yetkilendirin.",
              },
              {
                label: "Süper kullanıcı ağıyla destekleniyor",
                score: S[3],
                action: "Benimseme oranını ölçüp düşük kullanımı araştırın",
                detail:
                  "Kimin aracı gerçekten kullandığını ölçün; düşük kullanım genelde araçtan değil süreçten kaynaklanır.",
              },
            ],
          },
          {
            text: "Çalışanlarınızın dijital yetkinlik seviyesini ölçüyor musunuz?",
            type: "YES_NO",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Hayır",
                score: 0,
                action: "Basit bir öz değerlendirme anketi uygulayın",
                detail:
                  "On soruluk bir öz değerlendirme bile eğitim planınızı yönlendirecek kadar bilgi verir.",
              },
              {
                label: "Evet",
                score: 5,
                action: "Ölçüm sonucunu eğitim bütçesinin dağılımına bağlayın",
                detail:
                  "Bütçeyi en büyük yetkinlik boşluğunun olduğu alanlara yönlendirin.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 6 },
              },
            ],
          },
        ],
      },
      {
        name: "Değişim ve İnovasyon",
        description: "Yeni fikirler denenebiliyor mu?",
        questions: [
          {
            text: "Yeni fikirlerin denenmesi nasıl yönetiliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Yeni fikir denemek için bir yol yok",
                score: S[0],
                action: "Fikirleri toplayacak açık bir kanal açın",
                detail:
                  "Basit bir form veya paylaşımlı liste yeterlidir; toplanmayan fikir değerlendirilemez.",
              },
              {
                label: "Fikirler toplanıyor ama değerlendirilmiyor",
                score: S[1],
                action: "Fikirleri düzenli değerlendiren bir ritim kurun",
                detail:
                  "Aylık kısa bir gözden geçirme yapın ve sonucu fikir sahibine geri bildirin; cevapsız kanal kısa sürede ölür.",
              },
              {
                label: "Değerlendiriliyor, pilot bütçesi yok",
                score: S[2],
                action: "Küçük pilotlar için ayrı bir bütçe ayırın",
                detail:
                  "Onay sürecini kısaltan küçük bir deneme bütçesi, iyi fikirlerin bürokrasiye takılmasını önler.",
              },
              {
                label: "Pilot bütçesi ve süreci var",
                score: S[3],
                action: "Başarısız pilotlardan öğrenmeyi kurumsallaştırın",
                detail:
                  "Her pilotun sonunda kısa bir öğrenme notu yazın ve paylaşın; başarısız deneme ancak paylaşılırsa değer üretir.",
              },
            ],
          },
          {
            text: "Dijital değişimlere karşı direnç nasıl yönetiliyor?",
            type: "MULTIPLE_CHOICE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "Yönetilmiyor, direnç görmezden geliniyor",
                score: S[0],
                action: "Değişim öncesi etkilenenlerle konuşun",
                detail:
                  "Kararı duyurmadan önce en çok etkilenecek kişilerle konuşmak direncin büyük kısmını önler.",
              },
              {
                label: "Duyuru yapılıyor, geri bildirim alınmıyor",
                score: S[1],
                action: "Geri bildirim kanalı açıp cevaplayın",
                detail:
                  "Soruları toplayıp açıkça cevaplayın; cevapsız kaygı söylentiye dönüşür.",
              },
              {
                label: "Geri bildirim alınıyor, plana yansımıyor",
                score: S[2],
                action: "Geri bildirimi devreye alma planına yansıtın",
                detail:
                  "Gelen uyarılara göre takvimi veya kapsamı ayarlayın; dinlenip uygulanmayan geri bildirim güveni zedeler.",
              },
              {
                label: "Geri bildirim plana yansıtılıyor",
                score: S[3],
                action: "Değişim yönetimini yöneticilerin yetkinliğine dönüştürün",
                detail:
                  "Her yöneticinin kendi ekibinde değişimi yönetebilmesi için eğitim ve araç sağlayın.",
              },
            ],
          },
          {
            text: "Dijital kültür olgunluğunuzu 1-5 arasında değerlendirin.",
            type: "SCALE",
            weight: 1,
            axisType: "ENDURANCE",
            levels: [
              {
                label: "1 puan",
                score: 1,
                action: "Üst yönetimin dijital araçları görünür şekilde kullanmasını sağlayın",
                detail:
                  "Kültür örnekle yayılır; yöneticiler kullanmadığı sürece ekip de kullanmaz.",
              },
              {
                label: "2 puan",
                score: 2,
                action: "Dijital başarıları düzenli olarak paylaşın",
                detail:
                  "Küçük kazanımları görünür kılmak, dönüşümün soyut kalmasını önler.",
              },
              {
                label: "3 puan",
                score: 3,
                action: "Birimler arası dijital iş birliğini teşvik edin",
                detail:
                  "Ortak sorunlar üzerinde birlikte çalışan karma ekipler kurun; silolar dijitalleşmenin en büyük frenidir.",
                overrides: { timeframe: "MEDIUM_TERM", strategicType: "PROJECT", estimatedImpact: 7 },
              },
              {
                label: "4 puan",
                score: 4,
                action: "Deneme yapmayı ödüllendiren bir yaklaşım benimseyin",
                detail:
                  "Sonucu ne olursa olsun iyi tasarlanmış denemeleri takdir edin; ceza korkusu denemeyi bitirir.",
                overrides: { timeframe: "LONG_TERM", strategicType: "PROJECT", estimatedImpact: 8 },
              },
              {
                label: "5 puan",
                score: 5,
                action: "Dijital yetkinliği işe alım kriterlerine ekleyin",
                detail:
                  "Kültürü kalıcı kılmanın en güçlü yolu, yeni katılanları buna göre seçmektir.",
                overrides: { timeframe: "LONG_TERM", strategicType: "BIG_BET", costType: "CAPEX", estimatedImpact: 9 },
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Anketteki toplam soru sayısı — seed sonrası doğrulama için. */
export const DEMO_QUESTION_COUNT = DEMO_CATEGORIES.reduce(
  (total, category) =>
    total +
    category.subCategories.reduce((sum, subCategory) => sum + subCategory.questions.length, 0),
  0
);
