# Kaldığımız yer

Bu dosya, yeni bir oturuma başlarken bağlamı hızlıca kurmak için tutulur.
Bir adım bitince buradaki durumu güncelleyin.

**Son güncelleme:** 2026-08-08 (plan tamam + veri/içerik işleri)

---

## Devam eden iş: çok kullanıcılı değerlendirme

Büyük bir şirkette anketin farklı bölümlerini farklı departmanlar doldurur
(atık → çevre, enerji → teknik, sosyal → İK) ve ortaya **tek bir kurumsal
puan** çıkması gerekir.

Dört adımlı plan:

| # | Adım | Durum |
|---|---|---|
| 1 | `Assessment` nesnesi — cevap/yol haritası/puan geçmişi sahipliği kişiden kuruluşa | ✅ **bitti** (`1574813`) |
| 2 | Bölüm bazlı görev dağılımı + ankette filtreleme | ✅ **bitti** |
| 3 | Koordinatör panosu (kim ne kadar doldurdu) | ✅ **bitti** |
| 4 | Gönderim / kilit adımı (puan taslak → kesin) | ✅ **bitti** |

**Plan tamamlandı.** Aşağıdaki "Açık kalan diğer başlıklar" dışında bu iş
serisinde bekleyen bir adım yok.

### 1. adımda ne yapıldı

- `Assessment = (kuruluş, anket)`; `lib/assessment.ts` içindeki
  `getOrCreateAssessment` / `getAssessmentIds` çözücüleri.
- Kuruluş olarak mevcut **`Unit`** modeli kullanıldı (boştu ama üyeler,
  yöneticiler ve hiyerarşi zaten içindeydi).
- Kuruluşu olmayan kullanıcı → tek kişilik değerlendirme; davranış eskisiyle
  aynı. Bu sayede puanlama fonksiyonlarının imzaları hâlâ `userId` alıyor.
- Doğrulandı: aynı birimdeki iki kullanıcının girdiği cevaplar tek puanda
  toplanıyor ve ikisi de aynı kurumsal puanı görüyor.

### 1. adımdan kalan eksikler — kapandı

- **Arayüz etiketleri.** Satırlar artık *değerlendirme*, başlıklar da öyle
  diyor. Birim yöneticisi tablosu en kötüsüydü: API anket adını `firstName`
  alanına koyup e-postayı `-` yapıyordu; satır kişi kılığındaydı. Artık
  değerlendirme şeklinde dönüyor (`assessments`) ve tabloda anket adı, katkı
  veren kişi sayısı, son giriş tarihi, durum ve puan var. Birim özeti de her
  birimi bir kez sayıyor (önce her değerlendirme için tekrar ediyordu).
- **Tarayıcıda denenmemiş olması.** `e2e/section-assignment.spec.ts` iki
  oturumlu gerçek akışı geçiriyor; birim panosunun yeni sözleşmesini de
  doğruluyor.

### 2. adımda ne yapıldı

Kararlaştırıldığı gibi: dağıtım bölüm (alt kategori) düzeyinde, bir bölüm tek
kişiye, koordinatör `UnitAdmin`, kuruluşu olmayan kullanıcıda her şey ona ait.

- **`SectionAssignment`** = (değerlendirme, bölüm, sorumlu). Tekillik
  `@@unique([assessmentId, subCategoryId])` ile veritabanında zorlanıyor —
  uygulama katmanındaki bir kontrol eşzamanlı iki isteğe yetmezdi.
  (migration `000006_section_assignments`)
- **`lib/section-assignment.ts`** görünürlük kuralının tek kaynağı (saf modül,
  testli): dağıtım yoksa herkes her şeyi görür; koordinatör her zaman hepsini
  görür; katkıcı yalnızca kendi bölümlerini.
- **`lib/assessment.ts`**: `getAssessmentContext` (koordinatör mü?),
  `getSectionVisibility`, `getManagedUnitIds`. Sonuncusu `unit-manager/team`
  içindeki kopya hiyerarşi gezintisinin yerini aldı (artık tek sorgu).
- **Filtreleme** `/api/survey/structure` içinde, **yaptırım**
  `/api/survey/responses` POST içinde: kendine atanmayan bölüme cevap yazan
  istek 403 alır. Ekranda gizlemek tek başına yeterli değildi.
- **Dağıtım ekranı**: Birim Yöneticisi Paneli → *Görev Dağılımı*
  (`/unit-manager/assignments`), API `/api/assessment/sections`.
  Sektör kapsamı dışındaki bölümler listelenmez; ekranda kişi başına yük var.
- Anket ekranı, bölüm atanmamış katkıcıya "anket hazırlanmamış" yerine
  "size bölüm atanmadı" der.

Kaçırılmaması gereken iki davranış:

1. **Dağıtım isteğe bağlı.** Hiç atama yoksa anket bugünkü gibi herkese açık.
   Kural "atama varsa kısıtla" — yoksa hiçbir mevcut kurulum bozulmaz.
2. **Doğrudan kategoriye bağlı sorular atanamaz** (bir alt kategorileri yok).
   Dağıtım başlayınca koordinatörde kalırlar; dağıtım ekranında bu satır
   "Sizde kalır" diye görünür.

### 2. adımdan kalan — kapandı

**Bildirim.** Bölüm atanan kişiye artık e-posta gidebiliyor, ama her atamada
değil: koordinatör on iki bölümü tek tek dağıtırken aynı kişiye on iki posta
gitseydi bildirimler okunmaz hâle gelirdi. Bunun yerine dağıtım ekranında
**"Eksiği kalanlara hatırlat"** düğmesi var — kişi başına tek özet gider ve
gönderme anını koordinatör seçer.

Alıcı listesi "eksiği kalanlar" olduğu için aynı düğme hem ilk duyuru hem
sonraki hatırlatmalar için çalışıyor; işini bitiren kimse ikinci kez rahatsız
edilmiyor. `RESEND_API_KEY`/`EMAIL_FROM` tanımlı değilse uç nokta 503 ve açık
bir mesaj dönüyor — sessizce başarı dönmek, koordinatöre gönderdiğini
sandırırdı.

### 3. adımda ne yapıldı

Pano ayrı bir ekran olmadı, dağıtım tablosunun üzerine bindi: sorumluyla
ilerleme yan yana durmadıkça "kimi arayayım" sorusu cevaplanmıyordu.

- `/api/assessment/sections` artık bölüm başına **cevaplanan soru sayısı** ve
  **son giriş tarihi** de dönüyor. Cevaplar tek sorguda çekilip bellekte
  bölümlere dağıtılıyor; bir değerlendirmede en fazla soru sayısı kadar cevap
  var, bölüm başına ayrı sorgu atmaya değmez.
- `lib/section-assignment.ts` içine `sectionStatus` (Başlanmadı / Devam ediyor
  / Bitti) ve `rollupByAssignee` eklendi — ikisi de saf ve testli. Atanmamış
  bölümler tek bir satırda toplanıyor: koordinatörün üzerinde kalan yük en çok
  orada birikiyor.
- Ekranda: anketin durumu (tek çubuk), kategori başına doluluk, bölüm başına
  durum rozeti + çubuk + son giriş tarihi, ve **"Kim ne kadar doldurdu"**
  tablosu — en geride kalan üstte, çünkü koordinatörün ilk bakacağı yer orası.
- `sectionOfQuestion` (soru → bölüm eşlemesi) tek yere alındı; cevap kaydetme
  yolu da aynı fonksiyonu kullanıyor.

**Tarayıcıda doğrulandı.** `e2e/section-assignment.spec.ts` fikstürünü kendi
kurup silen, iki oturumlu gerçek bir akış: koordinatör bölümü dağıtıyor →
katkıcı ankette yalnızca o bölümü görüyor (diğeri ekranda hiç yok) → soruyu
cevaplıyor → kendine atanmayan bölüme yazma denemesi **403** alıyor →
koordinatörün panosunda "1/3 soru" ve "Devam ediyor" beliriyor. `npm run
test:e2e` ile çalışır (çalışan bir veritabanı ister; yoksa test atlanır).

### 4. adımda ne yapıldı

Gönderim, kuruluşun "bu bizim cevabımız" dediği an. O çizgi çekilmeden puan
hep taslak kalıyor ve kimse ona dayanarak karar veremiyordu.

- `Assessment.status` ve `submittedAt` 1. adımda ileriyi düşünerek eklenmişti,
  şimdi kullanılıyor. Üzerine `submittedById` geldi (migration `000007`):
  "bu puanı kim kesinleştirdi" sorusuna tarih tek başına cevap vermiyor.
- **Kilit neyi kapatır:** cevap yazma ve görev dağılımı — ikisi de sunucuda
  403. Okuma, puan, öneriler ve yol haritası açık kalır; kilit
  "değerlendirme bitti" demek, "sistem kapandı" demek değil.
- **Puan taslak → kesin:** gönderimde `ScoreHistory`'ye
  `triggerType: 'SUBMISSION'` ile anlık görüntü düşer (mevcut kayıt deseniyle
  aynı). Panoda puanın altında artık "Taslak — değerlendirme gönderilmedi" ya
  da "Kesin puan · tarih" yazıyor.
- `lib/submission.ts` saf ve testli: `isLocked`, `submissionReadiness`
  (eksik bölümler en çok eksiği olandan sıralı) ve tek cümlelik özet.

İki karar, ikisi de bilinçli:

1. **Eksik varken gönderim engellenmiyor.** Bazı sorular kuruluş için
   gerçekten cevaplanamaz olabilir; %100 dayatmak insanları rastgele cevap
   girmeye iter ve puanı bozar. Bunun yerine ekran neyin eksik olduğunu
   sayarak söylüyor ("2 bölümde 5 soru boş"), listeliyor ve ikinci bir onay
   istiyor. Sorumluluk koordinatörde kalıyor.
2. **Geri alma koordinatörde.** Bir yazım hatası için sistem yöneticisi
   beklemek işi durdururdu. Geri alma geçmişi silmiyor: gönderim anındaki
   puan kaydı yerinde kalıyor, yeni gönderim yeni bir kayıt üretiyor. Bu
   yüzden ayrı bir "geri alındı" alanı da tutulmuyor.

E2E testi tam turu geçiyor: dağıt → doldur → eksik uyarısıyla gönder →
cevap 403 → dağıtım 403 → katkıcı kilidi görüyor → panoda "Kesin puan" →
geri al → cevap yeniden yazılabiliyor.

---

## Anket çoğaltma

Yönetim → Anket Yönetimi → her satırdaki **kopyala** simgesi. Bir sonraki
yılın ya da başka bir sektörün anketi öncekinin küçük farklarla tekrarı; 13
bölüm ve 71 soru elle yeniden yazılacak şey değil.

Kopyalanır: kategori → bölüm → alt seviye → soru, öneriler (yeni sorulara
bağlanmış hâlde), sektör kapsam kuralları, kıyas değerleri.

Kopyalanmaz — ve nedeni: **cevaplar/değerlendirmeler** (bunlar kuruluşun
verdiği cevaplar, anketin parçası değil), **kullanıcı atamaları** (gözden
geçirilmemiş anket kimsenin ekranında belirmemeli), **arşivlenmiş içerik**
(kullanıcı onları silmişti; kopyaya geri getirmek sessizce diriltmek olurdu).

Kopya **pasif** başlar. Aktif etmeden kimse göremez.

Her şey tek transaction içinde yapılıyor: yarım kalmış bir kopya, soruları
eksik ama kullanılabilir görünen bir anket demek olurdu ve bu fark edilmezdi.

---

## Açık kalan diğer başlıklar

### NACE listesi — resmî kaynakla karşılaştırıldı

Yapı doğruymuş: Rev. 2.1'in 22 bölümü (A–V), J/K ayrımı ve V = uluslararası
örgütler kayması yerinde. Şüphelenilen G bölümünde ise **gerçek bir hata**
çıktı: Rev. 2.1'de bölüm 45 (motorlu taşıt ticareti ve onarımı) kaldırılıp
toptan satışı 46'ya, perakende satışı 47'ye, onarımı 95'e taşınmış. Bizim
listede 46 ve 47 hâlâ "(motorlu taşıtlar hariç)" diyordu — Rev. 2 kalıntısı.
Üç başlık düzeltildi (46, 47, 95).

Tohumlayıcıda ayrıca bir tuzak vardı: alt bölümler **ada** göre eşleşiyordu,
yani bir başlık düzeltildiğinde eskisi silinmeden yenisi ikinci kayıt olarak
ekleniyordu. Artık **koda** göre eşleşiyor. Ayrışan başlıklar çalıştırma
sonunda listeleniyor; `--fix-names` resmî adı dayatıyor.

**NACE öncesi 20 NAICS sektörü hâlâ duruyordu** — sektör listesinde
"İmalat (Sanayi)" ile "[C] İmalat" yan yana görünüyordu. `--prune-naics` ile
silindi (kullanıcısı, kıyası veya kapsam kuralı olan sektöre dokunmaz; öyle
biri varsa listeler ve bırakır). Yerelde 42 → 22 sektör.

### Sektör kapsam matrisi — dolduruldu

`npm run seed:scope` (`scripts/seed-sector-scope.ts`) 56 kural yazıyor:
46 "çok önemli", 10 "az önemli". **Hiçbir bölüm kapsam dışı bırakılmadı** —
dijital olgunluk bölümlerinin hepsi her sektöre bir ölçüde hitap ediyor;
"hiç sorma" demek sektörü tanımayı gerektirir, ağırlık vermek sektörün neye
dayandığını bilmeyi yeter.

Ölçüt: sektörün işi doğrudan o yetkinliğe dayanıyorsa "çok önemli" (bankada
veri ve güvenlik, imalatta süreç ve entegrasyon), tipik işletmesi o yetkinlik
olmadan da çalışıyorsa "az önemli". Her kuralın gerekçesi betikte yazılı.

Bu bir **başlangıç**: betik kayıtlı kuralları ezmez (`--force` hariç) ve
Yönetim → Sektör Kapsamı ekranından her hücre değiştirilebilir. Amaç boş
matrisle başlamamaktı.

### `rescale-score-history.ts` — kaldırıldı

Üretimde de yerelde de dönüştürülecek kayıt yoktu (ön izleme ile doğrulandı)
ve eski ölçekte kayıt üreten kod yolu artık yok. Betiğin tek olası etkisi
ileride yanlışlıkla çalıştırılıp doğru değerleri sıkıştırmaktı; bu yüzden
silindi. Gerekirse git geçmişinden çıkar.
- **Migration'lar elle uygulanmıyor:** `railway.json` içindeki
  `preDeployCommand: npm run db:migrate` her dağıtımdan önce çalışıyor.
  `000006_section_assignments` bu yolla üretime geçti; `prisma migrate status`
  ile doğrulandı ("Database schema is up to date"). Yeni migration için
  yapılacak tek şey master'a göndermek.
- **(Çözüldü — teşhis yanlıştı.)** "Dev sunucusu ilk derlemede istek
  düşürüyor" diye not düşülen aralıklı e2e hatasının sebebi sunucu değilmiş:
  giriş formuna hidrasyon bitmeden tıklandığında form gönderilmiyor, adres
  yine de `/dashboard`'a dönüyor ve oturum kurulmadığı için sonraki bütün
  istekler 401 alıyordu — ekran da "liste alınamadı" diyordu. Test artık
  URL'e değil oturumun kendisine bakıyor; sayfa tazeleme sargısı kaldırıldı.
  Arka arkaya beş koşu temiz.
- **Not:** istemci tarafındaki tek seferlik tekrar deneme
  (`lib/retrying-fetch.ts`) bu hatayı çözmek için değil, geçici 5xx ve ağ
  kopmalarına karşı duruyor. Yalnızca GET, yalnızca 5xx/ağ hatası; POST
  tekrarlanmıyor.

---

## Faydalı komutlar

```bash
npm run dev                 # geliştirme sunucusu
npx tsc --noEmit            # tip kontrolü
npx vitest run              # birim testleri
npm run test:e2e            # tarayıcı testleri (veritabanı ister)
npx next build              # üretim derlemesi
npm run db:migrate          # migration uygula

npm run seed:demo           # demo anketi kur
npm run seed:sectors        # NACE sektörlerini kur
npm run seed:scope          # sektör kapsam matrisini kur
npm run ai:check-draft      # AI taslak üretimini sına
```

Üretim veritabanına bağlanmak için:

```bash
railway link --project fc6f8ff4-951c-425c-a57c-c844e7274a93 \
             --service donusum --environment production
railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" <komut>'
```

> Üretimdeki Postgres dışarı açık ve parolası bilinçli olarak değiştirilmedi.
