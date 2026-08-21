# Product

## Register

product

## Users

Kurumsal sürdürülebilirlik ve dönüşüm sorumluları: ESG yöneticileri, birim
yöneticileri (çevre, enerji, İK, teknik), platform yöneticileri (ADMIN) ve
danışmanlar. Türkçe konuşurlar, masaüstünde 1440px+ ekranda çalışırlar,
platforma haftada birkaç kez girerler.

Yapmak istedikleri iş üç aşamalı:
1. Kuruluşları için olgunluk anketini doldurmak (bölüm bölüm, çok kullanıcılı).
2. Puanı, kategori kırılımını ve sektör kıyaslamasını görmek.
3. Öneri ve yol haritasına dönüp bir sonraki adımı seçmek, sonucu PDF olarak
   yönetime sunmak.

Kullanıcı panoya geldiğinde sırayla iki soru sorar: "kaç aldık?" ve "hangi
başlıkta zayıfız?". Panonun sıralaması bu iki soruyu izler.

## Product Purpose

ESG Akademi Dönüşüm Platformu, bir kuruluşun ESG ve dijital dönüşüm
olgunluğunu ölçer, puanlar, sektör ortalamasıyla kıyaslar ve önceliklendirilmiş
bir yol haritası üretir. Başarı ölçüsü: kullanıcı panoyu açtıktan 10 saniye
içinde puanını, en zayıf kategorisini ve bir sonraki eylemini söyleyebiliyor.

Yönetim kurulu sunumuna girecek veri burada üretilir; bu yüzden ekranın
kendisi de sunulabilir görünmek zorunda.

## Brand Personality

Ölçülü, analitik, güven veren. Danışmanlık jargonu değil, ölçüm dili.
Sayı büyük, süs küçük. Türkçe metin kısa ve emir kipinden uzak.

Üç kelime: **kesin, sakin, kurumsal**.

## Anti-references

- Neon/gradyan "AI startup" panosu: mor-pembe degrade, parlayan kart
  kenarları, cam efekti (glassmorphism). Mevcut arayüzde bunların kalıntısı
  var, temizlenecek.
- Sürdürülebilirlik klişesi: yeşil yaprak ikonları, çimen yeşili birincil
  renk, dünya görselleri.
- Tüketici uygulaması sıcaklığı: yuvarlak büyük köşeler, emoji, illüstrasyon,
  kutlama animasyonları.
- Her kartın gölgeli ve büyük radyuslu olduğu "bootstrap admin" görüntüsü.

## Design Principles

1. **Önce cevap, sonra kanıt.** Her ekran en üstte tek bir cevap verir; grafik
   ve tablolar o cevabın açıklamasıdır. Dekoratif KPI şeridi değil.
2. **Ölçülen şey vurgulanır.** Renk yalnızca veri, durum ve birincil eylem
   için. Dekoratif renk yok; pasif durum doygun renk almaz.
3. **Yoğunluk bir özelliktir.** Yönetici çok veriyi tek ekranda ister;
   boşlukla değil hizayla nefes aldırılır.
4. **Aynı şey her yerde aynı görünür.** Tek buton dili, tek kart dili, tek
   ikon seti (lucide), tek grafik paleti. Ekrandan ekrana sürpriz yok.
5. **Türkçe metin birinci sınıf.** latin-ext, uzun kelimeler, taşmayan
   etiketler. Çeviri sonradan sıkıştırılmaz.

## Accessibility & Inclusion

- WCAG 2.1 AA hedef: gövde metni ≥4.5:1, büyük başlık ve ikon ≥3:1.
- Grafiklerde renk tek ayırt edici olamaz: seri etiketi, farklı çizgi/nokta
  biçimi veya doğrudan etiket zorunlu (mavi/yeşil ikilisi kırmızı-yeşil renk
  körlüğünde ayrışır, kırmızı/yeşil ikilisi kullanılmaz).
- Tüm etkileşimli öğelerde görünür `:focus-visible` halkası; klavye ile tam
  gezinme.
- `prefers-reduced-motion` tüm geçişleri kapatır.
- Dokunma hedefi ≥40px, form alanı-etiket bağı zorunlu.
