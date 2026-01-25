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
    <header 
      className="sticky top-0 z-50 backdrop-blur-md border-b shadow-lg transition-colors duration-300"
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderColor: 'var(--border-soft)' 
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent), var(--blue-main))',
                boxShadow: '0 0 20px rgba(12, 193, 195, 0.3)'
              }}
            >
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span 
              className="font-semibold text-lg hidden sm:block"
              style={{ color: 'var(--accent)' }}
            >
              Dönüşüm Platformu
            </span>
          </Link>
          
          {/* Navigation */}
          <nav 
            className="flex items-center gap-1 p-1 rounded-xl border"
            style={{ 
              backgroundColor: 'var(--bg-card-2)', 
              borderColor: 'var(--border-soft)' 
            }}
          >
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
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200"
                    style={isActive ? {
                      background: 'linear-gradient(135deg, var(--accent), var(--blue-main))',
                      color: 'var(--bg-deep)',
                      boxShadow: '0 0 15px rgba(12, 193, 195, 0.4)'
                    } : {
                      color: 'var(--text-muted)'
                    }}
                  >
                    {Icon && <Icon size={18} />}
                    <span className="hidden md:inline">{item?.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* User Info */}
            <div 
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg border"
              style={{ 
                backgroundColor: 'var(--bg-card)', 
                borderColor: 'var(--border-soft)' 
              }}
            >
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, var(--accent), var(--blue-main))' 
                }}
              >
                <User size={16} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span 
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-main)' }}
                >
                  {userName}
                </span>
                {userRole === "ADMIN" && (
                  <span 
                    className="text-xs font-medium"
                    style={{ color: 'var(--accent)' }}
                  >
                    Admin
                  </span>
                )}
                {userRole === "UNIT_MANAGER" && (
                  <span 
                    className="text-xs font-medium"
                    style={{ color: 'var(--blue-main)' }}
                  >
                    Birim Yön.
                  </span>
                )}
              </div>
            </div>

            {/* Logout */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2.5 rounded-xl transition-all duration-200"
              style={{ color: 'var(--ui-passive)' }}
              title="Çıkış Yap"
            >
              <LogOut size={18} />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
