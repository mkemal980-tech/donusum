/** Soru 25-38 — Sosyal: İş Sağlığı & Güvenliği, Çalışan Hakları & Kapsayıcılık. */

import type { OneriHaritasi } from "./tersane-oneri-tipi";

export const BOLUM_03: OneriHaritasi = {
  25: {
    A: {
      b: "Eğitimlere bilgi testi ve uygulamalı gösterim ekleyin",
      a: "Her eğitim için katılım yanında kısa bilgi testi ve kritik işlerde uygulamalı gösterim ekleyin; başarısız sonuçta tekrar eğitim ve yetkilendirme kısıtı uygulayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Görev-risk bazlı yetkinlik matrisi kurun",
      a: "Görev-risk bazlı yetkinlik matrisi kurun; saha gözlemi, ramak kala ve denetim bulgularını eğitim ihtiyaç analizine bağlayıp yıllık planı kanıta göre güncelleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Davranış temelli gözlem programı ve dijital kayıt kullanın",
      a: "Davranış temelli gözlem programı ve dijital eğitim kayıtları kullanın; bilgi kalıcılığı, güvenli davranış, olay ve tekrar eğitim KPI'larıyla etkinliği düzenli gözden geçirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Simülasyon/VR ile yeterlilikleri bağımsız doğrulatın",
      a: "Simülasyon/VR ve senaryo tabanlı değerlendirme uygulayın; eğitim ile olay azalması arasındaki etkiyi analiz edin, yükleniciler dahil kritik yeterlilikleri bağımsız gözlem ve kör saha doğrulamasıyla test edin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  26: {
    A: {
      b: "Kaza ve ramak kala için tek kayıt sistemi kurun",
      a: "Tüm kaza, meslek hastalığı şüphesi ve ramak kala olayları için tek kayıt sistemi kurun; yasal bildirim, ilk inceleme, sorumlu ve termin alanlarını zorunlu yapın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "TRIFR/LTIFR hesaplayıp kök neden analizini uygulayın",
      a: "Çalışma saati temelli TRIFR/LTIFR ve şiddet göstergelerini tutarlı tanımlarla hesaplayın; kök neden, düzeltici faaliyet etkinlik kontrolü ve tekrar eden olay analizini uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Ramak kala bildirimini teşvik edip öncü göstergeleri izleyin",
      a: "Ramak kala ve güvenli davranış bildirimini teşvik edin; öncü göstergeleri bölüm/yüklenici bazında trendleyip üst yönetime raporlayın ve yüksek potansiyelli olayları ayrı yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Olay verisini analiz edip öngörücü risk modelleri kurun",
      a: "Olay verisini iş emri, vardiya, yorgunluk, eğitim ve maruziyet verileriyle analiz edin; öngörücü risk modelleri ve bağımsız kültür değerlendirmesiyle ölümcül riskleri proaktif olarak azaltın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 9,
    },
  },

  27: {
    A: {
      b: "Acil durum ekiplerini güncelleyip tatbikat takvimi kurun",
      a: "Acil durum ekipleri, iletişim zinciri, toplanma alanı ve ekipman listelerini güncelleyin; vardiya ve yüklenici kapsamasını doğrulayan planlı tatbikat takvimi oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Senaryolu tatbikat yapıp dersleri kayıt altına alın",
      a: "Yangın, deprem, kimyasal döküntü, deniz kirliliği ve kurtarma için senaryolu tatbikatlar yapın; müdahale süresi, sayım doğruluğu, ekipman işlevi ve dersleri kayıt altına alın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Kurumlarla ortak ve habersiz tatbikat düzenleyin",
      a: "İtfaiye, AFAD/belediye, liman ve komşu tesislerle ortak/habersiz tatbikatlar düzenleyin; performans kriterlerini önceden belirleyip düzeltici faaliyetlerin kapanışını üst yönetimde izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Birleşik kriz senaryolarıyla dayanıklılığı stres testine sokun",
      a: "Birleşik ve eşzamanlı kriz senaryolarıyla iş sürekliliğini birlikte test edin; dijital komuta/iletişim yedekliliği ve bağımsız gözlemci değerlendirmesiyle tesis dayanıklılığını stres testine tabi tutun.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  28: {
    A: {
      b: "Yasal ölçüm ve sağlık tarama takvimi oluşturun",
      a: "Gürültü, solvent, metal dumanı ve diğer kimyasallar için yasal ölçüm ve sağlık tarama takvimi oluşturun; maruziyet gruplarını ve kayıt sorumlularını belirleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Maruziyet grupları ve görev bazlı risk planı kurun",
      a: "Benzer maruziyet grupları ve görev bazlı risk planı kurun; kişisel/ortam ölçümlerini sağlık gözetimiyle birlikte değerlendirip mühendislik kontrolü ve aksiyon takibi uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Maruziyeti ikame ve lokal emişle kaynağında azaltın",
      a: "İkame, kapalı sistem, lokal emiş ve otomasyon projeleriyle maruziyeti kaynağında azaltın; trendleri, sınır aşımını ve kontrol etkinliğini yetkin dış değerlendirmeyle doğrulayın.",
      v: "ORTA", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
    D: {
      b: "Gerçek zamanlı sensörle uzun dönem sağlık trendi izleyin",
      a: "Gerçek zamanlı sensör ve giyilebilir cihazlardan yararlanın; gecikmeli sağlık etkileri için uzun dönem kohort/trend analizi yapıp tasarım ve satın alma kriterlerini maruziyet önleme hedeflerine bağlayın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  29: {
    A: {
      b: "İşi durdurma hakkını yazılı duyurup eğitimle açıklayın",
      a: "Her çalışan ve yüklenicinin ciddi/ani tehlikede işi durdurma hakkını yazılı duyurun; amir onayı aranmadan güvenli alana çekilme ve bildirim kanalını eğitimle açıklayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "Durdurma olaylarını suçlayıcı olmayan biçimde kaydedin",
      a: "Durdurma olaylarını suçlayıcı olmayan biçimde kaydedin; hızlı saha değerlendirmesi, tehlike giderme, işi yeniden başlatma yetkisi ve bildirim sahibine geri bildirim süreci kurun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    C: {
      b: "Misilleme yasağını denetleyip kullanım sürelerini izleyin",
      a: "Misilleme yasağını denetleyin; yüksek kaliteli bildirimleri tanıyın, kök neden ve tekrar analizlerini yönetime taşıyın, kullanım ve kapanış sürelerini bölüm/yüklenici bazında izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Psikolojik güvenliği bağımsız ölçüp lider performansına bağlayın",
      a: "Psikolojik güvenliği bağımsız kültür anketi ve saha görüşmeleriyle ölçün; durdurma verisini ölümcül risk kontrollerinin etkinlik doğrulamasında kullanıp lider performansına bağlayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  30: {
    A: {
      b: "İlk yardım kapasitesi ve ambulans anlaşmasını belirleyin",
      a: "Vardiya ve risk profiline göre ilk yardımcı sayısı, sağlık personeli erişimi, ambulans/sağlık kuruluşu anlaşması ve kritik ekipman ihtiyacını belirleyin; iletişim listesini görünür tutun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "7/24 sağlık müdahale düzenini kurup prosedürleri test edin",
      a: "7/24 erişilebilir sağlık müdahale düzeni kurun; triyaj, sevk, kimyasal maruziyet, yanık ve travma prosedürlerini görevli ekip ve dış hizmet sağlayıcıyla test edin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Sağlık birimini olay komuta sistemine entegre edin",
      a: "Sağlık birimini olay komuta sistemiyle entegre edin; müdahale süresi, ekipman kullanılabilirliği, sevk sonucu ve tatbikat bulgularını KPI olarak izleyip gizlilik içinde yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Tele-tıp ve bölgesel travma ağı koordinasyonu kurun",
      a: "Tele-tıp, dijital olay aktarımı ve bölgesel travma ağıyla koordinasyon kurun; sağlık verisi gizliliğini koruyarak eğilimleri iş tasarımı ve önleyici sağlık programlarına dönüştürün.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  31: {
    A: {
      b: "Kapalı alan ve sıcak iş için yazılı izin sistemi kurun",
      a: "Kapalı alan ve sıcak iş için ayrı izin formları oluşturun; yetkili kişi, iş öncesi gaz ölçümü, izolasyon, yangın gözcüsü ve kurtarma hazırlığını zorunlu kontrol noktaları yapın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 9,
    },
    B: {
      b: "Gaz ölçümü ve kurtarma ekibini prosedürle işletin",
      a: "Kalibre gaz cihazı, sürekli/tekrarlı ölçüm, havalandırma, iletişim, giriş-çıkış sayımı ve hazır kurtarma ekibini prosedürle işletin; çalışan ve gözcü yeterliliğini uygulamalı doğrulayın.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 9,
    },
    C: {
      b: "Dijital izin, LOTO ve gerçek zamanlı gaz kaydını entegre edin",
      a: "Dijital izin, LOTO, gerçek zamanlı gaz kaydı ve yetki matrisini entegre edin; izin sapmalarını saha denetimi, alarm ve tam denetim iziyle kapatın.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 9,
    },
    D: {
      b: "Kritik kontrolleri işe başlamadan uzaktan doğrulayın",
      a: "Uzaktan gaz sensörü, video/konum takibi ve izin verisi analitiğiyle kritik kontrolleri işe başlamadan doğrulayın; yüksek potansiyelli sapmaları bağımsız ölümcül risk kontrol incelemesine alın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
  },

  32: {
    A: {
      b: "İskele ve kaldırma ekipmanını envanterleyip kontrol zorunlu kılın",
      a: "İskele, yüksekte çalışma ve kaldırma ekipmanını envanterleyin; temel kontrol listesi, etiketleme, operatör yetkisi ve kullanım öncesi görsel kontrolü zorunlu kılın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "Yetkin kişi muayenesi ve standart kaldırma planı uygulayın",
      a: "Yetkin kişi iskele muayenesi, düşmeye karşı koruma planı ve standart kaldırma planı uygulayın; operatör/sapancı/işaretçi yeterliliği ile ekipman muayene kayıtlarını doğrulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Kritik kaldırma kriterlerini mühendislik onayına bağlayın",
      a: "Kritik kaldırma kriterlerini tanımlayın; mühendislik hesabı/onayı, zemin-hava koşulu, eşzamanlı işler ve kurtarma planını yönetin, kontrol başarısı ve sapmaları KPI olarak izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Yük sensörü ve dijital muayene etiketi kullanın",
      a: "Yük sensörleri, dijital muayene etiketi ve saha konum verisi kullanın; tekrar eden planları mühendislik kütüphanesine aktarın ve ölümcül risk kontrollerini bağımsız saha doğrulamasıyla test edin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  33: {
    A: {
      b: "Saha rollerindeki engelleri belirleyip fırsat eşitliği politikası yayımlayın",
      a: "Kadınların saha rollerine katılımındaki işe alım, vardiya, tesis, ekipman/KKD ve kültür engellerini çalışan görüşmeleriyle belirleyin; idari rollerin ötesinde fırsat eşitliği politikası yayımlayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Teknik roller için sayısal hedef ve tesis uyum planı kurun",
      a: "Üretim ve teknik roller için gerçekçi sayısal hedef, erişilebilir ilan, staj/çıraklık ve tesis/KKD uyum planı kurun; işe alım ve elde tutma sonuçlarını izleyin.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 7,
    },
    C: {
      b: "Mentorluk ve eşit ücret mekanizmalarını işletip raporlayın",
      a: "Mentorluk, liderlik gelişimi, eşit ücret ve ayrımcılık önleme mekanizmalarını işletin; kademe/rol bazlı işe giriş, terfi, ücret ve ayrılma verisini yıllık raporlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Meslek okullarıyla kadın teknik yetenek havuzu oluşturun",
      a: "Tedarikçiler ve meslek okullarıyla kadın teknik yetenek havuzu oluşturun; ücret eşitliği analizini bağımsız doğrulayın ve kapsayıcı tasarımı tüm saha ekipmanı ile çalışma düzeninin varsayılanı yapın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  34: {
    A: {
      b: "Temsilci seçimini ve yönetime erişimi sistematik hale getirin",
      a: "Çalışanların temsilci seçebilmesini ve yönetime erişebilmesini sağlayın; başvuruları kayıt, sorumlu, termin ve geri bildirim alanlarıyla sistematik hale getirin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Düzenli gündemli temsilci toplantılarını kurun",
      a: "Çalışan/işveren temsilcilerinin düzenli gündemli toplantılarını kurun; İSG, ücret, vardiya ve çalışma koşulları aksiyonlarını tutanak ve kapanış takibiyle yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Toplu pazarlık haklarını politikada güvenceye alın",
      a: "Sendika ve toplu pazarlık haklarına saygıyı politika ve uygulamada güvenceye alın; ortak komitelerin karar ve iyileşme sonuçlarını göstergelerle ölçün.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Temsilcileri strateji ve adil geçiş kararlarına dahil edin",
      a: "Strateji, teknoloji değişimi ve adil geçiş kararlarında çalışan temsilcilerini erken aşamada sürece dahil edin; sosyal diyalog kalitesini bağımsız değerlendirme ve düzenli kamu raporlamasıyla güçlendirin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  35: {
    A: {
      b: "Mobbing ve ayrımcılık politikasını yayımlayıp duyurun",
      a: "Mobbing, cinsel taciz ve ayrımcılığı tanımlayan politika yayımlayın; yasak davranışlar, başvuru kanalı, gizlilik, misilleme yasağı ve olası yaptırımları açıkça duyurun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Gizli bildirim kanalı ve tarafsız soruşturma süreci kurun",
      a: "Gizli/erişilebilir bildirim kanalı, tarafsız soruşturma, kanıt koruma ve süre hedefleri kurun; yöneticiler ve çalışanlara vaka temelli eğitim verin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Kuruluş dışı bağımsız ihbar seçeneği sağlayın",
      a: "Kuruluş dışı bağımsız ihbar seçeneği sağlayın; misilleme belirtilerini izleyin, anonim eğilimleri yönetime ve çalışanlara yıllık raporlayıp önleyici aksiyon geliştirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Psikososyal riskleri bağımsız ölçüp hesap verebilirliği doğrulayın",
      a: "Kültür ve psikososyal riskleri bağımsız anket/odak gruplarıyla ölçün; eşitsizlik ve tekrar örüntülerini analiz ederek lider hesap verebilirliği, iyileştirme ve mağdur destek mekanizmalarını doğrulayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  36: {
    A: {
      b: "Eşit fırsat risklerini değerlendirip taahhüdü yazılı hale getirin",
      a: "İşe alım, ücret, gelişim ve çalışma ortamında eşit fırsat risklerini değerlendirin; ayrımcılık yasağı, makul uyum ve erişilebilir başvuru taahhüdünü yazılı hale getirin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Temsil hedefleri koyup erişilebilirlik bütçesi ayırın",
      a: "Temsil, işe alım, terfi ve elde tutma hedefleri belirleyin; engelli çalışanlar ve diğer dezavantajlı gruplar için erişilebilirlik, uyum bütçesi ve işe başlangıç desteği sağlayın.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 7,
    },
    C: {
      b: "Göstergeleri kademe bazında izleyip ücret eşitliğini analiz edin",
      a: "Göstergeleri rol/kademe bazında izleyin; erişilebilirlik denetimi, ücret eşitliği analizi ve yıllık ilerleme raporuyla program etkinliğini değerlendirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Evrensel tasarımı yatırım kriterlerine entegre edin",
      a: "Evrensel tasarım ve kapsayıcı tedarik kriterlerini yerleşke/teknoloji yatırımlarına entegre edin; çalışan gruplarını karar süreçlerine dahil edip sonuçları bağımsız paydaş değerlendirmesiyle doğrulayın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  37: {
    A: {
      b: "Çalışma saatini kişi bazında kaydedip sınır aşımını engelleyin",
      a: "Vardiya, günlük/haftalık çalışma ve fazla mesaiyi kişi bazında kaydedin; yasal sınır aşımını ve dinlenme süresi eksikliğini otomatik/manuel uyarıyla engelleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Yorgunluk risk değerlendirmesi yapıp vardiya tasarımını düzeltin",
      a: "Gece işi, ardışık vardiya, uzun işe gidiş ve kritik görevler için yorgunluk risk değerlendirmesi yapın; vardiya tasarımı, mola ve işe uygunluk kontrollerini uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Yorgunluk, olay ve devamsızlık verisini birlikte izleyin",
      a: "Yorgunluk bildirimleri, fazla mesai, hata/olay ve devamsızlık verisini birlikte izleyin; eşik aşımlarında personel planı ve düzeltici aksiyonu yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Üretim planlamasını risk verisine göre optimize edin",
      a: "Giyilebilir/reaksiyon testi gibi yöntemleri etik ve KVKK uyumlu pilotlarla değerlendirin; üretim planlamasını biyolojik ritim ve risk verisine göre optimize edip program etkinliğini bağımsız inceletin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  38: {
    A: {
      b: "Ücret ve ödeme şartlarını sözleşmeye yazıp örneklem doğrulayın",
      a: "Kendi çalışanları ve alt yükleniciler için yasal ücret, fazla mesai, kesinti ve ödeme tarihi şartlarını sözleşme/taahhütte açıkça yazın; banka dekontu/bordro örneklemiyle temel doğrulama başlatın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Riskli yüklenicilerde periyodik bordro kontrolü yapın",
      a: "Yüksek riskli yüklenicilerde periyodik bordro, puantaj ve ödeme tarihi kontrolü yapın; gecikme veya eksik ödeme için düzeltme, çalışan geri bildirimi ve yaptırım süreci kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Geçim ücreti fark analizi yapıp satın alma etkisini yönetin",
      a: "Güvenilir yerel yöntemle geçim ücreti fark analizi yapın; zamanında ödeme ve ücret yeterliliğini raporlayın, satın alma fiyat ve vadelerinin ücret ödeme kapasitesini zayıflatmamasını sağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Geçim ücreti hedefini tedarikçilerle ortak plana bağlayın",
      a: "Kademeli geçim ücreti hedefini stratejik tedarikçilerle ortak plana bağlayın; ücret sonuçlarını çalışan temsilcileri ve bağımsız denetimle doğrulayıp satın alma teşvikleriyle destekleyin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },
};
