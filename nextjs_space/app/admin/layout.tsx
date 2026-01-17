import Link from "next/link";
import { Settings, FolderTree, HelpCircle, Lightbulb, LayoutDashboard, Factory, BarChart3, Scale } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1e3a8a] text-white shadow-lg">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Settings className="w-8 h-8" />
              <h1 className="text-xl font-bold">Yönetim Paneli</h1>
            </div>
            <Link href="/dashboard" className="text-white/80 hover:text-white flex items-center gap-2">
              <LayoutDashboard size={18} />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </header>
      
      <div className="flex">
        <aside className="w-64 bg-white shadow-md min-h-[calc(100vh-72px)] p-4">
          <nav className="space-y-2">
            <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <LayoutDashboard size={20} />
              Genel Bakış
            </Link>
            <Link href="/admin/categories" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <FolderTree size={20} />
              Kategoriler & Sorular
            </Link>
            <Link href="/admin/recommendations" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <Lightbulb size={20} />
              Öneriler
            </Link>
            <Link href="/admin/sectors" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <Factory size={20} />
              Sektörler
            </Link>
            <Link href="/admin/benchmarks" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <BarChart3 size={20} />
              Benchmark Verileri
            </Link>
            <Link href="/admin/sector-weights" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700 font-medium">
              <Scale size={20} />
              Sektör Ağırlıkları
            </Link>
          </nav>
        </aside>
        
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
