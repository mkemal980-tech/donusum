"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Target,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Zap,
  Award,
  BarChart3,
  Lightbulb,
  Calendar,
  Layers,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  ArrowRight,
  Info,
} from "lucide-react";

interface KPIData {
  overview: {
    totalQuestions: number;
    answeredQuestions: number;
    completionPercentage: number;
    overallScore: number;
    overallPercentage: number;
    maturityLevel: {
      level: number;
      label: string;
      color: string;
    };
  };
  ironman: {
    velocity: number;
    endurance: number;
    quadrant: string;
    quadrantInfo: {
      title: string;
      color: string;
    };
    velocityVsSector: number | null;
    enduranceVsSector: number | null;
  };
  categories: {
    total: number;
    completed: number;
    stats: Array<{
      id: string;
      name: string;
      total: number;
      answered: number;
      percentage: number;
    }>;
  };
  recommendations: {
    total: number;
    quickWins: number;
    projects: number;
    bigBets: number;
  };
  activity: {
    lastActivityDate: string | null;
    responsesToday: number;
  };
  user: {
    name: string;
    organization: string | null;
    sector: string | null;
    subSector: string | null;
  };
}

interface KPIDashboardProps {
  surveyId?: string;
}

export function KPIDashboard({ surveyId }: KPIDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPI = async () => {
      try {
        const url = surveyId ? `/api/dashboard/kpi?surveyId=${surveyId}` : '/api/dashboard/kpi';
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error('Error fetching KPI:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKPI();
  }, [surveyId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-[var(--bg-card)] rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-[var(--bg-card-2)] rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-[var(--bg-card-2)] rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  // Boş state kontrolü - hiç veri yoksa
  const hasNoData = data.overview.answeredQuestions === 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Henüz aktivite yok';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dk önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const renderTrend = (value: number | null) => {
    if (value === null) return null;
    if (value > 0) return <ArrowUpRight size={14} className="text-[var(--success)]" />;
    if (value < 0) return <ArrowDownRight size={14} className="text-[var(--error)]" />;
    return <Minus size={14} className="text-[var(--text-muted)]" />;
  };

  // Boş State UI - Hiç anket cevabı yoksa
  if (hasNoData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] p-12 text-center">
          <div className="max-w-md mx-auto">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 bg-[var(--accent)]/10 rounded-full flex items-center justify-center">
              <ClipboardList size={40} className="text-[var(--accent)]" />
            </div>
            
            {/* Başlık */}
            <h3 className="text-2xl font-bold text-[var(--text-main)] mb-3">
              Değerlendirmeye Başlayın
            </h3>
            
            {/* Açıklama */}
            <p className="text-[var(--text-muted)] mb-8 leading-relaxed">
              Henüz hiç soru cevaplanmadı. Kuruluşunuzun olgunluk seviyesini değerlendirmek ve 
              kişiselleştirilmiş öneriler almak için anketi tamamlamaya başlayın.
            </p>
            
            {/* İstatistikler */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-[var(--bg-card-2)] rounded-xl p-4">
                <p className="text-sm text-[var(--text-dim)] mb-1">Toplam Soru</p>
                <p className="text-2xl font-bold text-[var(--accent)]">{data.overview.totalQuestions}</p>
              </div>
              <div className="bg-[var(--bg-card-2)] rounded-xl p-4">
                <p className="text-sm text-[var(--text-dim)] mb-1">Kategori</p>
                <p className="text-2xl font-bold text-[var(--accent)]">{data.categories.total}</p>
              </div>
            </div>
            
            {/* CTA Button */}
            <button
              onClick={() => router.push('/survey')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-bright)] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:shadow-[var(--accent)]/20 transition-all duration-300 group"
            >
              <span>Ankete Başla</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            {/* Alt Bilgi */}
            <p className="text-xs text-[var(--text-dim)] mt-6">
              💡 İpucu: Tüm soruları cevaplamak yaklaşık 15-20 dakika sürer
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const kpiCards = [
    {
      title: 'Toplam Soru',
      value: data.overview.totalQuestions,
      description:
        'Bu ankette tanımlı soru sayısı. Sorular kategorilere, kategoriler bölümlere ayrılır; puanınız bu soruların tamamı üzerinden hesaplanır.',
      icon: Layers,
      color: '#6366f1',
      bgColor: 'rgba(99, 102, 241, 0.1)',
      subtitle: `${data.categories.total} kategori`,
    },
    {
      title: 'Tamamlanan',
      value: data.overview.answeredQuestions,
      description:
        'Cevaplanan soru sayısı. Sayı kuruluşun tamamına aittir: bölümler farklı kişilere dağıtıldıysa herkesin girdiği cevaplar burada toplanır. Boş sorular puanı düşürür, çünkü cevaplanmamış soru "yok" sayılır.',
      icon: CheckCircle2,
      color: '#22c55e',
      bgColor: 'rgba(34, 197, 94, 0.1)',
      subtitle: `%${data.overview.completionPercentage} tamamlandı`,
      progress: data.overview.completionPercentage,
    },
    {
      title: 'Olgunluk Puanı',
      value: data.overview.overallScore.toFixed(1),
      description:
        'Genel olgunluğunuz, 1-5 ölçeğinde. Hız ve Dayanıklılık eksenlerinin soru ağırlıklarına göre birleşimidir. %0 başarı 1.0\'a, %100 başarı 5.0\'a karşılık gelir; yani 1.0 "puan yok" demek değil, en düşük basamak demektir.',
      suffix: '/5',
      icon: Gauge,
      color: data.overview.maturityLevel.color,
      bgColor: `${data.overview.maturityLevel.color}20`,
      subtitle: data.overview.maturityLevel.label,
    },
    {
      title: 'Olgunluk Yüzde',
      value: Math.round(data.overview.overallPercentage),
      description:
        'Aynı sonucun yüzde hâli: aldığınız puanın alabileceğiniz en yüksek puana oranı. Seviye bu yüzdenin düştüğü basamaktır — %20 Farkındalık, %40 Gelişen, %60 Olgun, %80 ve üzeri Lider.',
      suffix: '%',
      icon: Target,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      subtitle: `Seviye ${data.overview.maturityLevel.level}`,
    },
    {
      title: 'Velocity (Hız)',
      value: data.ironman.velocity.toFixed(1),
      description:
        'Aksiyon alma hızınız. Uygulamaya, projeye ve harekete geçmeye bakan sorulardan gelir. Yüksek puan çabuk hareket ettiğinizi gösterir; tek başına yüksek olması ise attığınız adımların kalıcı olduğu anlamına gelmez.',
      suffix: '/5',
      icon: Zap,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      subtitle: data.ironman.velocityVsSector !== null 
        ? `Sektöre göre ${data.ironman.velocityVsSector > 0 ? '+' : ''}${data.ironman.velocityVsSector}`
        : 'Benchmark yok',
      trend: data.ironman.velocityVsSector,
    },
    {
      title: 'Endurance (Dayanıklılık)',
      value: data.ironman.endurance.toFixed(1),
      description:
        'Yaptığınız işin kalıcılığı. Politika, dokümantasyon, süreç ve süreklilik sorularından gelir. Yüksek puan, kişilere değil sisteme bağlı çalıştığınızı gösterir.',
      suffix: '/5',
      icon: Activity,
      color: '#14b8a6',
      bgColor: 'rgba(20, 184, 166, 0.1)',
      subtitle: data.ironman.enduranceVsSector !== null 
        ? `Sektöre göre ${data.ironman.enduranceVsSector > 0 ? '+' : ''}${data.ironman.enduranceVsSector}`
        : 'Benchmark yok',
      trend: data.ironman.enduranceVsSector,
    },
    {
      title: 'Ironman Durumu',
      value: data.ironman.quadrantInfo.title,
      description:
        'İki eksenin kesişimi; eşik her iki eksende de 3.0. İkisi de 3.0 üstündeyse Demir Adam (hem hızlı hem kalıcı), yalnızca hız yüksekse Sprinter (hızlı ama kalıcılığı zayıf), yalnızca dayanıklılık yüksekse Maraton Koşucusu (sağlam ama yavaş), ikisi de düşükse Yaya (Walker).',
      icon: Award,
      color: data.ironman.quadrantInfo.color,
      bgColor: `${data.ironman.quadrantInfo.color}20`,
      subtitle: 'Mevcut kadran',
    },
    {
      title: 'Toplam Öneri',
      value: data.recommendations.total,
      description:
        'Cevaplarınıza göre şu an size gösterilen öneri sayısı — ankette tanımlı tüm öneriler değil. Bir öneri ancak ilgili puanınız eşiğin altındaysa ya da bağlı olduğu soruya belirli bir cevap verdiyseniz açılır. Quick Win, kısa sürede ve düşük maliyetle yapılabilecek olanlar.',
      icon: Lightbulb,
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.1)',
      subtitle: `${data.recommendations.quickWins} Quick Win`,
    },
  ];

  return (
    <div className="space-y-6 mb-8">
      {/* Ana KPI Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            tabIndex={0}
            className="group relative bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-soft)] hover:border-[var(--accent)]/30 transition-all duration-300 hover:shadow-lg focus:outline-none focus:border-[var(--accent)]/50"
          >
            {/* Sayının ne anlama geldiği. Kartın altına, kart genişliğinde
                açılır: yana taşarsa son sütunda ekrandan çıkardı. */}
            {card.description && (
              <div
                role="tooltip"
                className="pointer-events-none absolute left-0 right-0 top-full z-30 mt-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card-2)] p-3 text-xs leading-relaxed text-[var(--text-muted)] shadow-xl opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
              >
                {card.description}
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.bgColor }}
              >
                <card.icon size={20} style={{ color: card.color }} />
              </div>
              {card.trend !== undefined && renderTrend(card.trend)}
            </div>
            
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[var(--text-main)]">{card.value}</span>
              {card.suffix && <span className="text-sm text-[var(--text-dim)]">{card.suffix}</span>}
            </div>
            
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
              {card.title}
              {card.description && (
                <Info
                  size={12}
                  className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                  aria-hidden
                />
              )}
            </p>
            <p className="text-xs mt-1" style={{ color: card.color }}>{card.subtitle}</p>
            
            {card.progress !== undefined && (
              <div className="mt-2 h-1.5 bg-[var(--bg-card-2)] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${card.progress}%`,
                    backgroundColor: card.color 
                  }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Alt Detay Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kategori İlerlemesi */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-soft)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
              <BarChart3 size={16} className="text-[var(--accent)]" />
              Kategori İlerlemesi
            </h3>
            <span className="text-xs text-[var(--text-dim)]">
              {data.categories.completed}/{data.categories.total} tamamlandı
            </span>
          </div>
          
          <div className="space-y-3">
            {data.categories.stats.slice(0, 5).map((cat, idx) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-muted)] truncate max-w-[150px]">{cat.name}</span>
                  <span className="text-[var(--text-main)] font-medium">{cat.percentage}%</span>
                </div>
                <div className="h-1.5 bg-[var(--bg-card-2)] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.percentage === 100 ? '#22c55e' : 
                        cat.percentage > 50 ? '#3b82f6' : '#f59e0b'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Öneri Dağılımı */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-soft)]"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-[var(--warning)]" />
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Öneri Dağılımı</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-[var(--success-bg)]0/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[var(--success)]" />
                <span className="text-sm text-[var(--text-muted)]">Quick Wins</span>
              </div>
              <span className="text-lg font-bold text-[var(--success)]">{data.recommendations.quickWins}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-[var(--info-bg)]0/10 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-[var(--blue-main)]" />
                <span className="text-sm text-[var(--text-muted)]">Projeler</span>
              </div>
              <span className="text-lg font-bold text-[var(--blue-main)]">{data.recommendations.projects}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-[var(--accent)]/100/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-[var(--accent)]" />
                <span className="text-sm text-[var(--text-muted)]">Big Bets</span>
              </div>
              <span className="text-lg font-bold text-[var(--accent)]">{data.recommendations.bigBets}</span>
            </div>
          </div>
        </motion.div>

        {/* Aktivite & Bilgi */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border-soft)]"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-main)]">Aktivite</h3>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-[var(--bg-card-2)] rounded-lg">
              <p className="text-xs text-[var(--text-dim)] mb-1">Son Aktivite</p>
              <p className="text-sm font-medium text-[var(--text-main)]">
                {formatDate(data.activity.lastActivityDate)}
              </p>
            </div>
            
            <div className="p-3 bg-[var(--bg-card-2)] rounded-lg">
              <p className="text-xs text-[var(--text-dim)] mb-1">Bugün Cevaplanan</p>
              <p className="text-sm font-medium text-[var(--text-main)]">
                {data.activity.responsesToday} soru
              </p>
            </div>
            
            {data.user.sector && (
              <div className="p-3 bg-[var(--accent)]/10 rounded-lg">
                <p className="text-xs text-[var(--text-dim)] mb-1">Sektör</p>
                <p className="text-sm font-medium text-[var(--accent)]">
                  {data.user.sector}
                  {data.user.subSector && ` - ${data.user.subSector}`}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
