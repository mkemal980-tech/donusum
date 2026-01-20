"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, ClipboardList, Lightbulb, Map, User, Settings, Building2, LogOut } from "lucide-react";
import { motion } from "framer-motion";

const baseNavItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: LayoutDashboard, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
  { href: "/survey", label: "Anket", icon: ClipboardList, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
  { href: "/recommendations", label: "Öneriler", icon: Lightbulb, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
  { href: "/roadmap", label: "Yol Haritası", icon: Map, roles: ["USER", "UNIT_MANAGER", "ADMIN"] },
  { href: "/unit-manager", label: "Birim Takibi", icon: Building2, roles: ["UNIT_MANAGER", "ADMIN"] },
  { href: "/admin", label: "Yönetim", icon: Settings, roles: ["ADMIN"] },
];

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession() || {};
  const userRole = (session?.user as any)?.role || "USER";
  const userName = (session?.user as any)?.firstName || (session?.user as any)?.name || "Kullanıcı";

  const navItems = baseNavItems.filter((item) => item.roles.includes(userRole));

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#a78bfa] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="font-semibold text-lg text-[#1e3a8a] hidden sm:block">Dönüşüm Platformu</span>
          </Link>
          
          <nav className="flex items-center gap-2">
            {navItems?.map((item) => {
              const Icon = item?.icon;
              const isActive = pathname === item?.href || 
                (item?.href === '/admin' && pathname?.startsWith('/admin')) ||
                (item?.href === '/unit-manager' && pathname?.startsWith('/unit-manager'));
              return (
                <Link key={item?.href} href={item?.href ?? '#'}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? "bg-[#1e3a8a] text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-100 hover:text-[#1e3a8a]"
                    }`}
                  >
                    {Icon && <Icon size={18} />}
                    <span className="hidden md:inline">{item?.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
              <User size={16} />
              <span>{userName}</span>
              {userRole === "ADMIN" && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Admin</span>
              )}
              {userRole === "UNIT_MANAGER" && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">Birim Yön.</span>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Çıkış Yap"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}