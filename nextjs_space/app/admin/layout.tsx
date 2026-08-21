"use client";

import AppShell from "@/components/ui/app-shell";

/**
 * Yönetim paneli, uygulamanın kabuğunu paylaşır.
 *
 * Panelin eskiden kendi başlığı ve kendi sidebar'ı vardı; uygulama kabuğuyla
 * birlikte ekranda iki menü, iki başlık çıkıyordu. Menü tanımı artık
 * `components/ui/admin-nav.ts` içinde, çizimi kabukta: /admin altındayken
 * sidebar yönetim başlıklarını gösterir, en üstte panoya dönüş bağlantısı olur.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell />
      <main>{children}</main>
    </>
  );
}
