"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/ui/app-shell";
import AssessmentDashboard from "@/components/assessment-dashboard";
import DashboardClient from "./dashboard-client";

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

export default function DashboardHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Oturum çözülmeden kişisel anket isteği başlatılmaz. Yöneticinin
  // sonuçları, anket atamasından ve kendi birim üyeliğinden bağımsızdır.
  if (status !== "authenticated") return <DashboardLoading />;

  if (role === "UNIT_MANAGER" && searchParams.get("view") !== "assessment") {
    return <AssessmentDashboard title="Birim panosu" />;
  }

  const unitParams = new URLSearchParams(searchParams.toString());
  unitParams.delete("view");
  return <DashboardClient showUnitDashboardLink={role === "UNIT_MANAGER"} unitDashboardHref={"/dashboard" + (unitParams.toString() ? "?" + unitParams.toString() : "")} />;
}
