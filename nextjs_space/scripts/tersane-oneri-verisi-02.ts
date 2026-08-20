/** Soru 12-24 — Çevresel: Kirlilik & Atık, Su & Deniz Ekosistemi. */

import type { OneriHaritasi } from "./tersane-oneri-tipi";

export const BOLUM_02: OneriHaritasi = {
  12: {
    A: {
      b: "Boya alanlarını haritalayıp geçici kontrolleri disipline edin",
      a: "Boya uygulama alanlarını haritalayın; branda/negatif basınç gibi geçici kontrolleri standart iş talimatı, günlük kontrol listesi ve uygunsuzluk kaydıyla disipline edin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Boya kabini kullanımını zorunlu kılıp VOC kayıtlarını tutun",
      a: "Uygun kapasitede boya kabini/kapalı alan kullanımını zorunlu hale getirin; filtre basıncı, bakım, solvent tüketimi, ürün güvenlik bilgi formları ve VOC kayıtlarını takip edin.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 8,
    },
    C: {
      b: "İklim kontrollü hol ve emisyon izlemeyi devreye alın",
      a: "İklim kontrollü hol, yüksek verimli filtrasyon ve emisyon izleme sistemini risk bazlı bakım planıyla işletin; limit aşımı için alarm, iş durdurma ve kök neden süreci kurun.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
    D: {
      b: "Düşük VOC şartnameleri ve geri kazanım teknolojisi uygulayın",
      a: "Düşük/ultra düşük VOC kaplama şartnameleri, otomatik karışım/uygulama ve geri kazanım teknolojileri uygulayın; VOC'yi iş emri ve kaplanan alan başına izleyip tedarikçi inovasyon programına bağlayın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  13: {
    A: {
      b: "Atıkları kaynağında ayırıp tartım ve kayıt düzeni kurun",
      a: "Atıkları proses ve tehlike sınıfına göre kaynağında ayırın; renk/etiket standardı, tartım noktaları, lisanslı taşıyıcı-işleyici listesi ve aylık kayıt sorumluluğu oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Atık envanterini analiz edip azaltım hedeflerine bağlayın",
      a: "Atık envanterini miktar, maliyet, proses ve işlem yöntemiyle analiz edin; toplam/tehlikeli atık yoğunluğu, geri kazanım oranı ve azaltım hedeflerini onaylı aksiyon planına bağlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "9R hiyerarşisini uygulayıp geri kazanımı denetimle doğrulayın",
      a: "9R hiyerarşisine göre önce önleme, yeniden kullanım ve onarımı uygulayın; kütle dengesi ve sevk belgeleriyle yüksek geri kazanım performansını tedarikçi denetimleriyle doğrulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Endüstriyel simbiyoz kurup döngüselliği ölçün",
      a: "Yan ürün ve atıklar için endüstriyel simbiyoz/kapalı döngü anlaşmaları geliştirin; ISO 59020 göstergeleriyle döngüselliği ölçün ve bertarafa giden atık için zaman bağlı sıfıra yaklaşım hedefi belirleyin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  14: {
    A: {
      b: "Hurda çıkışını belge eşleşmesi olmadan durdurun",
      a: "Metal hurda ve tehlikeli atık için lisans, sözleşme, tartım fişi, taşıma/sevk belgesi ve nihai işlem kanıtını dosya bazında eşleştirin; eksik belgeyle çıkışı engelleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Dijital atık kaydı kurup işleyicileri ön yeterliliğe tabi tutun",
      a: "Atık kodu ve ağırlık bazlı dijital kayıt kurun; işleyicileri izin kapsamı, kapasite, alt yüklenici ve geçmiş uygunsuzluk açısından ön yeterlilik ve periyodik değerlendirmeye tabi tutun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Malzeme akış analizi yapıp zinciri denetimle teyit edin",
      a: "Malzeme akış analizi, geri kazanım verimi ve kayıp oranlarını KPI olarak izleyin; yüksek riskli akışlarda saha denetimi veya bağımsız doğrulama ile zinciri teyit edin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Parti bazlı izlenebilirlik ve kapalı döngü metal tedariki kurun",
      a: "Parti/iş emri seviyesinde dijital izlenebilirlik ve geri dönüştürülmüş içerik doğrulaması kurun; stratejik geri dönüşümcülerle kapalı döngü metal tedariki ve kalite geri besleme anlaşmaları yapın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  15: {
    A: {
      b: "Raspa alanlarında maruziyeti değerlendirip bariyer uygulayın",
      a: "Raspa alanlarında rüzgâr, komşuluk, drenaj ve çalışan maruziyetini değerlendirin; tam kapatma mümkün değilse sağlam bariyer, sulu yöntem/vakum ekipmanı ve günlük temizlik standardı uygulayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Raspa-boya kabinini planlamaya bağlayıp bakımını kayıtlayın",
      a: "Raspa-boya kabini kullanımını planlama sistemine bağlayın; havalandırma, toz toplama, filtre, negatif basınç ve atık grit kontrollerini kayıtlı bakım ve saha denetimleriyle işletin.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 8,
    },
    C: {
      b: "Tam kapalı hol ve partikül izlemeyi devreye alın",
      a: "Tam kapalı hol ve sürekli/periodik partikül izlemeyi devreye alın; alarm eşikleri, uygunsuzluk kapatma, çevresel şikâyet ve çalışan maruziyet verilerini tek performans sisteminde yönetin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 9,
    },
    D: {
      b: "Robotik ve geri kazanımlı raspa teknolojisini ölçekleyin",
      a: "Robotik/geri kazanımlı raspa ve düşük atıklı yüzey hazırlama teknolojilerini ölçekleyin; grit tüketimi, PM emisyonu, atık ve işçilik maruziyetini proje bazında kıyaslayarak en iyi yöntemi varsayılan hale getirin.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  16: {
    A: {
      b: "Hong Kong/SRR kapsam boşluk analizini yapın",
      a: "Söküm faaliyeti varsa Hong Kong Sözleşmesi ve AB SRR kapsam boşluk analizi yapın; IHM, tesis planı, gemiye özgü geri dönüşüm planı ve yetkili kişi sorumluluklarını belirleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "IHM'yi yetkin uzmanla hazırlatıp prosedürleri kayıtla işletin",
      a: "IHM'yi yetkin uzmanla hazırlatıp güncel tutun; SRFP, gemiye özgü plan, güvenli söküm, sıcak iş/kapalı alan ve tehlikeli malzeme prosedürlerini kayıtlarla işletin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Tesis yetkilendirmesini tamamlayıp bağımsız denetime açın",
      a: "Tesis yetkilendirme/sertifikasyonunu tamamlayın; işçi güvenliği, çevresel izleme, bertaraf zinciri ve gemi bazlı planları bağımsız denetime ve düzenli uygunluk kontrolüne açın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Dijital IHM ve zincir teslim kayıtlarıyla tam izlenebilirlik kurun",
      a: "Tüm malzeme akışlarını dijital IHM ve zincir teslim kayıtlarıyla izleyin; yeniden kullanım/geri kazanım çıktısını yayımlayın ve tedarikçi/alt yüklenicileri aynı doğrulama standardına dahil edin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  17: {
    A: {
      b: "Antifouling atığını ayrı toplayıp bertaraf belgesini standartlaştırın",
      a: "Antifouling söküm ve boya atığını ayrı toplayın; alan izolasyonu, etiketleme, geçici depolama ve lisanslı bertaraf belgelerini standartlaştırın, yasaklı içerik kontrolünü iş emrine ekleyin.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "AFS uygunluğunu doğrulayıp düşük toksik alternatif sunun",
      a: "Ürün teknik/SDS belgeleriyle AFS uygunluğunu doğrulayın; atık miktarı ve sevkini izleyin, düşük toksisiteli/biyositsiz alternatifleri performans ve maliyet bilgisiyle müşteriye sunun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Alternatif kaplama hedefi koyup bertaraf zincirini denetleyin",
      a: "Alternatif kaplama kullanım hedefi belirleyin; uygulama, yakıt verimliliği, bakım ve çevresel performansı izleyin, bertaraf zincirini tedarikçi denetimiyle doğrulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Kapalı devre yüzey temizleme ve geri kazanım kurun",
      a: "Kaplama seçimini yaşam döngüsü ve sucul toksisite kriterleriyle yönetin; kapalı devre yüzey temizleme/atık geri kazanımı kurup uygunluk ve performans sonuçlarını müşteri/klasla paylaşın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  18: {
    A: {
      b: "Şüpheli malzeme tarama listesi ve işi durdurma kuralı koyun",
      a: "Bakım-onarım ve söküm işlerinde bina/gemi yaşı, ekipman ve geçmiş kayıtlara göre şüpheli malzeme tarama listesi oluşturun; şüphede işi durdurma ve uzman örnekleme kuralı koyun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 8,
    },
    B: {
      b: "İş öncesi yetkin kişi incelemesi ve akredite analiz uygulayın",
      a: "İş öncesi yetkin kişi incelemesi ve akredite analiz uygulayın; pozitif bulguda kontrollü alan, sertifikalı söküm, kişisel koruma, hava ölçümü ve bertaraf belgelerini yönetin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Tehlikeli malzeme envanterini güncel tutup bağımsız doğrulatın",
      a: "Asbest, PCB, kurşun/ağır metal envanterini konum-miktar-durum bazında güncel tutun; çalışan/alt yüklenici yetkinliğini ve nihai bertaraf zincirini bağımsız denetimle doğrulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Dijital kayıtları satın alma ve bakım planlamasına bağlayın",
      a: "Dijital tehlikeli malzeme kayıtlarını satın alma, bakım ve proje planlamasına bağlayın; maruziyeti tasarımla yok etme hedefi, sağlık gözetimi trendleri ve tedarikçi içerik beyanlarıyla proaktif yönetin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  19: {
    A: {
      b: "Doğrudan deşarjı önleyip atıksuyu ayrı toplayın",
      a: "Denize doğrudan deşarjı önleyin; havuz/kızak atıksularını ayrı toplayın, kabul/arıtma noktasına sevk kayıtlarını tutun ve günlük görsel sızıntı kontrolü uygulayın.",
      v: "KISA", s: "PROJE", m: "CAPEX", e: 8,
    },
    B: {
      b: "Alıcı ortam değerlendirmesi yapıp izleme eşikleri belirleyin",
      a: "Sahaya özgü alıcı ortam ve faaliyet-etki değerlendirmesi yapın; bulanıklık, gürültü, su kalitesi, sediment ve olaylar için baz değer, izleme noktası, sıklık ve aksiyon eşiği belirleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Bilimsel izleme yürütüp sonuçları paydaşlara raporlayın",
      a: "Üniversite/uzman kuruluşla bilimsel izleme ve hedefli iyileştirme projeleri yürütün; yöntem, sonuç, uygunsuzluk ve ilerlemeyi paydaşlara düzenli ve şeffaf biçimde raporlayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Havza etkilerini yönetip net pozitif denizel katkı hedefleyin",
      a: "Kümülatif havza/liman etkilerini paydaşlarla yönetin; açık veri, erken uyarı sensörleri ve ekosistem hizmeti göstergeleriyle ölçülebilir net pozitif denizel katkı hedefleri geliştirin.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  20: {
    A: {
      b: "Sayaç verisini toplayıp hızlı su tasarrufu kazanımlarını uygulayın",
      a: "Ana sayaç verisini aylık toplayın, yüksek tüketimli alanları belirleyin; kaçak onarımı, düşük debili ekipman ve temizlik prosedürü gibi hızlı kazanımları sorumlu ve terminle uygulayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Su dengesi ve alt sayaç planı kurup yoğunluk KPI'ları izleyin",
      a: "Kaynak-proses-deşarj bazlı su dengesi ve alt sayaç planı kurun; m3/işçilik saati veya proje gibi yoğunluk KPI'larıyla kaçak, proses optimizasyonu ve hedefleri izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Yağmur suyu ve gri su geri kullanım projelerini uygulayın",
      a: "Yağmur suyu, gri su ve uygun proses geri kullanım projelerini kalite/sağlık riskleriyle uygulayın; kuraklık senaryosu, kritik kullanım öncelikleri ve su kesintisi planını düzenli test edin.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 8,
    },
    D: {
      b: "ISO 14046 su ayak izi ve havza yenileme hedefi oluşturun",
      a: "Havza stresini ve tedarik zincirini içeren ISO 14046 su ayak izi değerlendirmesi yapın; yüksek riskli kullanımlarda mutlak azaltım ve havza ortaklığıyla ölçülebilir su yenileme hedefi oluşturun.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },

  21: {
    A: {
      b: "Kimyasal alanlarını haritalayıp döküntü setleri yerleştirin",
      a: "Kimyasal/yakıt alanlarını ve yağmur suyu mazgallarını haritalayın; taşınabilir döküntü setleri, temel havuzlama ve günlük sızıntı kontrolüyle açık riskleri kapatın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Temiz-kirli su hatlarını ayırıp ikincil koruma kurun",
      a: "Temiz ve kirli su hatlarını ayırın; tank/IBC alanlarında yeterli ikincil koruma, yağ tutucu ve kapatma vanası kurun, periyodik bakım ve yağış öncesi kontrol listesi uygulayın.",
      v: "ORTA", s: "PROJE", m: "CAPEX", e: 8,
    },
    C: {
      b: "Drenaj planını dijital haritalayıp kapasitesini gözden geçirin",
      a: "Drenaj planını risk, akış yönü ve acil izolasyon noktalarıyla dijital haritalayın; tasarım kapasitesini aşırı yağışa göre gözden geçirip olay ve denetim sonuçlarını yatırım planına aktarın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Su kalitesi sensörleri ve doğa temelli çözümler uygulayın",
      a: "Su kalitesi sensörleri ve otomatik izolasyon/uyarı sistemleri kullanın; geçirgen yüzey, tampon alan ve doğa temelli çözümlerle hem taşkın hem kirletici yükünü ölçülebilir biçimde azaltın.",
      v: "UZUN", s: "BUYUK_YATIRIM", m: "CAPEX", e: 8,
    },
  },

  22: {
    A: {
      b: "Müdahale ekipmanını yerleştirip yıllık tatbikat kaydı kurun",
      a: "Risk noktalarına uygun bariyer, emici, skimmer ve kişisel koruyucu ekipman yerleştirin; ekipman envanteri, son kullanım/bakım kontrolü ve en az yıllık temel tatbikat kaydı oluşturun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "CAPEX", e: 8,
    },
    B: {
      b: "Senaryo, bildirim zinciri ve komuta yapısı tanımlayın",
      a: "Yakıt, yağ ve kimyasal için ayrı senaryolar, bildirim zinciri ve komuta yapısı tanımlayın; tatbikat sürelerini, ekipman kullanımını ve kök neden/düzeltici faaliyetleri ölçün.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    C: {
      b: "Liman ve itfaiyeyle entegre plan ve ortak tatbikat yapın",
      a: "Liman başkanlığı, kıyı tesisi, itfaiye ve yüklenicilerle entegre plan ve ortak tatbikat yapın; müdahale süresi, yayılım kontrolü ve kapanan aksiyonları performans göstergesi olarak izleyin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "Yayılım modellemesi ve erken tespit sistemleri kurun",
      a: "Akıntı-hava verili yayılım modellemesi, drone/sensör erken tespiti ve karşılıklı yardım anlaşmaları kurun; en kötü durum senaryosunu habersiz tatbikatla test edip bağımsız gözlemci değerlendirmesi alın.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  23: {
    A: {
      b: "Regülasyon takibi için teknik sorumlu belirleyin",
      a: "Balast suyu ve ilgili çevre sistemleri için IMO, klas ve üretici bültenlerini proje bazında takip edecek teknik sorumlu belirleyin; gereklilik listesini proje dosyasında tutun.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 6,
    },
    B: {
      b: "Devreye alma ve bakım gereklerini prosedürleştirin",
      a: "Tip onayı, örnekleme, devreye alma, kalibrasyon, kayıt defteri ve bakım gereklerini prosedürleştirin; servis personelini ekipman bazında eğitip doküman kontrolü uygulayın.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Yetkin servis ekibi ve standart iş paketleri kurun",
      a: "Yetkin servis ekibi ve standardize iş paketleri kurun; ilk seferde kabul, arıza tekrarı, kapanış süresi ve müşteri geri bildirimi KPI'larıyla sürekli iyileştirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    D: {
      b: "Uzaktan izleme ve filo bazlı performans analitiği geliştirin",
      a: "Uzaktan izleme/tanı, üretici veri entegrasyonu ve filo bazlı performans analitiği geliştirin; regülasyon değişikliklerini tasarım/servis kütüphanesine otomatik aktararak öngörülü bakım sunun.",
      v: "UZUN", s: "PROJE", m: "CAPEX", e: 8,
    },
  },

  24: {
    A: {
      b: "Hassas kıyı alanlarını haritalayıp temel korumayı uygulayın",
      a: "Hassas kıyı/deniz dibi alanlarını haritalayın; yasak bölgeler, demirleme/tarama kısıtları, aydınlatma-gürültü kuralları ve saha işaretlemeleriyle temel korumayı uygulayın.",
      v: "KISA", s: "HIZLI_KAZANIM", m: "OPEX", e: 7,
    },
    B: {
      b: "Sahaya özgü biyoçeşitlilik planı ve periyodik gözlem kurun",
      a: "Tür/habitat baz değeri ve faaliyet-etki yollarını belirleyin; uzman periyodik gözlem, fotoğraf/konum kaydı ve aksiyon eşikleriyle sahaya özgü biyoçeşitlilik planı kurun.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 7,
    },
    C: {
      b: "Ölçülebilir restorasyon hedefleri ve uzun dönem izleme kurun",
      a: "Ölçülebilir koruma/restorasyon hedefleri, paydaş sorumlulukları ve uzun dönem izleme göstergeleri belirleyin; projelerin sonuçlarını bilimsel yöntem ve şeffaf raporlamayla değerlendirin.",
      v: "ORTA", s: "PROJE", m: "OPEX", e: 8,
    },
    D: {
      b: "TNFD LEAP ile doğa pozitif sonuçları bağımsız doğrulatın",
      a: "TNFD LEAP yaklaşımıyla bağımlılık, etki, risk ve fırsatları yönetişime bağlayın; kaçınma-azaltma-restorasyon hiyerarşisini uygulayıp ilave ve kalıcı doğa pozitif sonuçları bağımsız olarak doğrulayın.",
      v: "UZUN", s: "PROJE", m: "OPEX", e: 8,
    },
  },
};
