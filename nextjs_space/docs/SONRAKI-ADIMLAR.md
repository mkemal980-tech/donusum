# Kaldığımız yer

Bu dosya, yeni bir oturuma başlarken bağlamı hızlıca kurmak için tutulur.
Bir adım bitince buradaki durumu güncelleyin.

**Son güncelleme:** 2026-08-08 (2. adım)

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
| 4 | Gönderim / kilit adımı (puan taslak → kesin) | ⬜ sıradaki |

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

### 2. adımdan kalan

- **Bildirim yok.** Bölüm atanan kişiye e-posta gitmiyor; koordinatörün
  haber vermesi gerekiyor.

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

---

## Açık kalan diğer başlıklar

- **NACE alt bölüm adları** `scripts/seed-nace.ts` içinde elle yazıldı;
  özellikle G bölümü ve J/K ayrımında resmî başlıklarla karşılaştırılmalı.
  Yönetim → Sektörler ekranından düzeltilebilir, tohumlayıcı üzerine yazmaz.
- **Sektör kapsam matrisi** (Yönetim → Sektör Kapsamı) kurulu ama hiç kural
  girilmemiş; hepsi varsayılan "Orta".
- **`rescale-score-history.ts`** yazıldı ama üretimde çalıştırılmadı
  (geçmiş puan kaydı yok, şimdilik gereksiz).
- **Migration'lar elle uygulanmıyor:** `railway.json` içindeki
  `preDeployCommand: npm run db:migrate` her dağıtımdan önce çalışıyor.
  `000006_section_assignments` bu yolla üretime geçti; `prisma migrate status`
  ile doğrulandı ("Database schema is up to date"). Yeni migration için
  yapılacak tek şey master'a göndermek.
- **Dev sunucusu ilk derlemede istek düşürüyor.** Bir rota ilk kez derlenirken
  tek tük istek hata dönüyor ve ekran "liste alınamadı" diyor. E2E testinde
  sayfayı tazeleyerek aşıldı (`openUntilVisible`). Üretim derlemesinde
  görülmedi; yine de istemci tarafında bir kez otomatik tekrar denemeye
  değebilir.

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
npm run ai:check-draft      # AI taslak üretimini sına
```

Üretim veritabanına bağlanmak için:

```bash
railway link --project fc6f8ff4-951c-425c-a57c-c844e7274a93 \
             --service donusum --environment production
railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" <komut>'
```

> Üretimdeki Postgres dışarı açık ve parolası bilinçli olarak değiştirilmedi.
