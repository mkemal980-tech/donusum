"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/ui/header";
import RoadmapTimeline from "@/components/ui/roadmap-timeline";
import { Map, TrendingUp, Calendar, Info } from "lucide-react";

interface RoadmapItem {
  id: string;
  recommendationId: string;
  plannedQuarter?: number | null;
  plannedYear?: number | null;
  recommendation: {
    id: string;
    title: string;
    timeframe: string;
    strategicType: string;
    estimatedImpact: number;
  };
}

export default function RoadmapClient() {
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoadmap = async () => {
    try {
      const res = await fetch("/api/roadmap");
      if (res.ok) {
        const data = await res.json();
        setRoadmapItems(data ?? []);
      }
    } catch (error) {
      console.error("Error fetching roadmap:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmap();
  }, []);

  const handleRemove = async (recommendationId: string) => {
    try {
      const res = await fetch(`/api/roadmap?recommendationId=${recommendationId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setRoadmapItems(prev => (prev ?? []).filter(item => item?.recommendationId !== recommendationId));
      }
    } catch (error) {
      console.error("Error removing from roadmap:", error);
    }
  };

  const handleUpdateTiming = async (recommendationId: string, quarter: number, year: number) => {
    try {
      const res = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, plannedQuarter: quarter, plannedYear: year })
      });

      if (res.ok) {
        const updated = await res.json();
        setRoadmapItems(prev => 
          (prev ?? []).map(item => 
            item?.recommendationId === recommendationId ? updated : item
          )
        );
      }
    } catch (error) {
      console.error("Error updating timing:", error);
    }
  };

  const totalImpact = (roadmapItems ?? []).reduce((sum, item) => 
    sum + (item?.recommendation?.estimatedImpact ?? 0), 0
  );

  const scheduledItems = (roadmapItems ?? []).filter(item => item?.plannedQuarter && item?.plannedYear);
  const unscheduledItems = (roadmapItems ?? []).filter(item => !item?.plannedQuarter || !item?.plannedYear);

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
            <Map className="text-[#1e3a8a]" />
            Transformation Roadmap
          </h1>
          <p className="text-gray-600">Plan and visualize your transformation journey over time</p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-[#1e3a8a]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Initiatives</p>
                <p className="text-2xl font-bold text-gray-900">{roadmapItems?.length ?? 0}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Projected Impact</p>
                <p className="text-2xl font-bold text-green-600">+{totalImpact}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Map className="text-[#a78bfa]" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Scheduled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scheduledItems?.length ?? 0} / {roadmapItems?.length ?? 0}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Instructions */}
        {(roadmapItems?.length ?? 0) > 0 && (unscheduledItems?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3"
          >
            <Info className="text-[#1e3a8a] mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="font-medium text-[#1e3a8a]">Schedule Your Initiatives</p>
              <p className="text-sm text-blue-700">Use the dropdown menus to assign unscheduled items to specific quarters. This helps visualize your transformation timeline.</p>
            </div>
          </motion.div>
        )}

        {/* Timeline */}
        {(roadmapItems?.length ?? 0) > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-8"
          >
            <RoadmapTimeline
              items={roadmapItems}
              onRemove={handleRemove}
              onUpdateTiming={handleUpdateTiming}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl shadow-md p-16 text-center"
          >
            <Map size={64} className="mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Roadmap Items Yet</h2>
            <p className="text-gray-500 mb-6">Add recommendations to your roadmap from the Recommendations page</p>
            <a
              href="/recommendations"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors"
            >
              Browse Recommendations
            </a>
          </motion.div>
        )}
      </main>
    </div>
  );
}