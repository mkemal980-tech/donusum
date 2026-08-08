# Kaldığımız yer

Bu dosya, yeni bir oturuma başlarken bağlamı hızlıca kurmak için tutulur.
Bir adım bitince buradaki durumu güncelleyin.

**Son güncelleme:** 2026-08-08

---

## Devam eden iş: çok kullanıcılı değerlendirme

Büyük bir şirkette anketin farklı bölümlerini farklı departmanlar doldurur
(atık → çevre, enerji → teknik, sosyal → İK) ve ortaya **tek bir kurumsal
puan** çıkması gerekir.

Dört adımlı plan:

| # | Adım | Durum |
|---|---|---|
| 1 | `Assessment` nesnesi — cevap/yol haritası/puan geçmişi sahipliği kişiden kuruluşa | ✅ **bitti** (`1574813`) |
| 2 | Bölüm bazlı görev dağılımı + ankette filtreleme | ⬜ sıradaki |
| 3 | Koordinatör panosu (kim ne kadar doldurdu) | ⬜ |
| 4 | Gönderim / kilit adımı (puan taslak → kesin) | ⬜ |

### 1. adımda ne yapıldı

- `Assessment = (kuruluş, anket)`; `lib/assessment.ts` içindeki
  `getOrCreateAssessment` / `getAssessmentIds` çözücüleri.
- Kuruluş olarak mevcut **`Unit`** modeli kullanıldı (boştu ama üyeler,
  yöneticiler ve hiyerarşi zaten içindeydi).
- Kuruluşu olmayan kullanıcı → tek kişilik değerlendirme; davranış eskisiyle
  aynı. Bu sayede puanlama fonksiyonlarının imzaları hâlâ `userId` alıyor.
- Doğrulandı: aynı birimdeki iki kullanıcının girdiği cevaplar tek puanda
  toplanıyor ve ikisi de aynı kurumsal puanı görüyor.

### 1. adımdan kalan iki eksik

1. **Arayüz etiketleri güncellenmedi.** Yönetici panosu, birim yöneticisi
   takım tablosu ve benzeri ekranlarda satırlar artık *değerlendirme* ama
   başlıklar hâlâ "kullanıcı" diyor. Mantık doğru, etiket yanlış.
2. **Tarayıcıda uçtan uca denenmedi.** Veri katmanı script ile doğrulandı;
   gerçek akış (anket doldur → puan gör → öneri al) ekrandan geçirilmedi.

### 2. adım için kararlaştırılanlar

- Görev dağılımı **bölüm (alt kategori) düzeyinde** olacak — kategori çok
  kaba, soru çok ince.
- **Bir bölüm tek kişiye** atanır; iki kişi aynı bölümü cevaplayamaz
  (çatışma çözümü diye bir başlık açılmasın diye).
- Roller: *Koordinatör* (`UnitAdmin`) görev dağıtır ve gönderir;
  *Katkıcı* yalnızca kendine atanan bölümleri görür.
- Kuruluşu olmayan kullanıcıda tüm bölümler ona atanmış sayılır.

---

## Açık kalan diğer başlıklar

- **NACE alt bölüm adları** `scripts/seed-nace.ts` içinde elle yazıldı;
  özellikle G bölümü ve J/K ayrımında resmî başlıklarla karşılaştırılmalı.
  Yönetim → Sektörler ekranından düzeltilebilir, tohumlayıcı üzerine yazmaz.
- **Sektör kapsam matrisi** (Yönetim → Sektör Kapsamı) kurulu ama hiç kural
  girilmemiş; hepsi varsayılan "Orta".
- **`rescale-score-history.ts`** yazıldı ama üretimde çalıştırılmadı
  (geçmiş puan kaydı yok, şimdilik gereksiz).

---

## Faydalı komutlar

```bash
npm run dev                 # geliştirme sunucusu
npx tsc --noEmit            # tip kontrolü
npx vitest run              # testler
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
