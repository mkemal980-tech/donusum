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
    { title: 'Kategoriler', count: stats.categories, icon: FolderTree, bgColor: 'rgba(46, 134, 255, 0.15)', iconColor: '#2E86FF', href: '/admin/categories' },
    { title: 'Alt Kategoriler', count: stats.subCategories, icon: Layers, bgColor: 'rgba(12, 193, 195, 0.15)', iconColor: '#0CC1C3', href: '/admin/categories' },
    { title: 'Alt Seviyeler', count: stats.subLevels, icon: Layers, bgColor: 'rgba(10, 125, 175, 0.15)', iconColor: '#0A7DAF', href: '/admin/categories' },
    { title: 'Sorular', count: stats.questions, icon: HelpCircle, bgColor: 'rgba(22, 212, 216, 0.15)', iconColor: '#16D4D8', href: '/admin/categories' },
    { title: 'Öneriler', count: stats.recommendations, icon: Lightbulb, bgColor: 'rgba(245, 166, 35, 0.15)', iconColor: '#F5A623', href: '/admin/recommendations' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-main)' }}>Yönetim Paneli - Genel Bakış</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link 
                key={card.title} 
                href={card.href} 
                className="rounded-xl p-6 transition-all duration-200 hover:shadow-glow"
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-soft)' 
                }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: card.bgColor }}
                >
                  <Icon size={24} style={{ color: card.iconColor }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--text-dim)' }}>{card.title}</p>
                <p className="text-3xl font-bold font-numeric" style={{ color: 'var(--text-main)' }}>{card.count}</p>
              </Link>
            );
          })}
        </div>
      )}
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Hızlı İşlemler</h2>
          <div className="space-y-3">
            <Link 
              href="/admin/categories" 
              className="block p-4 rounded-lg transition-all duration-200"
              style={{ background: 'rgba(46, 134, 255, 0.1)', border: '1px solid rgba(46, 134, 255, 0.2)' }}
            >
              <p className="font-medium" style={{ color: 'var(--blue-main)' }}>Kategori & Soru Yönetimi</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Anket yapısını düzenleyin</p>
            </Link>
            <Link 
              href="/admin/recommendations" 
              className="block p-4 rounded-lg transition-all duration-200"
              style={{ background: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.2)' }}
            >
              <p className="font-medium" style={{ color: '#F5A623' }}>Öneri Yönetimi</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Stratejik önerileri düzenleyin</p>
            </Link>
          </div>
        </div>
        
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Yapı Hiyerarşisi</h2>
          <div className="text-sm space-y-2" style={{ color: 'var(--text-muted)' }}>
            <p>📁 <strong style={{ color: 'var(--text-main)' }}>Kategori</strong> - Ana başlık (örn: Çevresel Sürdürülebilirlik)</p>
            <p className="pl-4">📂 <strong style={{ color: 'var(--text-main)' }}>Alt Kategori</strong> - Alt başlık (örn: Karbon Yönetimi)</p>
            <p className="pl-8">📄 <strong style={{ color: 'var(--text-main)' }}>Alt Seviye</strong> - Detay başlık (örn: Emisyon Takibi)</p>
            <p className="pl-12">❓ <strong style={{ color: 'var(--text-main)' }}>Soru</strong> - Anket sorusu</p>
          </div>
        </div>
      </div>
    </div>
  );
}
