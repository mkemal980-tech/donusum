# Gelişim puanı ve öneri katkısı — sözleşme

Bu belge, önerilerin gelişim puanına nasıl katkı yaptığını **tek bir tanımla**
sabitler. Motor (`lib/scoring.ts`), API uçları ve ekranlar bu tanımın
dışına çıkmaz. Sayı üreten her yer aynı fonksiyonu çağırır; tarayıcıda
hesap yapılmaz.

## Tanımlar

- **Taban puan** — yalnızca anket cevaplarından hesaplanan puan. Hiçbir öneri
  tamamlanmamış gibi davranılır.
- **Mevcut puan** — tamamlanan öneriler dahil edilerek hesaplanan puan.
- **Gelişim katkısı** — `mevcut − taban`. Birimi 1-5 ölçeğindeki puan farkı;
  yanında yüzde puan farkı da verilir (`(mevcut% − taban%)`).
- **Öneri katkısı** — tek bir önerinin tamamlanmasının puana yaptığı fark.
  Ekranda iki değer görünür: *tamamlanınca* (öneri tamamlandığında ne
  kadar ekler) ve *şu an* (bugünkü durumuyla ne kadar ekliyor).

## Kurallar

1. **Katkı yalnızca `COMPLETED` durumunda hesaplanır.** `IN_PROGRESS`,
   `PLANNED`, `NOT_STARTED` ve `CANCELLED` sıfır katkı yapar. "Devam ediyor
   %50 katkı sağlar" gibi bir kural yoktur ve ekranlarda böyle bir metin
   bulunmaz.
2. **Kademeli öneride puan alanı her zaman 0'dır.** (`triggerMaxAnswerScore`
   dolu olan öneri.) Katkısı, bağlı olduğu sorunun basamağını bir üst şıkka
   çıkarmasından türetilir. Sunucu (`/api/admin/recommendations`, içe
   aktarma, çoğaltma) bu kuralı zorlar; ekran ne gönderirse göndersin
   kademeli öneri 0 puanla saklanır.
3. **Kademesiz önerinin puanı "kaç soruluk ilerlemeye denk" birimindedir**
   (0-2 aralığı). Eksen ortalamasına doğrudan eklenmez; soruların katkısıyla
   aynı birimde toplanır: `Δ = 4 × puan / eksenAğırlığı`.
4. **Kademeli önerinin katkısı basamak sırasıyla atfedilir.** k. basamağın
   katkısı, "k−1 basamak tamamken k. basamağı da tamamlamak" ile oluşan
   farktır. Böylece bir merdivenin basamak katkıları toplamı, merdivenin
   toplam katkısına eşittir.
5. **Durum kümesi tek yerden gelir:** `NOT_STARTED`, `PLANNED`,
   `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Her uç aynı listeyi doğrular,
   her ekran aynı etiketleri gösterir.
6. **Durum değişikliği tek servisten geçer** (`lib/roadmap-status.ts`).
   İleri yönde hareket (`IN_PROGRESS`, `COMPLETED`) yumuşak kilide tabidir;
   `COMPLETED` durumuna giriş ve çıkış skor geçmişine kayıt düşer. Hangi
   sayfadan yapıldığı fark etmez.
7. **Puanlar 5 ile sınırlıdır.** Tavana dayanmış eksende öneri katkısı 0
   görünür; bu bir hata değil, ölçeğin sınırıdır.

## Ekranda gösterim

- Yol haritası kartı: `+0.32` ve altında `anket puanına eklenen · +8 yüzde
  puanı`. Sıfırken renk yok.
- Yol haritası satırı, kademesiz: `Tamamlanınca +0.05 · şu an +0.05`.
- Yol haritası satırı, kademeli: `Basamak 2/4 · tamamlanınca +0.08`.
- Öneriler sayfası bildirimi: `Öneri tamamlandı · puan +0.08 → 3.4/5`.
- Pano: kategori çubukları taban ve mevcut puanı aynı çizgide gösterir;
  fark sıfırdan büyükse şerit çıkar.

## Kabul ölçütleri

- On üç tamamlanmış kademeli öneri olan bir değerlendirmede yol haritası
  kartı sıfırdan büyük bir katkı gösterir.
- Yol haritası, pano ve trend grafiği aynı mevcut puanı söyler.
- Yol haritasından yapılan bir tamamlama trend grafiğine yeni nokta olarak
  düşer ve kilitli basamak yol haritasından da ilerletilemez.
- Kademeli bir öneri admin ekranından düzenlenip kaydedildiğinde puanı 0 ve
  eşiği korunmuş kalır.
- `npm run typecheck`, `npm run lint`, `npm test` temiz geçer.
