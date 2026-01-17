"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/ui/header";
import RecommendationCard from "@/components/ui/recommendation-card";
import { 
  Filter, 
  Search,
  Lightbulb,
  Clock,
  DollarSign,
  Zap
} from "lucide-react";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  costType: string;
  timeframe: string;
  strategicType: string;
  estimatedImpact: number;
  isInRoadmap?: boolean;
}

export default function RecommendationsClient() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
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
      }
    } catch (error) {
      console.error("Error adding to roadmap:", error);
    }
  };

  const filteredRecommendations = (recommendations ?? []).filter(rec => {
    const matchesSearch = (rec?.title ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase()) ||
                          (rec?.description ?? '').toLowerCase().includes((searchTerm ?? '').toLowerCase());
    const matchesTimeframe = filters?.timeframe === "all" || rec?.timeframe === filters?.timeframe;
    const matchesCost = filters?.costType === "all" || rec?.costType === filters?.costType;
    const matchesStrategic = filters?.strategicType === "all" || rec?.strategicType === filters?.strategicType;
    
    return matchesSearch && matchesTimeframe && matchesCost && matchesStrategic;
  });

  const quickWins = filteredRecommendations?.filter(r => r?.strategicType === "QUICK_WIN") ?? [];
  const projects = filteredRecommendations?.filter(r => r?.strategicType === "PROJECT") ?? [];
  const bigBets = filteredRecommendations?.filter(r => r?.strategicType === "BIG_BET") ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="w-12 h-12 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Lightbulb className="text-[#a78bfa]" />
            Recommendations
          </h1>
          <p className="text-gray-600">AI-powered improvement recommendations based on your assessment results</p>
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
                placeholder="Search recommendations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target?.value ?? '')}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent outline-none"
              />
            </div>
            
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-gray-400" />
                <select
                  value={filters?.timeframe ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), timeframe: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] outline-none bg-white"
                >
                  <option value="all">All Timeframes</option>
                  <option value="SHORT_TERM">Short-term</option>
                  <option value="MEDIUM_TERM">Medium-term</option>
                  <option value="LONG_TERM">Long-term</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-gray-400" />
                <select
                  value={filters?.costType ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), costType: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] outline-none bg-white"
                >
                  <option value="all">All Cost Types</option>
                  <option value="CAPEX">CAPEX</option>
                  <option value="OPEX">OPEX</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Zap size={18} className="text-gray-400" />
                <select
                  value={filters?.strategicType ?? 'all'}
                  onChange={(e) => setFilters(prev => ({ ...(prev ?? {}), strategicType: e.target?.value ?? 'all' }))}
                  className="px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] outline-none bg-white"
                >
                  <option value="all">All Types</option>
                  <option value="QUICK_WIN">Quick Win</option>
                  <option value="PROJECT">Project</option>
                  <option value="BIG_BET">Big Bet</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>

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
              Quick Wins ({quickWins?.length ?? 0})
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
              <div className="w-3 h-3 rounded-full bg-[#1e3a8a]" />
              Projects ({projects?.length ?? 0})
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
              Big Bets ({bigBets?.length ?? 0})
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
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {(filteredRecommendations?.length ?? 0) === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Lightbulb size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Recommendations Found</h2>
            <p className="text-gray-500">
              {searchTerm || filters?.timeframe !== "all" || filters?.costType !== "all" || filters?.strategicType !== "all"
                ? "Try adjusting your filters"
                : "Complete the survey to receive personalized recommendations"}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}