# Design

Görsel sistem: koyu analitik pano. Kaynaklar (a) kullanıcının verdiği koyu
dashboard referans görseli — kompozisyon ve atmosferde son söz onda; (b)
refero "Square" stil sistemi — yalnızca görselle çelişmeyen kuralları alındı.
Çelişen refero kuralları ve gerekçeleri en altta "Refero sapmaları" başlığında.

## Theme

Tek tema: **koyu**. Açık tema yok.

Sahne cümlesi: sürdürülebilirlik yöneticisi, kapalı bir toplantı odasında,
projeksiyonun kısılmış ışığında, 27 inç ekranda yönetime puan sunuyor; ekran
saatlerce açık kalıyor ve yanındaki grafikler ortamdan daha parlak olmamalı.

Koyu zemin burada estetik tercih değil: veri mürekkebi (grafik çizgileri,
sayılar, durum renkleri) tek parlak katman olsun diye arayüz kendini geri
çekiyor.

## Color

Strateji: **Restrained**. Tek kromatik eylem rengi (mavi) + veri serisi için
sınırlı ikinci renk (yeşil) + üç durum rengi. Dekoratif renk yok.

Nötrler mavi tona (hue 264) doğru boyanmış; saf siyah/beyaz yasak.

### Tokens

| Token | OKLCH | ~Hex | Kullanım |
|---|---|---|---|
| `--canvas` | `oklch(0.185 0.012 264)` | #15171E | Sayfa zemini |
| `--rail` | `oklch(0.155 0.012 264)` | #111319 | Sidebar, topbar |
| `--surface` | `oklch(0.235 0.013 264)` | #1E212A | Kart yüzeyi |
| `--surface-2` | `oklch(0.275 0.014 264)` | #262934 | Kart içi ikincil blok, tablo başlığı, hover |
| `--line` | `oklch(0.315 0.013 264)` | #2E313D | 1px kenarlık, ayırıcı |
| `--line-strong` | `oklch(0.40 0.014 264)` | #3F4350 | Vurgulu ayırıcı, input kenarı |
| `--ink` | `oklch(0.97 0.004 264)` | #F4F5F8 | Birincil metin, sayı |
| `--ink-2` | `oklch(0.76 0.012 264)` | #B3B7C4 | İkincil metin, etiket |
| `--ink-3` | `oklch(0.60 0.014 264)` | #83889A | Üçüncül, eksen etiketi, pasif ikon |
| `--accent` | `oklch(0.635 0.191 258)` | #2E86FF | Birincil eylem, aktif nav, link, 1. veri serisi |
| `--accent-hover` | `oklch(0.685 0.181 258)` | #4E9AFF | Hover |
| `--accent-quiet` | `oklch(0.635 0.191 258 / 0.14)` | — | Seçili satır, aktif nav zemini, ikon kutusu |
| `--on-accent` | `oklch(0.99 0 0)` | #FDFDFD | Mavi üstü metin |
| `--series-2` | `oklch(0.745 0.148 165)` | #27C08A | 2. veri serisi, "tamamlandı" |
| `--warning` | `oklch(0.785 0.135 70)` | #F0A93C | Uyarı, "beklemede" |
| `--danger` | `oklch(0.665 0.168 22)` | #F0645F | Hata, negatif değişim, "reddedildi" |
| `--info` | `--accent` | — | Bilgi durumu ayrı renk almaz |

Durum rozetleri: metin durum rengi, zemin aynı rengin %14 alfası, kenarlık yok.

Grafik serileri sırayla: `--accent`, `--series-2`, `--warning`, `--ink-3`,
`oklch(0.60 0.13 300)`. Beşten fazla seri gerekiyorsa gruplama yanlıştır.

### Renk kuralları

- Pasif/disabled durum doygun renk almaz; `--ink-3` + %40 opaklık.
- Kırmızı ve yeşil aynı grafikte tek ayırt edici olarak kullanılmaz.
- Degrade yalnızca alan grafiğinin dolgusunda (accent %22 → %0). Butonda,
  kartta, metinde degrade yasak.

## Typography

Tek aile: **Inter** (`next/font/google`, subsets `latin` + `latin-ext`;
latin-ext Türkçe ğ/ş/ı için zorunlu). Fallback:
`system-ui, -apple-system, "Segoe UI", sans-serif`.

Sayılar için `font-variant-numeric: tabular-nums` — sütun halinde değişen
metrikler zıplamasın.

Ölçek: 15px taban, 1.2 (minor third), sabit rem, akışkan clamp yok.

| Rol | Boyut | Ağırlık | Satır | Tracking |
|---|---|---|---|---|
| `display` | 31px | 600 | 1.15 | -0.02em |
| `title` | 22px | 600 | 1.25 | -0.015em |
| `subhead` | 18px | 600 | 1.3 | -0.01em |
| `body` | 15px | 400 | 1.5 | 0 |
| `body-sm` | 13px | 400 | 1.5 | 0 |
| `label` | 13px | 500 | 1.4 | 0 |
| `caption` | 12px | 500 | 1.4 | 0.02em |
| `metric` | 26px | 600 | 1.1 | -0.02em, tabular |
| `metric-lg` | 34px | 600 | 1.05 | -0.025em, tabular |

- Gövde metnine letter-spacing uygulanmaz (refero kuralı).
- Tablo/sütun başlığı: `caption`, `--ink-3`, büyük harf.
- Düz metin satır uzunluğu 65–75ch; tablo ve veri bundan muaf.

## Spacing & Layout

4px tabanlı ölçek: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

| Öğe | Değer |
|---|---|
| Sidebar genişliği | 248px (daraltılmış 72px) |
| Topbar yüksekliği | 64px |
| Sayfa iç boşluğu | 24px (≥1440px: 32px) |
| Kart iç boşluğu | 20px (geniş kartlar 24px) |
| Grid oluk | 20px |
| Blok arası | 24px |
| Bölüm arası | 40px |

Izgara: 12 sütun, akışkan genişlik. İçerik `max-width` ile daraltılmaz —
pano yoğunluk ister (refero'nun 1200px limiti pano için geçersiz).

Ritim: her kart aynı boşluğu almaz. Ana cevap kartı 24px, yardımcı metrik
kartları 20px, liste satırı 12px dikey.

## Elevation

Gölge yok. Yüzeyler kontrastla ayrışır: `--surface` üzerinde `--canvas`,
1px `--line` kenarlık. Tek istisna: dolu birincil buton
`0 1px 4px rgba(0,0,0,0.16)`.

Cam efekti (backdrop-blur), parlama (glow), renkli gölge yasak.

## Radius

Dört token, başkası yok: **6px** (input, chip, ikon kutusu), **8px** (buton),
**12px** (kart, panel), **999px** (pill rozet, avatar).

## Components

Her etkileşimli bileşen yedi durumu taşır: default, hover, focus-visible,
active, disabled, loading, error.

- **Button / primary**: `--accent` zemin, `--on-accent` metin, 8px radius,
  10px×16px padding, 15px/500. Hover `--accent-hover`. Focus: 2px
  `--accent` halka + 2px offset.
- **Button / ghost**: şeffaf zemin, 1px `--line-strong` kenarlık, `--ink`
  metin, aynı ölçüler. Refero'nun "her dolu butonun yanında ghost eşi"
  kuralı, iki eylemin gerçekten eşdeğer olduğu yerlerde geçerlidir
  (kaydet/vazgeç, onayla/geri dön). Tek işi olan ekranda ikinci bir buton
  birincil eylemle yarışır: giriş formunda kayıt yolu bağlantı olarak altta
  durur, buton olarak değil.
- **Button / quiet**: zeminsiz, `--ink-2` metin, hover'da `--surface-2`.
- **Input / select**: `--rail` zemin, 1px `--line-strong`, 6px radius,
  10px×12px, placeholder `--ink-3`. Focus: kenarlık `--accent` + 2px halka.
- **Card**: `--surface`, 1px `--line`, 12px radius, gölgesiz. Başlık
  `subhead`, sağ üstte isteğe bağlı eylem. **İç içe kart yasak** — iç blok
  gerekiyorsa `--surface-2` zeminli, kenarlıksız, 8px radius.
- **Sidebar nav**: gruplar büyük harf `caption` `--ink-3` başlıkla ayrılır
  (MAIN / HELP). Aktif öğe: `--accent-quiet` zemin, `--ink` metin, solda
  3px `--accent` göstergesi (bu göstergenin tek meşru kullanımı burasıdır;
  kart ve uyarılarda yan şerit yasaktır). Pasif öğe `--ink-2`, hover
  `--surface-2`.
- **Topbar**: solda arama (ikon + input), sağda bildirim (nokta rozetli),
  avatar + ad + rol.
- **Metric card**: etiket (`label`, `--ink-2`), değer (`metric`, `--ink`),
  değişim rozeti (`caption`, yön oku + durum rengi), altta karşılaştırma
  satırı (`body-sm`, `--ink-3`). Dört adet yan yana; dekoratif ikon yok.
- **Table**: başlık satırı `--surface-2` zemin, `caption` `--ink-3`; satır
  ayırıcı 1px `--line`; hover `--surface-2`; sayısal sütunlar sağa dayalı
  ve tabular.
- **Chart**: ızgara `--line` %60, eksen metni `--ink-3` 12px, tooltip
  `--surface-2` zemin + 1px `--line` + 8px radius, seri noktası 4px.
  Efsane (legend) grafiğin sağ üstünde, 8px nokta + `body-sm`.
- **Skeleton**: `--surface-2` blok, 1.4s nabız. İçerik ortasında spinner yok.
- **Empty state**: tek cümle ne olduğu + tek birincil eylem. İllüstrasyon yok.

## Motion

- Süre 150–200ms; grafik girişleri 260ms.
- Eğri `cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart). Zıplama/elastik yok.
- Sadece `opacity`, `transform`, `background-color`, `border-color`, `color`
  animasyonlanır. Layout özelliği animasyonlanmaz.
- Sayfa yüklenirken sıralı/kademeli giriş koreografisi yok.
- `prefers-reduced-motion: reduce` tüm süreleri 0.01ms yapar.

## PDF raporu

Panonun PDF çıktısı **açık zeminlidir** ve bilinçli bir sapmadır: rapor
yazdırılıp yönetim kuruluna dağıtılıyor, koyu zemin hem mürekkep yiyor hem
kâğıtta okunmuyor. Kimlik renkle taşınır — başlık bandı `#15171E`, vurgu
`#1E6FE8`, olgunluk rozetleri ekrandakiyle aynı tek renkli mavi rampadır.
Kırmızı-sarı-yeşil ilerleme çubukları kaldırıldı; seviyeyi rozet söylüyor.

## Refero sapmaları

Alınan kurallar: sınırlı radius token seti; kart ve panellerde gölge yasağı,
tek gölge dolu butonda; yüzey kontrastıyla ayrışma; minor-third tipografi
ölçeği ve başlıklarda negatif tracking; gövde metnine letter-spacing yok;
her dolu butonun ghost eşi; sabit kart iç boşluğu.

Reddedilen kurallar ve gerekçeleri:

| Refero kuralı | Neden alınmadı |
|---|---|
| Açık palet (Cloud/Paper zemin, Carbon metin) | Referans görsel koyu; tema kararı koyu. |
| "Signal Blue tek kromatik renk", "semantik yeşil/kırmızı kullanma" | Görselde iki veri serisi ve durum renkleri var; pano semantik renk olmadan okunmaz. Mavi yine tek *eylem* rengi olarak kaldı. |
| Radius seti 4/20/24/32 | Görselin kart köşeleri belirgin biçimde daha yumuşak; 6/8/12/999 setine geçildi, "sınırlı set" ilkesi korundu. |
| Display başlıklarda 400 ağırlık, 600–700 yasak | Görselde metrik ve başlıklar yarı kalın; pano hiyerarşisi ağırlık kontrastıyla kuruluyor. Negatif tracking kuralı korundu. |
| 1200px sayfa genişliği, 96px bölüm aralığı | Pazarlama sayfası ölçüleri; pano akışkan genişlik ve daha sıkı ritim ister. |
| Square Sans / Cash Sans aileleri | Lisanslı değil; Inter ile karşılandı. |
