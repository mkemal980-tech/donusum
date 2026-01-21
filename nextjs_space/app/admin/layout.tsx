"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FolderTree, Lightbulb, LayoutDashboard, Factory, BarChart3, Scale, FileText, Activity, Download, Users, Building2, UserCheck } from "lucide-react";

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
  
  // Group items by section
  const sections = navItems.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Yönetim Paneli</h1>
                <p className="text-sm text-white/70">Dönüşüm Platformu</p>
              </div>
            </div>
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
            >
              <LayoutDashboard size={18} />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </header>
      
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 bg-white shadow-soft min-h-[calc(100vh-72px)] p-4 border-r border-gray-100">
          <nav className="space-y-1">
            {/* Main nav item */}
            {sections['main']?.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary' 
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            
            {/* Kullanıcı Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-primary-400 uppercase tracking-wider">Kullanıcı Yönetimi</p>
            </div>
            {sections['Kullanıcı Yönetimi']?.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary' 
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            
            {/* Anket Yönetimi */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-primary-400 uppercase tracking-wider">Anket Yönetimi</p>
            </div>
            {sections['Anket Yönetimi']?.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary' 
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            
            {/* Sektör & Benchmark */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-primary-400 uppercase tracking-wider">Sektör & Benchmark</p>
            </div>
            {sections['Sektör & Benchmark']?.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary' 
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            
            {/* Diğer */}
            <div className="border-t border-gray-100 my-4" />
            {sections['Diğer']?.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary' 
                      : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'
                  }`}>
                    <Icon size={20} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-8 bg-background-light min-h-[calc(100vh-72px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
