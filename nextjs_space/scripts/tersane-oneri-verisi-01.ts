/**
 * Soru 1-11 — Çevresel: Enerji & Karbon Yönetimi, İklim Geçişi & Yeşil Tersane.
 * Açıklamalar kaynak belgedeki "1. adım" metinleridir; başlık ve
 * vade/strateji/maliyet/etki alanları metne bakılarak eklenmiştir.
 */

import type { OneriHaritasi } from "./tersane-oneri-tipi";

export const BOLUM_01: OneriHaritasi = {
  1: {
    A: {
      b: "Kapsam 1-2 başlangıç emisyon envanterini kurun",
      a: "Sabit ve hareketli yakıt kaynakları ile satın alınan elektriği kapsayan başlangıç envanterini kurun; yasal baca ölçümlerini, yakıt tüketimini ve sorumluları tek takvimde izleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Kapsam 1-2 baz yılı ve yıllık azaltım hedefleri belirleyin",
      a: "GHG Protocol/ISO 14064-1 ile uyumlu Kapsam 1-2 baz yılı belirleyin; önemli kaynaklar için yıllık mutlak ve yoğunluk hedefleri, proje sahipleri ve onaylı azaltım portföyü oluşturun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Kapsam 3'ü ekleyip hedefli geçiş planını uygulayın",
      a: "Önemlilik taramasıyla Kapsam 3 kategorilerini ekleyin; 2030/uzun vadeli hedefleri, yatırım bütçesini, karbon fiyatı varsayımını ve üç aylık yönetim gözden geçirmesini içeren geçiş planını uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Hedefleri bilim temelli doğrulatıp bağımsız güvenceye açın",
      a: "Hedefleri bilim temelli yaklaşım ile doğrulatın; azaltım sonuçlarını bağımsız güvenceye açın, sermaye planı ve yönetici performans göstergeleriyle ilişkilendirip tedarikçi/müşteri ortak azaltım programları yürütün.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 9,
    },
  },

  2: {
    A: {
      b: "Tüketim profilini çıkarıp ilk yenilenebilir tedarikini başlatın",
      a: "Aylık elektrik tüketim profilini çıkarın ve düşük riskli başlangıç olarak küçük bir YEK-G/I-REC tedariki veya uygun bir çatı GES ön fizibilitesiyle en az bir yenilenebilir kaynak uygulamasını başlatın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Üç yıllık yenilenebilir tedarik planı hazırlayın",
      a: "Yük profili, çatı/arsa kapasitesi ve bağlantı koşullarına göre üç yıllık tedarik planı hazırlayın; yerinde üretim, ikili anlaşma ve sertifikalı elektrik seçeneklerini maliyet-karbon etkisiyle karşılaştırın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Yenilenebilir payını çoğunluğa çıkarıp sertifikaları izleyin",
      a: "Yenilenebilir payını çoğunluk seviyesine çıkarın; sertifika seri numarası, üretim dönemi ve iptal kayıtlarıyla çift sayımı önleyin, üretim-tüketim uyumunu ve kalan piyasa bazlı emisyonları yıllık raporlayın.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 8,
    },
    D: {
      b: "Saatlik eşleştirme ve depolamayla %100 hedefine geçin",
      a: "Saatlik tüketim ile karbon içeriği düşük üretimi eşleştirmeye, depolama/talep tarafı esnekliğine ve ek yenilenebilir kapasite yaratan uzun vadeli sözleşmelere geçin; %100 hedefini yönetimce onaylayın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
  },

  3: {
    A: {
      b: "Saha araç envanterini çıkarıp elektrikli araç pilotu başlatın",
      a: "Forklift, saha aracı ve jeneratörleri adet, yaş, çalışma saati, yakıt ve emisyon açısından envanterleyin; bakım, rölanti azaltma ve bir elektrikli araç pilotu için sorumlu ve kayıt düzeni kurun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Filo dönüşüm planı ve şarj altyapısı ihtiyacını belirleyin",
      a: "Araç sınıfı bazında yenileme önceliği, yıllık dönüşüm oranı, şarj gücü ve elektrik altyapısı ihtiyacını belirleyin; toplam sahip olma maliyeti ile İSG risk değerlendirmesini onaylatın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Filoyu dönüştürüp satın almaya sıfır emisyon kriteri koyun",
      a: "Satın alma şartnamelerine sıfır/düşük emisyon kriteri koyun; planlı filoyu ve uygun sabit ekipmanı dönüştürün, kWh/çalışma saati, yakıt, arıza ve emisyon KPI'larını düzenli izleyin.",
      v: "ORTA", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
    D: {
      b: "Şarjı optimize edip batarya döngüselliğini kurun",
      a: "Şarjı yenilenebilir üretim ve enerji yönetim sistemiyle optimize edin; batarya ikinci yaşam/geri dönüşüm planı kurun, telematik verilerle rota-rölanti optimizasyonu yapın ve tedarik zinciri emisyonlarını doğrulayın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  4: {
    A: {
      b: "CBAM/ETS etkisini tarayıp veri sahiplerini belirleyin",
      a: "AB ETS, CBAM ve müşteri sözleşmelerinin tersaneye doğrudan/dolaylı etkisini ürün, müşteri ve malzeme bazında tarayın; gerekli veri alanları ile mevzuat sahiplerini belirleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Veri akışını prosedüre bağlayıp aylık kapanış takvimi kurun",
      a: "Kaynak belgeden rapora veri akışını yazılı prosedüre bağlayın; çelik ve enerji verileri için tedarikçi şablonu, rol matrisi, versiyon kontrolü ve aylık kapanış takvimi kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Denetim izini tamamlayıp karbon fiyatını kararlara yansıtın",
      a: "Hesaplama metodolojisi, emisyon faktörü kaynağı, değişiklik kaydı ve örneklem kontrollerini içeren denetim izini tamamlayın; karbon fiyatı senaryolarını teklif ve yatırım kararlarına yansıtın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Veri zincirini ERP'ye entegre edip bağımsız ön güvence alın",
      a: "Veri zincirini ERP/satın alma sistemine entegre edin, tedarikçi verisini risk bazlı doğrulayın ve bağımsız ön güvence uygulayın; düzenleme değişikliklerini otomatik uyum matrisiyle yönetin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  5: {
    A: {
      b: "Enerji tüketim verisini toplayıp ilk göstergeleri tanımlayın",
      a: "Son 24-36 aylık enerji faturalarını ve ana tüketicileri toplayın; enerji ekibi, sayaç okuma planı ve kWh/üretim-saati gibi ilk yoğunluk göstergelerini tanımlayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Enerji politikası, baz çizgisi ve EnPI'ları oluşturun",
      a: "Enerji politikası, önemli enerji kullanımları, baz çizgisi ve EnPI'ları oluşturun; fırsat listesini tasarruf, yatırım, sorumlu, termin ve doğrulama yöntemiyle aksiyon planına bağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Sistemi ISO 50001 belgelendirmesine hazırlayın",
      a: "İç tetkik, yönetim gözden geçirmesi ve enerji performansı iyileşme kanıtlarını tamamlayın; sistemi ISO 50001'e göre bağımsız belgelendirmeye hazırlayın ve sapmaları düzeltici faaliyetle kapatın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Alt sayaçları otomatikleştirip tasarrufları doğrulayın",
      a: "Alt sayaçları ve üretim verisini otomatikleştirip regresyon/normalizasyon kullanın; ISO 50006/IPMVP ilkeleriyle tasarrufları doğrulayın, enerji performansını yatırım ve bakım kararlarının zorunlu girdisi yapın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  6: {
    A: {
      b: "Yakıt alternatiflerini tarayıp kısa liste oluşturun",
      a: "Mevcut yakıtları tüketim, ekipman uyumu, tedarik sürekliliği, yaşam döngüsü emisyonu ve güvenlik açısından tarayın; teknik olarak uygulanabilir alternatiflerden kısa liste oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Seçilen yakıt için küçük ölçekli pilot yürütün",
      a: "Seçilen yakıt için küçük ölçekli pilot yapın; malzeme uyumu, depolama, yangın/patlama, eğitim, tedarikçi uygunluğu ve yakıt kalite kayıtlarını risk değerlendirmesiyle yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Ekipman bazlı yakıt geçiş takvimini uygulamaya alın",
      a: "Ekipman bazlı geçiş takvimi, CapEx/OpEx, yakıt bulunabilirliği ve well-to-wake emisyon kriteri oluşturun; tüketim, maliyet, emisyon ve güvenlik KPI'larıyla aşamalı uygulamayı yönetin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
    D: {
      b: "Sertifikalı düşük karbonlu yakıt tedarikini sözleşmeye bağlayın",
      a: "Sertifikalı düşük karbonlu yakıt tedariki ve uzun vadeli sözleşmeler kurun; gerçek yaşam döngüsü verisiyle yakıt yollarını karşılaştırın, enerji dayanıklılığı ve acil durum planlarını birlikte stres testine tabi tutun.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "OPEX", e: 8,
    },
  },

  7: {
    A: {
      b: "Yetkinlik boşluğu analizi yapıp sözleşmeye kabul kriteri ekleyin",
      a: "Hibrit, batarya, hidrojen ve amonyak projeleri için yetkinlik boşluğu analizi yapın; dış uzman kullanılan her projede asgari tasarım inceleme, tehlike analizi ve kabul kriterlerini sözleşmeye ekleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Çekirdek mühendislik ekibi ve yazılı ATEX prosedürleri kurun",
      a: "Çekirdek mühendislik ekibi ve onaylı tedarikçi havuzu kurun; ATEX/HAZID-HAZOP, gaz algılama, havalandırma, yangın güvenliği ve acil müdahale prosedürlerini yakıt türüne göre yazılı hale getirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Devreye alma test paketlerini standardize edin",
      a: "Personel yeterliliklerini belgeleyin; FAT/SAT, sızdırmazlık, fonksiyon, alarm ve devreye alma test paketlerini standardize ederek tekrar eden projelerde ders çıkarma kayıtlarını kullanın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Klas ve üniversitelerle demonstrasyon programı yürütün",
      a: "Klas kuruluşları, üniversiteler ve ekipman üreticileriyle demonstrasyon programı yürütün; dijital ikiz ve risk verilerini tasarım kütüphanesine aktarın, güvenlik ve emisyon performansını müşteriye doğrulanabilir biçimde sunun.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "OPEX", e: 8,
    },
  },

  8: {
    A: {
      b: "Çevresel uygulama alternatifleri kataloğu hazırlayın",
      a: "Sulu raspa, vakumlu/kapalı raspa, robotik uygulama ve düşük VOC seçeneklerinden tersane için uygulanabilir bir katalog hazırlayın; müşteri talep ettiğinde maliyet ve süre etkisini tutarlı biçimde sunun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Teklif kontrol listesine çevresel alternatifleri zorunlu kılın",
      a: "Teklif kontrol listesine çevresel alternatifleri zorunlu madde olarak ekleyin; her seçenek için işçilik, süre, enerji, su, atık ve emisyon varsayımlarını standart hesap şablonuyla karşılaştırın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    C: {
      b: "Alternatiflerin gerçek performansını ölçüp müşteriye raporlayın",
      a: "Seçilen alternatiflerin gerçek performansını iş emri ve proje kapanışında ölçün; baz senaryoyla farkı, veri kalitesi ve sapma nedenleriyle birlikte müşteriye raporlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Performans garantili hizmet modeline geçin",
      a: "Sonuçları anonim bir performans veri tabanında biriktirin; en iyi uygulamayı varsayılan teklif seçeneği yapın, performans garantili hizmet modeli ve ortak tasarruf/karbon kazanımı sözleşmeleri geliştirin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  9: {
    A: {
      b: "Teklif ekibine eko-tasarım kontrol listesi verin",
      a: "Teklif ekibine enerji verimliliği, malzeme seçimi, bakım kolaylığı, sökülebilirlik ve ömür sonu seçeneklerini görüşmek için kısa bir eko-tasarım kontrol listesi verin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Alternatifleri yaşam döngüsü maliyetiyle değerlendirin",
      a: "Alternatifleri ilk yatırım, işletme maliyeti, enerji ve emisyon etkisiyle sistematik değerlendirin; fonksiyonel birim, sistem sınırı ve veri kaynağını teklif dosyasında kaydedin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Önemli projelerde ISO 14040 uyumlu LCA uygulayın",
      a: "Önemli projelerde ISO 14040/14044 uyumlu LCA ve yaşam döngüsü maliyeti uygulayın; standart veri seti, tasarım gözden geçirme kapıları ve proje sonrası performans takibi kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Tasarımı EPD verisi ve ürün pasaportuyla besleyin",
      a: "Tasarım kararlarını doğrulanmış EPD/ürün ayak izi verileri ve dijital ürün pasaportu mantığıyla besleyin; çevresel performansı teknik şartname ve müşteri kabul kriterine dönüştürün.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  10: {
    A: {
      b: "Çevresel boyut-etki değerlendirmesi ve temel göstergeleri kurun",
      a: "Çevresel boyut-etki ve mevzuat uygunluk değerlendirmesi yapın; önemli etkiler için operasyonel kontroller, sorumlular ve temel enerji-su-atık-emisyon göstergelerini oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "ISO 14001 sistemini saha kanıtlarıyla tam işletin",
      a: "ISO 14001 yönetim sistemini iç tetkik, yönetim gözden geçirmesi, uygunsuzluk takibi ve performans hedefleriyle tam işletin; sertifikayı sahadaki kanıtlarla destekleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Harici çevre programıyla kıyaslanıp sonuçları raporlayın",
      a: "Tesis performansını uygun harici denizcilik/liman çevre programıyla kıyaslayın; yıllık rapor, tedarikçi kriterleri ve doğrulanmış iyileşme sonuçlarını yönetişime entegre edin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Net-sıfır ve sıfır atık hedeflerini tek portföyde birleştirin",
      a: "Net-sıfır, su pozitifliği, sıfır atık ve doğa pozitifliği hedeflerini tek dönüşüm portföyünde birleştirin; bağımsız güvence ve sektör ortaklıklarıyla lider uygulamaları ölçekleyin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
  },

  11: {
    A: {
      b: "Kritik altyapı için iklim tehlike envanteri oluşturun",
      a: "Havuz, kızak, rıhtım, elektrik odası, yakıt/kimyasal depoları ve erişim yolları için taşkın, deniz seviyesi, fırtına ve aşırı sıcak tehlike envanteri oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Senaryo bazlı kırılganlık analizi yapıp önlemleri önceliklendirin",
      a: "Birden çok iklim senaryosu ve zaman ufkuyla maruziyet-kırılganlık analizi yapın; eşik değerleri, iş kesintisi etkisini ve kısa/orta/uzun vadeli adaptasyon önlemlerini önceliklendirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Adaptasyon önlemlerini sermaye bütçesine entegre edin",
      a: "Önlemleri mühendislik projeleri, acil durum ve sermaye bütçesine entegre edin; tasarım kriterlerini güncelleyin ve olay/iklim verileriyle risk değerlendirmesini düzenli yenileyin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
    D: {
      b: "Kritik altyapıyı stres testine tabi tutup ortak plan kurun",
      a: "Kritik altyapıyı dayanıklılık stres testine tabi tutun; sigortacı, belediye, liman ve tedarikçilerle ortak adaptasyon planı kurup önlemlerin kaçınılan kayıp ve hizmet sürekliliği etkisini ölçün.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },
};
