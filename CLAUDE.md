# ESG Akademi — Dönüşüm Platformu

## Dallanma kuralı

Varsayılan dal `master`. (`main` diye bir dal hiç olmadı — bu bölümün eski
hali onu koruyormuş gibi yazılmıştı.)

- İş, `master`'dan açılan konu dallarında ilerler; doğrudan `master`'a
  commit'lenmez.
- Dal `master`'a alınırken tercih edilen yol PR'dır (bkz. #1, #2). Sahibi
  açıkça isterse doğrudan fast-forward merge de yapılabilir.
- `master`'a force-push yok.
- Tasarım işinin uzun soluklu dalı `design-principle`'dır; landing gibi
  ayrı iş kolları kendi dalını alır (örn. `landing-xai`).

## Tasarım bağlamı

- `PRODUCT.md` — kim, ne için, hangi ilkeler (impeccable register: `product`).
- `DESIGN.md` — koyu pano görsel sistemi: token'lar, tipografi, bileşen
  kuralları, refero sapmaları. Yeni ekran yazarken tek kaynak burasıdır.
- `DESIGN.md` kapsamı: giriş sonrası tüm uygulama (login, signup, dashboard
  ve devamı).
- **Landing page'in kendi görsel dili vardır** ve `DESIGN.md`'ye bağlı
  değildir: monokrom, düz yüzeyli, siyah zemin/beyaz metin, Inter, 1px
  hairline ayraçlar. Tek kaynağı `app/landing.css`'in başındaki nottur.
  Kapsamı `app/page.tsx` + `app/landing.css` ile sınırlıdır.
- İki sistem bilinçli olarak ayrıdır. Landing, uygulamanın tema token'larını
  kullanmaz; uygulama da `.esg-landing` altındaki kurallardan etkilenmez.
  Landing'de paylaşılan bir bileşene ihtiyaç olursa `components/ui`
  değiştirilmez, landing'e özel bir kopya açılır.

## Kod yapısı

- Next.js 14 App Router, `nextjs_space/` altında.
- Tailwind + CSS değişkenleri (`app/globals.css`), shadcn/ui (`components/ui`).
- Prisma + NextAuth. Veritabanı komutları için `docs/DATABASE_GUIDELINES.md`.
