"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Settings, FolderTree, Lightbulb, LayoutDashboard, Factory, BarChart3, Scale, FileText, Activity, Download, Users, Building2, UserCheck, Files, Gauge } from "lucide-react";

const baseNavItems = [
  { href: "/admin", label: "Genel Bakış", icon: LayoutDashboard, section: null, roles: ["ADMIN", "UNIT_MANAGER"] },
  { href: "/admin/dashboard", label: "Sistem Dashboard", icon: BarChart3, section: null, roles: ["ADMIN"], requiresUnitResponses: true },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users, section: "Kullanıcı Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/units", label: "Birimler", icon: Building2, section: "Kullanıcı Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/surveys", label: "Anketler", icon: FileText, section: "Anket Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/survey-assignments", label: "Anket Atamaları", icon: UserCheck, section: "Anket Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "Kategoriler & Sorular", icon: FolderTree, section: "Anket Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/recommendations", label: "Öneriler", icon: Lightbulb, section: "Anket Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/documents", label: "Yüklenen Dosyalar", icon: Files, section: "Anket Yönetimi", roles: ["ADMIN"] },
  { href: "/admin/sectors", label: "Sektörler", icon: Factory, section: "Sektör & Benchmark", roles: ["ADMIN"] },
  { href: "/admin/benchmarks", label: "Benchmark Verileri", icon: BarChart3, section: "Sektör & Benchmark", roles: ["ADMIN"] },
  { href: "/admin/sector-weights", label: "Sektör Kapsamı", icon: Scale, section: "Sektör & Benchmark", roles: ["ADMIN"] },
  { href: "/admin/ironman-benchmarks", label: "Ironman Benchmark", icon: Activity, section: "Sektör & Benchmark", roles: ["ADMIN"] },
  { href: "/admin/export", label: "Veri Dışa Aktarma", icon: Download, section: "Diğer", roles: ["ADMIN"] },
  { href: "/admin/monitoring", label: "Sistem İzleme", icon: Gauge, section: "Diğer", roles: ["ADMIN"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unitHasResponses, setUnitHasResponses] = useState(false);
  
  const userRole = (session?.user as { role?: string })?.role || "USER";
  
  // Check if unit manager's unit has responses
  useEffect(() => {
    if (userRole === "UNIT_MANAGER") {
      fetch("/api/admin/dashboard/unit-check")
        .then((res) => res.json())
        .then((data) => {
          setUnitHasResponses(data.hasResponses || false);
        })
        .catch(() => setUnitHasResponses(false));
    }
  }, [userRole]);
  
  // Filter nav items based on user role
  const navItems = baseNavItems.filter((item) => {
    // Check if user role is allowed
    if (!item.roles.includes(userRole)) {
      // Special case: UNIT_MANAGER can see dashboard if their unit has responses
      if (item.requiresUnitResponses && userRole === "UNIT_MANAGER" && unitHasResponses) {
        return true;
      }
      return false;
    }
    return true;
  });
  
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
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActive 
            ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-l-[3px] border-[var(--accent)]' 
            : 'text-[var(--ui-passive)] hover:bg-[var(--bg-card-2)] hover:text-[var(--text-muted)]'
        }`}>
          <Icon size={20} className={isActive ? 'text-[var(--accent)]' : ''} />
          {item.label}
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ 
        background: 'var(--bg-card)', 
        borderColor: 'var(--border-soft)' 
      }}>
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
                <Settings className="w-6 h-6" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 className="text-xl font-semibold" style={{ color: 'var(--text-main)' }}>Yönetim Paneli</h1>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Dönüşüm Platformu</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link 
                href="/dashboard" 
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
                style={{ 
                  background: 'var(--bg-card-2)', 
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-soft)'
                }}
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
        <aside className="w-72 min-h-[calc(100vh-72px)] p-4 border-r" style={{ 
          background: 'var(--bg-deep)', 
          borderColor: 'var(--border-soft)' 
        }}>
          <nav className="space-y-1">
            {/* Main nav item */}
            {sections['main']?.map(renderNavItem)}
            
            {/* Kullanıcı Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Kullanıcı Yönetimi</p>
            </div>
            {sections['Kullanıcı Yönetimi']?.map(renderNavItem)}
            
            {/* Anket Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Anket Yönetimi</p>
            </div>
            {sections['Anket Yönetimi']?.map(renderNavItem)}
            
            {/* Sektör & Benchmark */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Sektör & Benchmark</p>
            </div>
            {sections['Sektör & Benchmark']?.map(renderNavItem)}
            
            {/* Diğer */}
            <div className="my-4" style={{ borderTop: '1px solid var(--divider)' }} />
            {sections['Diğer']?.map(renderNavItem)}
          </nav>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-8 min-h-[calc(100vh-72px)]" style={{ background: 'var(--bg-main)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
