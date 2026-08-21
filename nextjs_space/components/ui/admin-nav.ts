"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  BarChart3,
  Building2,
  Download,
  Factory,
  FileText,
  Files,
  FolderTree,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  Scale,
  UserCheck,
  Users,
} from "lucide-react";

/**
 * Yönetim panelinin menüsü.
 *
 * Eskiden `app/admin/layout.tsx` içinde kendi sidebar'ını çiziyordu; uygulama
 * kabuğu gelince ekranda iki menü birden duruyordu. Menü tanımı artık burada,
 * çizimi tek yerden — `app-shell.tsx` — yapılıyor.
 */
export type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: string;
  roles: string[];
  /** Birim yöneticisi bunu ancak biriminde cevap varsa görür. */
  requiresUnitResponses?: boolean;
};

const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Genel bakış", icon: LayoutDashboard, section: "Yönetim", roles: ["ADMIN", "UNIT_MANAGER"] },
  { href: "/admin/dashboard", label: "Sistem panosu", icon: BarChart3, section: "Yönetim", roles: ["ADMIN"], requiresUnitResponses: true },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users, section: "Kullanıcı", roles: ["ADMIN"] },
  { href: "/admin/units", label: "Birimler", icon: Building2, section: "Kullanıcı", roles: ["ADMIN"] },
  { href: "/admin/surveys", label: "Anketler", icon: FileText, section: "Anket", roles: ["ADMIN"] },
  { href: "/admin/survey-assignments", label: "Atamalar", icon: UserCheck, section: "Anket", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "Kategori ve sorular", icon: FolderTree, section: "Anket", roles: ["ADMIN"] },
  { href: "/admin/recommendations", label: "Öneriler", icon: Lightbulb, section: "Anket", roles: ["ADMIN"] },
  { href: "/admin/documents", label: "Yüklenen dosyalar", icon: Files, section: "Anket", roles: ["ADMIN"] },
  { href: "/admin/sectors", label: "Sektörler", icon: Factory, section: "Sektör", roles: ["ADMIN"] },
  { href: "/admin/benchmarks", label: "Benchmark verileri", icon: BarChart3, section: "Sektör", roles: ["ADMIN"] },
  { href: "/admin/sector-weights", label: "Sektör kapsamı", icon: Scale, section: "Sektör", roles: ["ADMIN"] },
  { href: "/admin/ironman-benchmarks", label: "Ironman benchmark", icon: Activity, section: "Sektör", roles: ["ADMIN"] },
  { href: "/admin/export", label: "Dışa aktarma", icon: Download, section: "Diğer", roles: ["ADMIN"] },
  { href: "/admin/monitoring", label: "Sistem izleme", icon: Gauge, section: "Diğer", roles: ["ADMIN"] },
];

const SECTION_ORDER = ["Yönetim", "Kullanıcı", "Anket", "Sektör", "Diğer"];

export function useAdminNavGroups() {
  const { data: session } = useSession() || {};
  const role = (session?.user as { role?: string })?.role || "USER";
  const [unitHasResponses, setUnitHasResponses] = useState(false);

  useEffect(() => {
    if (role !== "UNIT_MANAGER") return;
    fetch("/api/admin/dashboard/unit-check")
      .then((res) => res.json())
      .then((data) => setUnitHasResponses(Boolean(data.hasResponses)))
      .catch(() => setUnitHasResponses(false));
  }, [role]);

  const items = ADMIN_NAV.filter((item) => {
    if (item.roles.includes(role)) return true;
    // Birim yöneticisi, biriminde cevap varsa sistem panosunu da görür.
    return Boolean(item.requiresUnitResponses && role === "UNIT_MANAGER" && unitHasResponses);
  });

  return SECTION_ORDER.map((title) => ({
    title,
    items: items.filter((item) => item.section === title),
  })).filter((group) => group.items.length > 0);
}
