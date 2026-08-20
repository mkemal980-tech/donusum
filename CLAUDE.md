# ESG Akademi — Dönüşüm Platformu

## Dallanma kuralı (en yüksek öncelik)

Bu projede yapılan **hiçbir değişiklik `main`'e pushlanmaz.** Tüm tasarım
işi `design-principle` dalında ilerler. `main` yalnızca temiz temel
anlık görüntüsünü tutar.

- Çalışma dalı: `design-principle`
- `main` üzerinde commit/push yok, merge yok, force-push yok.
- Yeni bir iş kolu gerekirse `design-principle`'dan dallanılır.

## Tasarım bağlamı

- `PRODUCT.md` — kim, ne için, hangi ilkeler (impeccable register: `product`).
- `DESIGN.md` — koyu pano görsel sistemi: token'lar, tipografi, bileşen
  kuralları, refero sapmaları. Yeni ekran yazarken tek kaynak burasıdır.
- Kapsam: giriş sonrası tüm uygulama (login, signup, dashboard ve devamı).
  **Landing page (`app/page.tsx`, `app/landing.css`) kapsam dışıdır**,
  dokunulmaz.

## Kod yapısı

- Next.js 14 App Router, `nextjs_space/` altında.
- Tailwind + CSS değişkenleri (`app/globals.css`), shadcn/ui (`components/ui`).
- Prisma + NextAuth. Veritabanı komutları için `docs/DATABASE_GUIDELINES.md`.
