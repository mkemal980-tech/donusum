"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import AppShell from "@/components/ui/app-shell";
import EmptyState from "@/components/ui/empty-state";
import { rolesForAdminPath } from "@/components/ui/admin-nav";

/**
 * Yönetim paneli, uygulamanın kabuğunu paylaşır.
 *
 * Panelin eskiden kendi başlığı ve kendi sidebar'ı vardı; uygulama kabuğuyla
 * birlikte ekranda iki menü, iki başlık çıkıyordu. Menü tanımı artık
 * `components/ui/admin-nav.ts` içinde, çizimi kabukta: /admin altındayken
 * sidebar yönetim başlıklarını gösterir, en üstte panoya dönüş bağlantısı olur.
 *
 * Yetki kontrolü de burada. Menü rolü süzüyordu ama sayfanın kendisinde kontrol
 * yoktu: adresi elle yazan bir birim yöneticisi yalnızca yöneticiye açık bir
 * ekranı açabiliyor, içerideki istekler 403 dönüyor ve sayfa hata nesnesini
 * diziymiş gibi kullanınca çöküyordu. Sunucu tarafı zaten korunuyordu; eksik
 * olan kullanıcıya doğru şeyi söylemekti.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession() || {};
  const role = (session?.user as { role?: string })?.role;
  const allowedRoles = rolesForAdminPath(pathname ?? "");

  // Oturum çözülmeden karar verilmez; aksi hâlde yetkili kullanıcıya bir an
  // "yetkiniz yok" görünüyordu.
  const unauthorized =
    status === "authenticated" && Boolean(allowedRoles) && !allowedRoles!.includes(role ?? "");

  return (
    <>
      <AppShell />
      <main id="icerik" tabIndex={-1}>
        {unauthorized ? (
          <EmptyState
            title="Bu ekran platform yöneticisine özel"
            description="Yetkiniz bu bölümü kapsamıyor. Sol menüden erişebileceğiniz ekranlara dönebilirsiniz."
          />
        ) : (
          children
        )}
      </main>
    </>
  );
}
