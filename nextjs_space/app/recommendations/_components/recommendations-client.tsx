"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Header from "@/components/ui/header";
import RecommendationCard from "@/components/ui/recommendation-card";
import { BubbleChart } from "@/components/ui/bubble-chart";
import { 
  Search,
  Lightbulb,
  Clock,
  DollarSign,
  Zap,
  LayoutGrid,
  ScatterChart,
  CheckCircle2,
  Play,
  Circle,
  BarChart3
} from "lucide-react";

type CompletionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  costType: string;
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  strategicType: 'QUICK_WIN' | 'PROJECT' | 'BIG_BET';
  estimatedImpact: number;
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
  order: number;
  isInRoadmap?: boolean;
  completionStatus?: CompletionStatus;
}

interface CompletionRecord {
  id: string;
  recommendationId: string;
  status: CompletionStatus;
}

export default function RecommendationsClient() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [completions, setCompletions] = useState<Record<string, CompletionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'bubble' | 'list'>('bubble');
  const [statusFilter, setStatusFilter] = useState<'all' | CompletionStatus>('all');
  const [filters, setFilters] = useState({
    timeframe: "all",
    costType: "all",
    strategicType: "all"
  });

  const fetchRecommendations = async () => {
    try {
      const res = await fetch("/api/recommendations");
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data ?? []);
      }
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    }
  };

  const fetchCompletions = async () => {
    try {
      const res = await fetch("/api/recommendations/completion");
      if (res.ok) {
        const data: CompletionRecord[] = await res.json();
        const completionMap: Record<string, CompletionStatus> = {};
        data.forEach(c => {
          completionMap[c.recommendationId] = c.status;
        });
        setCompletions(completionMap);
      }
    } catch (error) {
      console.error("Error fetching completions:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchRecommendations(), fetchCompletions()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAddToRoadmap = async (recommendationId: string) => {
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId })
      });

      if (res.ok) {
        setRecommendations(prev => 
          (prev ?? []).map(rec => 
            rec?.id === recommendationId 
              ? { ...(rec ?? {}), isInRoadmap: true } 
              : rec
          )
        );
        toast.success("Öneri yol haritasına eklendi", {
          description: "Yol Haritası sayfasından planlayabilirsiniz"
        });
      }
    } catch (error) {
      console.error("Error adding to roadmap:", error);
      toast.error("Öneri eklenemedi");
    }
  };

  const handleStatusChange = async (recommendationId: string, status: CompletionStatus) => {
    try {
      const res = await fetch("/api/recommendations/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, status })
      });

      if (res.ok) {
        setCompletions(prev => ({
          ...prev,
          [recommendationId]: status
        }));
        
        const statusLabels: Record<CompletionStatus, string> = {
          NOT_STARTED: "Başlanmadı",
          IN_PROGRESS: "Devam Ediyor",
          COMPLETED: "Tamamlandı"
        };
        
        toast.success(`Durum güncellendi: ${statusLabels[status]}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Durum güncellenemedi");
    }
  };

  // Merge completions with recommendations
  const recommendationsWithStatus = (recommendations ?? []).map(rec => ({
    ...rec,
    completionStatus: completions[rec.id] || 'NOT_STARTED'
  }));

  const filteredRecommendations = recommendationsWithStatus.filter(rec => {
    const matchesSearch = (rec?.title ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase()) ||
                          (rec?.description ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase());
    const matchesTimeframe = filters?.timeframe === "all" || rec?.timeframe === filters?.timeframe;
    const matchesCost = filters?.costType === "all" || rec?.costType === filters?.costType;
    const matchesStrategic = filters?.strategicType === "all" || rec?.strategicType === filters?.strategicType;
    const matchesStatus = statusFilter === "all" || rec?.completionStatus === statusFilter;
    
    return matchesSearch && matchesTimeframe && matchesCost && matchesStrategic && matchesStatus;
  });

  // Stats
  const stats = {
    total: recommendationsWithStatus.length,
    notStarted: recommendationsWithStatus.filter(r => r.completionStatus === 'NOT_STARTED').length,
    inProgress: recommendationsWithStatus.filter(r => r.completionStatus === 'IN_PROGRESS').length,
    completed: recommendationsWithStatus.filter(r => r.completionStatus === 'COMPLETED').length
  };

  const quickWins = filteredRecommendations?.filter(r => r?.strategicType === "QUICK_WIN") ?? [];
  const projects = filteredRecommendations?.filter(r => r?.strategicType === "PROJECT") ?? [];
  const bigBets = filteredRecommendations?.filter(r => r?.strategicType === "BIG_BET") ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <Lightbulb className="text-[#a78bfa]" />
              Öneriler
            </h1>
            <p className="text-gray-600">Değerlendirme sonuçlarınıza göre hazırlanan iyileştirme önerileri</p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex bg-white rounded-lg shadow-sm border p-1">
            <button
              onClick={() => setViewMode('bubble')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'bubble' 
                  ? 'bg-[#6366f1] text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <ScatterChart size={18} />
              <span className="hidden sm:inline">Bubble Chart</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all ${
                viewMode === 'list' 
                  ? 'bg-[#6366f1] text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <LayoutGrid size={18} />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        >
          <div 
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'all' ? 'ring-2 ring-[#6366f1] border-[#6366f1]' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <BarChart3 size={20} className="text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Toplam Öneri</p>
              </div>
            </div>
          </div>
          
          <div 
            onClick={() => setStatusFilter('NOT_STARTED')}
            className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'NOT_STARTED' ? 'ring-2 ring-gray-400 border-gray-400' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Circle size={20} className="text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">{stats.notStarted}</p>
                <p className="text-sm text-gray-500">Başlanmadı</p>
              </div>
            </div>
          </div>
          
          <div 
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'IN_PROGRESS' ? 'ring-2 ring-amber-400 border-amber-400' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Play size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
                <p className="text-sm text-gray-500">Devam Ediyor</p>
              </div>
            </div>
          </div>
          
          <div 
            onClick={() => setStatusFilter('COMPLETED')}
            className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
              statusFilter === 'COMPLETED' ? 'ring-2 ring-green-400 border-green-400' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-sm text-gray-500">Tamamlandı</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Önerilerde ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target?.value ?? '')}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none"
              />
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-gray-400" />
                <select
                  value={filters?.timeframe ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), timeframe: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white"
                >
                  <option value="all">Tüm Zaman Dilimleri</option>
                  <option value="SHORT_TERM">Kısa Vade</option>
                  <option value="MEDIUM_TERM">Orta Vade</option>
                  <option value="LONG_TERM">Uzun Vade</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-gray-400" />
                <select
                  value={filters?.costType ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), costType: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white"
                >
                  <option value="all">Tüm Maliyet Tipleri</option>
                  <option value="CAPEX">CAPEX (Yatırım)</option>
                  <option value="OPEX">OPEX (İşletme)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Zap size={18} className="text-gray-400" />
                <select
                  value={filters?.strategicType ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), strategicType: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6366f1] outline-none bg-white"
                >
                  <option value="all">Tüm Tipler</option>
                  <option value="QUICK_WIN">Hızlı Kazanım</option>
                  <option value="PROJECT">Proje</option>
                  <option value="BIG_BET">Büyük Yatırım</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bubble Chart View */}
        {viewMode === 'bubble' && (filteredRecommendations?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <BubbleChart 
              recommendations={filteredRecommendations as Recommendation[]} 
              title="Öneri Önceliklendirme Grafiği"
            />
          </motion.div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {/* Quick Wins Section */}
            {(quickWins?.length ?? 0) > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-10"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Hızlı Kazanımlar ({quickWins?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {quickWins?.map((rec, index) => (
                    <motion.div
                      key={rec?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <RecommendationCard
                        recommendation={rec}
                        onAddToRoadmap={handleAddToRoadmap}
                        onStatusChange={handleStatusChange}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Projects Section */}
            {(projects?.length ?? 0) > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-10"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                  Projeler ({projects?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects?.map((rec, index) => (
                    <motion.div
                      key={rec?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <RecommendationCard
                        recommendation={rec}
                        onAddToRoadmap={handleAddToRoadmap}
                        onStatusChange={handleStatusChange}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Big Bets Section */}
            {(bigBets?.length ?? 0) > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mb-10"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  Büyük Yatırımlar ({bigBets?.length ?? 0})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bigBets?.map((rec, index) => (
                    <motion.div
                      key={rec?.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <RecommendationCard
                        recommendation={rec}
                        onAddToRoadmap={handleAddToRoadmap}
                        onStatusChange={handleStatusChange}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </>
        )}

        {(filteredRecommendations?.length ?? 0) === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Lightbulb size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Öneri Bulunamadı</h2>
            <p className="text-gray-500">
              {searchTerm || filters?.timeframe !== "all" || filters?.costType !== "all" || filters?.strategicType !== "all" || statusFilter !== "all"
                ? "Filtrelerinizi değiştirmeyi deneyin"
                : "Kişisel öneriler almak için anketi tamamlayın"}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
