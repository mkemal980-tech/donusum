# Design

Görsel sistem: **iso2app tasarım dili.** ESG Akademi'nin üç ürünü (iso2app,
SC360, Dönüşüm Platformu) aynı ürün ailesi olarak görünür. Kanonik değerler
iso2app'in token dosyasındadır (iso2son deposu:
`client/src/design-system/tokens/tokens.css`); bu depo değişken ADLARINI
korur, DEĞERLERİNİ oradan alır. Uygulamadaki karşılığı
`nextjs_space/app/globals.css`; ikisi birlikte değiştirilir.

Kapsam: giriş sonrası tüm uygulama (login, signup, dashboard ve devamı).
Tanıtım sayfası (`app/page.tsx` + `app/landing.css`) bu sisteme bağlı
değildir.

## Theme

İki tema: **açık varsayılan, koyu seçenek.** Geçiş üst şeritteki düğmede ve
giriş ekranındaki seçicidedir; tercih cihazda saklanır (next-themes →
`<html data-theme="…">`). Açık tema iso2app `:root`, koyu tema iso2app `.dark`
değerleridir; ikisi aynı token adlarını kullanır.

Kabuk iki temada da aynıdır: koyu lacivert kenar çubuğu, kart rengindeki üst
şerit, açık gri zemin üstünde beyaz kartlar.

Tek kural: `base` renk **grafik/dolgu/ikon**, `-ink` varyantı **metin**,
`-solid` varyantı **üzerine metin yazılan dolgu**. Tuvale çizen grafikler
renkleri `readToken()` ile okur ve `useThemeVersion()` ile tema değişiminde
yeniden çizilir; `<canvas>` `var(--…)` anlamıyor.

## Color

Strateji: **Restrained.** Tek kromatik eylem rengi (turuncu) + soğuk gri-mavi
nötrler + üç durum rengi. Dekoratif renk yok.

### Tokens (açık / koyu)

| Token | Açık | Koyu | iso2app karşılığı · kullanım |
|---|---|---|---|
| `--canvas` | `#F6F8FB` | `#070D18` | color-bg-base · sayfa zemini |
| `--rail` | `#FFFFFF` | `#0D1726` | üst şerit, form alanı zemini |
| `--surface` | `#FFFFFF` | `#0D1726` | color-surface-card · kart |
| `--surface-2` | `#EEF2F7` | `#13223A` | color-bg-sunken · kart içi blok, tablo başlığı, hover |
| `--surface-3` | `#E6ECF3` | `#1A2C49` | color-bg-muted · seçili, bar izi |
| `--sidebar-bg` | `#0D1A2D` | `#060B14` | color-sidebar-bg · kenar çubuğu |
| `--line` | `#E1E8F0` | `#1D2F4A` | color-border-subtle · 1px kenar, ayırıcı |
| `--line-strong` | `#CDD8E4` | `#2A4063` | color-border-strong · input ve outline kontrol |
| `--ink` | `#0D1A2D` | `#EAF1FB` | color-text-primary |
| `--ink-2` | `#46586E` | `#A7B8D1` | color-text-secondary |
| `--ink-3` | `#586779` | `#8597B3` | yardımcı metin (bkz. sapmalar) |
| `--accent` | `#FA541C` | `#FF7A45` | brand-500 / accent-display · dolgu, veri, ikon, odak |
| `--accent-hover` | `#DC4512` | `#FF9F78` | brand-600 · hover |
| `--accent-solid` | `#FA541C` | `#FA541C` | birincil düğme zemini |
| `--on-accent` | `#FFFFFF` | `#1C1815` | birincil düğme metni |
| `--accent-ink` | `#B3380F` | `#FFB28F` | color-accent-text · metin olarak vurgu, bağlantı |
| `--accent-quiet` | turuncu %12 | turuncu %16 | seçili satır, ikon kutusu |
| `--focus-ring` | turuncu %34 | turuncu %45 | color-ring · form odağı |
| `--success` | `#166B45` | `#4FC98A` | success-700 / -500 |
| `--warning` | `#8A5A14` | `#E2A94F` | warning-700 / -500 |
| `--error` | `#922F2A` | `#EF8B7F` | danger-700 / -500 |

Durum renkleri kod tabanında metin olarak da yazıldığı için açık temada
base değerler iso2app'in -700 (AA) tonlarıdır; yumuşak zeminler (`-bg`) -50
tonlarıdır. Durum rozeti: metin `-ink`, zemin `-bg`, kenarlık yok.

Grafik serileri sırayla: `--series-1` turuncu, `--series-2` yeşil
(`#1F8A5B`), `--series-3` kehribar (`#B7791F`), `--series-4` lacivert-gri
(`#46586E`), `--series-5` (`#8A99AD`). Beşten fazla seri gerekiyorsa
gruplama yanlıştır.

Olgunluk basamakları (`--level-1…5`) marka turuncusunun tek renkli
rampasıdır: açık temada seviye arttıkça koyulaşır, koyu temada parlar.
Kırmızı-sarı-yeşil yok; seviyeyi etiket söyler.

### Renk kuralları

- Metin olarak vurgu her zaman `--accent-ink`'tir. Kod tabanında kalan
  `text-[var(--accent)]`, `text-accent`, `text-primary` ve
  `text-[var(--blue-main)]` sınıfları globals.css'teki "Metin olarak vurgu"
  kuralıyla `--accent-ink`'e döner; yeni kod doğrudan `--accent-ink` yazar.
- Pasif/disabled durum doygun renk almaz; `--ink-3` + %40–50 opaklık.
- Kırmızı ve yeşil aynı grafikte tek ayırt edici olarak kullanılmaz.
- Degrade yalnızca alan grafiğinin dolgusunda (accent %18 → %0). Butonda,
  kartta, metinde degrade yasak.

## Typography

Üç aile, iso2app ile aynı (`next/font/google`, `latin` + `latin-ext`;
latin-ext Türkçe ğ/ş/ı için zorunlu; dosyalar derlemede indirilip kendi
sunucumuzdan verilir):

- **IBM Plex Sans** — gövde, form, düğme (`--font-body`).
- **Space Grotesk 600** — h1–h6, KPI ve büyük sayılar (`--font-head`).
- **IBM Plex Mono** — üst etiket, tablo sütun başlığı, kenar çubuğu bölüm
  etiketi, kod (`--font-mono`).

Başlıklar **cümle düzeninde** yazılır ("Tedarikçi portföyü", "Tedarikçi
Portföyü" değil). Sayılar için `font-variant-numeric: tabular-nums`.

| Rol | Boyut | Aile / ağırlık | Satır | Tracking |
|---|---|---|---|---|
| `display` (h1) | 32px | Space Grotesk 600 | 1.1 | -0.03em |
| `title` (h2) | 22px | Space Grotesk 600 | 1.25 | -0.022em |
| `subhead` (h3) | 18px | Space Grotesk 600 | 1.3 | -0.022em |
| `body` | 15px | Plex Sans 400 | 1.55 | 0 |
| `body-sm` | 13px | Plex Sans 400 | 1.5 | 0 |
| `label` | 13px | Plex Sans 500 | 1.4 | 0 |
| `caption` | 11.5px | Plex Mono 500, büyük harf | 1.4 | 0.08em |
| `eyebrow` | 11.5px | Plex Mono 500, büyük harf, `--accent-ink` | 1.4 | 0.12em |
| `metric` | 26px | Space Grotesk 600 | 1.1 | -0.02em, tabular |
| `metric-lg` | 34px | Space Grotesk 600 | 1.05 | -0.03em, tabular |

- Gövde metnine letter-spacing uygulanmaz.
- Düz metin satır uzunluğu 65–75ch; tablo ve veri bundan muaf.

## Spacing & Layout

4px tabanlı ölçek: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

| Öğe | Değer |
|---|---|
| Kenar çubuğu genişliği | 288px (daraltılmış 72px) |
| Üst şerit yüksekliği | 64px |
| Sayfa iç boşluğu | 24px (≥1440px: 32px) |
| Kart iç boşluğu | 20px (geniş kartlar 24px) |
| Grid oluk | 16–20px |
| Blok arası | 24px |

İçerik akışkan genişlikte; çok geniş ekranda 1680px'te durur.

## Elevation

iso2app elevation: kart `0 1px 3px rgba(13,26,45,.08)` (`--shadow-sm`) +
1px `--line` kenarlık. Açılır menü, popover ve modal `--shadow-md` /
`--shadow-lg`. Cam efekti (backdrop-blur), parlama (glow), renkli gölge
yasak.

## Radius

| Token | Değer | Kullanım |
|---|---|---|
| `--radius-xs` / `--radius-sm` | 9px | input, select, chip, ikon kutusu, menü satırı |
| `--radius-md` | 10px | düğme |
| `--radius-lg` | 14px | kart, panel, modal |
| `--radius-xl` | 18px | öne çıkan KPI kartı |
| `--radius-pill` | 999px | rozet, avatar |

Tailwind `rounded-xl` / `-2xl` / `-3xl` kart yarıçapına (14px) iner.

## Components

Her etkileşimli bileşen yedi durumu taşır: default, hover, focus-visible,
active, disabled, loading, error.

- **Button / primary**: `--accent-solid` zemin, `--on-accent` metin, 10px
  radius, 15px/500. Hover `--accent-hover`, basılı `--accent-press`.
- **Button / outline**: `--surface` zemin, 1px `--line-strong`, `--ink`
  metin. Eşdeğer iki eylemde birincil düğmenin yanında durur; tek işi olan
  ekranda ikinci yol bağlantı olarak altta kalır.
- **Button / ghost**: zeminsiz, `--ink-2` metin, hover'da `--surface-2`.
- **Input / select / textarea**: `--rail` zemin, 1px `--line-strong`
  (`#CDD8E4`), 9px radius, 10px×12px. Focus: kenarlık `--accent` + 3px
  `--focus-ring`.
- **Card**: `--surface`, 1px `--line`, 14px radius, `--shadow-sm`. Başlık
  `subhead`. İç içe kart yasak — iç blok `--surface-2` zeminli, kenarlıksız.
- **Kenar çubuğu**: `--sidebar-bg` zemin. Üstte marka bloğu (turuncu işaret,
  Space Grotesk sözcük markası, altında mono bağlam etiketi), 64px, alt
  çizgiyle üst şeritle hizalı. Bölüm etiketleri 10.5px mono büyük harf,
  beyaz %62. Satır 36px, 9px radius, 13.5px/500, beyaz %78; hover beyaz %7
  zemin; aktif satır turuncu %18 zemin, beyaz metin, turuncu ikon (`#FF7A45`).
- **Üst şerit**: 64px, `--surface` zemin, alt 1px `--line`. Solda sayfa
  araması (⌘K), sağda tema düğmesi ve kullanıcı menüsü.
- **Metric card**: etiket (`label`, `--ink-2`), değer (`metric`, Space
  Grotesk), altta karşılaştırma satırı (`body-sm`, `--ink-3`).
- **Table**: başlık satırı `--surface-2` zemin, `caption` (mono) `--ink-2`;
  satır ayırıcı 1px `--line`; hover `--surface-2`; sayısal sütunlar sağa
  dayalı ve tabular.
- **Chart**: ızgara `--line`, eksen metni `--ink-3` 12px, tooltip
  `--surface-2` zemin + 1px `--line` + 10px radius.
- **Skeleton**: `--surface-2` blok, 1.4s nabız. İçerik ortasında spinner yok.
- **Empty state**: tek cümle ne olduğu + tek birincil eylem. İllüstrasyon yok.

## Motion

- Süre 150–200ms; grafik girişleri 260ms.
- Eğri `cubic-bezier(0.25, 1, 0.5, 1)` (ease-out-quart). Zıplama/elastik yok.
- Sadece `opacity`, `transform`, `background-color`, `border-color`, `color`
  animasyonlanır. Layout özelliği animasyonlanmaz.
- `prefers-reduced-motion: reduce` tüm süreleri 0.01ms yapar.

## PDF raporu

Panonun PDF çıktısı açık zeminlidir: rapor yazdırılıp yönetim kuruluna
dağıtılıyor. Rapor sunucuda, panonun gösterdiği veriden üretilir
(`nextjs_space/lib/unit-dashboard-report.ts`); renkleri orada sabit yazılıdır
ve henüz önceki mavi vurguyu taşır; iso2app turuncusuna geçişi sabit renk
temizliği adımında yapılacaktır.

## iso2app'ten bilinçli sapmalar

| Konu | iso2app | Burada | Neden |
|---|---|---|---|
| Yardımcı metin | `#7E8EA3` | `#586779` (koyu: `#8597B3`) | iso2app tonu beyazda 3.2:1; bu depoda yardımcı metin `--surface-2` üzerinde de AA (≥4.5:1) geçmek zorunda. |
| Durum renkleri | dolgu -500, metin -700 | base = -700 | Kod tabanında `text-[var(--error)]` gibi ~100 metin kullanımı var; base değer metin olarak AA geçsin diye. |
| Olgunluk metin rampası | yok | `--maturity-1…5`, hepsi beyazda ≥5.8:1 | Seviye etiketi metin olarak çizilir. |
| Birincil düğme | turuncu + beyaz metin | aynı | Ürün ailesi tutarlılığı için iso2app ile aynı tutuldu. Beyaz metin `#FA541C` üzerinde 3.3:1'dir; WCAG AA gövde metni eşiğinin (4.5:1) altında kalan bilinen açık. Koyu temada metin `#1C1815` (5.2:1). |
