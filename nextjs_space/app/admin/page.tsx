"use client";

import { useEffect, useState } from "react";
import { FolderTree, HelpCircle, Lightbulb, Layers } from "lucide-react";
import Link from "next/link";

interface Stats {
  categories: number;
  subCategories: number;
  subLevels: number;
  questions: number;
  recommendations: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ categories: 0, subCategories: 0, subLevels: 0, questions: 0, recommendations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [catRes, recRes] = await Promise.all([
          fetch('/api/admin/categories'),
          fetch('/api/admin/recommendations')
        ]);
        const categories = await catRes.json();
        const recommendations = await recRes.json();
        
        let subCatCount = 0, subLevelCount = 0, questionCount = 0;
        categories?.forEach((cat: any) => {
          subCatCount += cat.subCategories?.length || 0;
          cat.subCategories?.forEach((sub: any) => {
            subLevelCount += sub.subLevels?.length || 0;
            sub.subLevels?.forEach((level: any) => {
              questionCount += level.questions?.length || 0;
            });
          });
        });
        
        setStats({
          categories: categories?.length || 0,
          subCategories: subCatCount,
          subLevels: subLevelCount,
          questions: questionCount,
          recommendations: recommendations?.length || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    { title: 'Kategoriler', count: stats.categories, icon: FolderTree, color: 'bg-blue-500', href: '/admin/categories' },
    { title: 'Alt Kategoriler', count: stats.subCategories, icon: Layers, color: 'bg-purple-500', href: '/admin/categories' },
    { title: 'Alt Seviyeler', count: stats.subLevels, icon: Layers, color: 'bg-indigo-500', href: '/admin/categories' },
    { title: 'Sorular', count: stats.questions, icon: HelpCircle, color: 'bg-green-500', href: '/admin/categories' },
    { title: 'Öneriler', count: stats.recommendations, icon: Lightbulb, color: 'bg-orange-500', href: '/admin/recommendations' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Yönetim Paneli - Genel Bakış</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className="text-white" size={24} />
                </div>
                <p className="text-gray-500 text-sm">{card.title}</p>
                <p className="text-3xl font-bold text-gray-800">{card.count}</p>
              </Link>
            );
          })}
        </div>
      )}
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Hızlı İşlemler</h2>
          <div className="space-y-3">
            <Link href="/admin/categories" className="block p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <p className="font-medium text-blue-700">Kategori & Soru Yönetimi</p>
              <p className="text-sm text-blue-600">Anket yapısını düzenleyin</p>
            </Link>
            <Link href="/admin/recommendations" className="block p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
              <p className="font-medium text-orange-700">Öneri Yönetimi</p>
              <p className="text-sm text-orange-600">Stratejik önerileri düzenleyin</p>
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Yapı Hiyerarşisi</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>📁 <strong>Kategori</strong> - Ana başlık (örn: Çevresel Sürdürülebilirlik)</p>
            <p className="pl-4">📂 <strong>Alt Kategori</strong> - Alt başlık (örn: Karbon Yönetimi)</p>
            <p className="pl-8">📄 <strong>Alt Seviye</strong> - Detay başlık (örn: Emisyon Takibi)</p>
            <p className="pl-12">❓ <strong>Soru</strong> - Anket sorusu</p>
          </div>
        </div>
      </div>
    </div>
  );
}
