"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, ClipboardList, Lightbulb, Map, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/survey", label: "Survey", icon: ClipboardList },
  { href: "/recommendations", label: "Recommendations", icon: Lightbulb },
  { href: "/roadmap", label: "Roadmap", icon: Map },
];

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession() || {};

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-[1200px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#a78bfa] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <span className="font-semibold text-lg text-[#1e3a8a] hidden sm:block">Transformation Platform</span>
          </Link>
          
          <nav className="flex items-center gap-2">
            {navItems?.map((item) => {
              const Icon = item?.icon;
              const isActive = pathname === item?.href;
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
            {session?.user && (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                  <User size={16} />
                  <span>{session?.user?.name ?? session?.user?.email}</span>
                </div>
                <button
                  onClick={() => signOut?.({ callbackUrl: "/login" })}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}