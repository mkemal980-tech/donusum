"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/ui/app-shell";
import AssessmentDashboard from "@/components/assessment-dashboard";

export function DashboardLoading() {
  return (
    <>
      <AppShell />
      <main id="icerik" tabIndex={-1} aria-busy="true">
        <span className="sr-only" aria-live="polite">Pano yükleniyor</span>
        <div className="skeleton mb-6 h-8 w-72" />
        <div className="skeleton h-[320px]" />
      </main>
    </>
  );
}

/**
 * Tek pano: herkes aynı değerlendirmeyi aynı sayılarla görür. Yönetici
 * yönettiği birimleri, çalışan kendi birimini, birimi olmayan kullanıcı
 * kendi değerlendirmesini açar (bkz. lib/assessment-view).
 */
export default function DashboardHome() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated") return <DashboardLoading />;
  return <AssessmentDashboard />;
}
