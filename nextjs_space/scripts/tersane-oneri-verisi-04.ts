/** Soru 39-48 — Sosyal: Yetenek & Refah, Alt Yüklenici & Toplum. */

import type { OneriHaritasi } from "./tersane-oneri-tipi";

export const BOLUM_04: OneriHaritasi = {
  39: {
    A: {
      b: "Stajyer kabulünü mentor ve öğrenme çıktılarıyla yapılandırın",
      a: "Stajyer kabulünü görev tanımı, mentor, İSG eğitimi ve öğrenme çıktılarıyla yapılandırın; kurumlarla düzenli ihtiyaç ve geri bildirim toplantısı başlatın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Meslek lisesi ve üniversitelerle protokol yapıp ortak eğitim kurun",
      a: "Meslek lisesi, MYO ve üniversitelerle protokol yapın; kaynak, elektrik, mekatronik, dijital ve yeşil beceriler için ortak eğitim, eğitici ve istihdam takip sistemi kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Ortak müfredat veya tersane okulu modeli geliştirin",
      a: "Ortak müfredat/laboratuvar veya tersane okulu modeli geliştirin; kontenjan, mezuniyet, yeterlilik ve işe yerleşme hedeflerini yıllık iş gücü planına bağlayın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
    D: {
      b: "Sektör çapında yetkinlik merkezi ve eğitici havuzu kurun",
      a: "Sektör çapında yetkinlik merkezi ve eğitici havuzu kurun; mikro-yeterlilikleri uluslararası/ulusal çerçevelerle eşleyip programın istihdam, güvenlik ve verimlilik etkisini bağımsız ölçün.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  40: {
    A: {
      b: "Asgari hijyen standardı ve günlük kontrol listeleri oluşturun",
      a: "Yemek, içme suyu, soyunma-duş, tuvalet, dinlenme ve varsa barınma için asgari standart ve günlük/haftalık kontrol listeleri oluşturun; temel kayıtları tutun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Hijyen ve gıda güvenliğini planlı iç denetimle yürütün",
      a: "Hijyen, gıda güvenliği, kapasite ve bakım kontrollerini planlı iç denetimle yürütün; alt yüklenici alanlarını ve vardiya erişimini aynı kapsamda değerlendirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Bağımsız denetim ve anonim şikâyet kanalı kullanın",
      a: "Bağımsız/uzman denetim, anonim şikâyet kanalı ve hizmet KPI'ları kullanın; numune/analiz, uygunsuzluk ve düzeltici faaliyet sonuçlarını yönetimce gözden geçirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Erişilebilirlik ve beslenme kalitesini tesis tasarımına entegre edin",
      a: "Kullanıcı deneyimi ve sağlık sonuçlarını birlikte izleyin; erişilebilirlik, beslenme kalitesi ve iklim dayanıklılığını tesis tasarımına entegre edip hizmet sağlayıcı performansını açık skor kartla yönetin.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  41: {
    A: {
      b: "Asgari yetkinlikleri tanımlayıp eğitimleri tek planda birleştirin",
      a: "Görevler için asgari teknik/davranışsal yetkinlikleri tanımlayın; dağınık eğitimleri yıllık ihtiyaç ve kayıt planında birleştirin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Rol bazlı yetkinlik matrisi ve boşluk analizi kurun",
      a: "Rol bazlı yetkinlik matrisi, boşluk analizi, yıllık eğitim ve değerlendirme döngüsü kurun; kritik eksiklikleri sorumlu ve terminle kapatın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Kişisel gelişim planı, usta-çırak ve iç terfi yolları oluşturun",
      a: "Kişisel gelişim planları, usta-çırak modeli, yedekleme ve iç terfi yolları oluşturun; yetkinlik kazanımı, terfi, elde tutma ve performans etkisini ölçün.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Beceri ontolojisi ve dijital öğrenme pasaportu kullanın",
      a: "Beceri ontolojisi ve dijital öğrenme pasaportu kullanın; geleceğin yeşil/dijital iş gücü senaryolarına göre yeniden beceri kazandırma programlarını yatırım ve iş gücü planına bağlayın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  42: {
    A: {
      b: "İhtiyaçları anketle belirleyip düzenli etkinlik takvimi kurun",
      a: "Çalışanların ihtiyaçlarını kısa anket/odak gruplarıyla belirleyin; düşük maliyetli düzenli sosyal, spor veya aile destek etkinlikleri için sorumlu ve takvim oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Yıllık refah planı ve bütçesi kurup katılımı ölçün",
      a: "Yıllık refah planı ve bütçesi kurun; katılım, kapsayıcılık, memnuniyet ve vardiya erişimini ölçerek etkinlikleri geri bildirimle geliştirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Psikolojik destek ve koruyucu sağlığı gizlilikle yönetin",
      a: "Psikolojik destek, koruyucu sağlık, finansal iyi oluş ve iş-yaşam dengesi bileşenlerini gizlilikle yönetin; kullanım ve sonuç KPI'larını etik sınırlar içinde değerlendirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Psikososyal riski iş tasarımı ve vardiya kararlarına bağlayın",
      a: "Psikososyal risk değerlendirmesini iş tasarımı, liderlik ve vardiya kararlarına bağlayın; programın sağlık, devamsızlık ve elde tutma etkisini anonimleştirilmiş veriler ve bağımsız değerlendirmeyle doğrulayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  43: {
    A: {
      b: "Belge envanterini tek listede toplayıp eksikte görevlendirmeyi durdurun",
      a: "Tüm çalışan ve yüklenicilerin görev, belge türü, geçerlilik tarihi ve eksiklerini tek listede toplayın; süresi geçen/eksik belgede kritik görevlendirmeyi engelleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "Kritik meslekler için görev-belge matrisi ve kapanış planı kurun",
      a: "Kritik meslekler için görev-belge/yetkinlik matrisi ve kapanış planı kurun; yenileme uyarıları, uygulamalı yeterlilik doğrulaması ve sorumlu onayını izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Yüklenicilerde de %100 belgelilik hedefini uygulayın",
      a: "%100 geçerli belgelilik hedefini yükleniciler dahil uygulayın; işe giriş/iş emri sistemiyle yetki kontrolü ve tam denetim izi sağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Dijital kimlik/QR ile sahada anlık yetkinlik doğrulayın",
      a: "Dijital kimlik/QR ile sahada anlık yetkinlik doğrulaması yapın; belge dışında gerçek performans ve beceri gözlemlerini de kullanarak risk bazlı yeniden değerlendirme ve gelişim rotası kurun.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  44: {
    A: {
      b: "Anonim çalışan anketi uygulayıp üç somut aksiyon belirleyin",
      a: "Anonimlik, temsil ve veri gizliliği kuralları olan temel çalışan anketi uygulayın; sonuçları bölüm bazında özetleyip en az üç somut aksiyon belirleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Anketi düzenli döngüye alıp ilerlemeyi çalışanlarla paylaşın",
      a: "Anketi düzenli döngüye alın; odak gruplarıyla kök nedenleri doğrulayın, aksiyon sahibi-termin belirleyin ve ilerlemeyi çalışanlarla paylaşın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Bağımsız metodoloji kullanıp KPI'ları yönetici hedeflerine bağlayın",
      a: "Bağımsız uygulama veya metodoloji kontrolü kullanın; güven, katılım, liderlik ve elde tutma KPI'larını yöneticilerin iyileştirme hedeflerine bağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Nabız anketleriyle kapanan aksiyonların etkisini doğrulayın",
      a: "Kısa nabız anketleri ve açık uçlu eğilim analizini etik biçimde kullanın; sonuçları temsilci görüşleri ve operasyon verileriyle üçgenleyip kapanan aksiyonların gerçek etkisini doğrulayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  45: {
    A: {
      b: "Girişte belge kontrolünü standartlaştırıp eksikte girişi engelleyin",
      a: "Girişte kimlik, mesleki yeterlilik, sağlık, eğitim ve sigorta kontrolleri için standart kontrol listesi kurun; eksik belgeli personelin sahaya girişini engelleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "Alt yüklenicileri risk sınıfına göre periyodik denetleyin",
      a: "Alt yüklenicileri risk sınıfına göre periyodik saha denetimi, toolbox, olay bildirimi ve uygunsuzluk kapanışına tabi tutun; ana işveren sorumluluklarını netleştirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "ESG/İSG ön yeterlilik ve performans skor kartı uygulayın",
      a: "ESG/İSG ön yeterlilik, sözleşme şartı, performans skor kartı ve habersiz denetim sistemi uygulayın; sonuçları iş tahsisi ve yenileme kararlarına bağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Ortak dijital izin-yetkinlik ve olay platformu kurun",
      a: "Ortak dijital izin-yetkinlik ve olay platformu kurun; önde gelen yüklenicilerle kapasite geliştirme, ortak hedef ve teşvik programı yürütüp ölümcül risk kontrollerini bağımsız doğrulayın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  46: {
    A: {
      b: "Paydaşları listeleyip erişilebilir şikâyet kanalı kurun",
      a: "Komşular, balıkçılar, belediye, liman, çalışan aileleri ve diğer etkilenen grupları listeleyin; erişilebilir iletişim/şikâyet kanalı ve kayıt sorumlusu belirleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Paydaşları önceliklendirip şikâyet çözümünü süreçleştirin",
      a: "Paydaşları etki ve ilgi düzeyine göre önceliklendirin; düzenli bilgilendirme, şikâyet çözüm süresi, kanıt ve geri bildirim kapanışını yazılı süreçle yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Paydaş katılım planı ve ortak izleme göstergeleri kurun",
      a: "Paydaş katılım planı, periyodik toplantı ve ortak izleme göstergeleri kurun; alınan görüşlerin kararlara nasıl yansıdığını raporlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Birlikte tasarım ve sosyal etki ölçümü uygulayın",
      a: "Yüksek etkili yatırımlarda birlikte tasarım ve sosyal etki ölçümü uygulayın; bağımsız kolaylaştırma, kamuya açık taahhüt takip tablosu ve uyuşmazlık çözüm mekanizmasıyla güveni güçlendirin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  47: {
    A: {
      b: "Kritik İSG talimatlarını sade dil ve görselle sunun",
      a: "Çalışanların anladığı dilleri belirleyin; kritik İSG talimatı, işaret ve acil durum bilgisini sade dil, görsel ve doğrulanmış temel çevirilerle sunun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "Çok dilli eğitim verip anlamayı geri anlatımla doğrulayın",
      a: "Çok dilli işe giriş ve görev eğitimi uygulayın; tercüman/akran desteği, anlama testi ve sahada geri anlatım yöntemiyle iletişimin etkisini doğrulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Dil bazlı risk analizini yüklenicileri kapsayacak şekilde yönetin",
      a: "Dil bazlı risk analizini vardiya ve alt yüklenicileri kapsayacak şekilde yönetin; kritik talimatların güncel çeviri kontrolü ve saha gözlemiyle uygulanmasını izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Dijital çok dilli içerik ve piktogram standardı kullanın",
      a: "Dijital çok dilli içerik ve evrensel piktogram standardı kullanın; olay/ramak kala verisini dil değişkeniyle analiz edip tasarım ve gözetim kontrollerini sistematik olarak iyileştirin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  48: {
    A: {
      b: "Davranış kurallarına zorla çalıştırma yasağını ekleyip taahhüt alın",
      a: "Tedarikçi davranış kurallarına çocuk işçilik, zorla çalıştırma, belge alıkoyma ve işe alım ücreti yasağını ekleyin; tedarikçilerden imzalı taahhüt alın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Riske göre ön yeterlilik yapıp örneklem görüşme uygulayın",
      a: "Ülke, sektör, iş gücü modeli ve göçmen işçi kullanımına göre ön yeterlilik yapın; sözleşme hükümleri, örneklem belge/çalışan görüşmesi ve düzeltme planı uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Yüksek riskli tedarikçileri bağımsız denetletin",
      a: "Yüksek riskli tedarikçileri sahada/bağımsız denetleyin; alt kademe izlenebilirlik, mağdur odaklı iyileştirme ve kamuya açıklanan performans göstergeleri kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Zincirde işçi sesi ve erken uyarı sistemi kurun",
      a: "İşe alım ajansları ve alt tedarikçiler dahil zincirde işçi sesi ve erken uyarı sistemi kurun; ortak sektör programlarıyla kök nedenleri giderin ve iyileştirme sonuçlarını bağımsız doğrulayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },
};
