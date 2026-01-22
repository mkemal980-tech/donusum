"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FolderTree, Lightbulb, LayoutDashboard, Factory, BarChart3, Scale, FileText, Activity, Download, Users, Building2, UserCheck, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

const navItems = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, section: null },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users, section: "Kullanıcı Yönetimi" },
  { href: "/admin/units", label: "Birimler", icon: Building2, section: "Kullanıcı Yönetimi" },
  { href: "/admin/surveys", label: "Anketler", icon: FileText, section: "Anket Yönetimi" },
  { href: "/admin/survey-assignments", label: "Anket Atamaları", icon: UserCheck, section: "Anket Yönetimi" },
  { href: "/admin/categories", label: "Kategoriler & Sorular", icon: FolderTree, section: "Anket Yönetimi" },
  { href: "/admin/recommendations", label: "Öneriler", icon: Lightbulb, section: "Anket Yönetimi" },
  { href: "/admin/sectors", label: "Sektörler", icon: Factory, section: "Sektör & Benchmark" },
  { href: "/admin/benchmarks", label: "Benchmark Verileri", icon: BarChart3, section: "Sektör & Benchmark" },
  { href: "/admin/sector-weights", label: "Sektör Ağırlıkları", icon: Scale, section: "Sektör & Benchmark" },
  { href: "/admin/ironman-benchmarks", label: "Ironman Benchmark", icon: Activity, section: "Sektör & Benchmark" },
  { href: "/admin/export", label: "Veri Dışa Aktarma", icon: Download, section: "Diğer" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  
  // Group items by section
  const sections = navItems.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const renderNavItem = (item: typeof navItems[0]) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    return (
      <Link key={item.href} href={item.href}>
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] text-white dark:text-[var(--bg-main)] shadow-lg' 
            : 'text-[var(--text-secondary)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]'
        }`}>
          <Icon size={20} />
          {item.label}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] dark:from-[var(--bg-card)] dark:to-[var(--bg-secondary)] text-white shadow-lg sticky top-0 z-50 border-b border-transparent dark:border-[var(--border-light)]">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 dark:bg-[var(--primary)]/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Settings className="w-6 h-6 dark:text-[var(--primary)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold dark:text-[var(--text-primary)]">Yönetim Paneli</h1>
                <p className="text-sm text-white/70 dark:text-[var(--text-muted)]">Dönüşüm Platformu</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2.5 rounded-xl bg-white/10 dark:bg-[var(--bg-main)] hover:bg-white/20 dark:hover:bg-[var(--border-light)] transition-all duration-200"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-yellow-400" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 px-4 py-2 bg-white/10 dark:bg-[var(--bg-main)] hover:bg-white/20 dark:hover:bg-[var(--border-light)] rounded-xl transition-all duration-200 backdrop-blur-sm dark:text-[var(--text-primary)]"
              >
                <LayoutDashboard size={18} />
                Ana Sayfaya Dön
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 bg-[var(--bg-card)] shadow-lg min-h-[calc(100vh-72px)] p-4 border-r border-[var(--border-light)]">
          <nav className="space-y-1">
            {/* Main nav item */}
            {sections['main']?.map(renderNavItem)}
            
            {/* Kullanıcı Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Kullanıcı Yönetimi</p>
            </div>
            {sections['Kullanıcı Yönetimi']?.map(renderNavItem)}
            
            {/* Anket Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Anket Yönetimi</p>
            </div>
            {sections['Anket Yönetimi']?.map(renderNavItem)}
            
            {/* Sektör & Benchmark */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">Sektör & Benchmark</p>
            </div>
            {sections['Sektör & Benchmark']?.map(renderNavItem)}
            
            {/* Diğer */}
            <div className="border-t border-[var(--border-light)] my-4" />
            {sections['Diğer']?.map(renderNavItem)}
          </nav>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-8 bg-[var(--bg-secondary)] dark:bg-[var(--bg-main)] min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
