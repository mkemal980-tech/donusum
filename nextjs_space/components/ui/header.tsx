"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LayoutDashboard, ClipboardList, Lightbulb, Map, User, Settings, Building2, LogOut, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const userRole = (session?.user as any)?.role || "USER";
  const userName = (session?.user as any)?.firstName || (session?.user as any)?.name || "Kullanıcı";

  const navItems = baseNavItems.filter((item) => item.roles.includes(userRole));

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-dark-card/90 backdrop-blur-md border-b border-primary-100 dark:border-dark-border shadow-soft transition-colors duration-300">
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 dark:from-cyan-400 dark:to-blue-500 rounded-xl flex items-center justify-center shadow-primary dark:shadow-glow-cyan">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="font-semibold text-lg text-primary-700 dark:text-cyan-400 hidden sm:block">Dönüşüm Platformu</span>
          </Link>
          
          {/* Navigation */}
          <nav className="flex items-center gap-1 bg-primary-50/80 dark:bg-dark-card/80 p-1 rounded-xl border dark:border-dark-border">
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
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-gradient-to-r from-primary-500 to-primary-600 dark:from-cyan-500 dark:to-blue-500 text-white shadow-primary dark:shadow-glow-cyan"
                        : "text-primary-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-dark-border"
                    }`}
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
            {/* Theme Toggle */}
            {mounted && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className="p-2.5 rounded-xl transition-all duration-200 bg-primary-50 dark:bg-dark-border text-primary-600 dark:text-cyan-400 hover:bg-primary-100 dark:hover:bg-dark-card"
                title={theme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </motion.button>
            )}

            {/* User Info */}
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-card rounded-xl shadow-soft dark:border dark:border-dark-border">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-secondary-400 dark:from-cyan-400 dark:to-blue-400 rounded-lg flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{userName}</span>
                {userRole === "ADMIN" && (
                  <span className="text-xs text-primary-500 dark:text-cyan-400 font-medium">Admin</span>
                )}
                {userRole === "UNIT_MANAGER" && (
                  <span className="text-xs text-secondary-500 dark:text-blue-400 font-medium">Birim Yön.</span>
                )}
              </div>
            </div>

            {/* Logout */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="p-2.5 text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-red-900/30 rounded-xl transition-all duration-200"
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
