"use client";

import { useState, useEffect } from "react";
import { BenchmarkChart } from "@/components/ui/benchmark-chart";
import { BarChart3, Factory, Layers, AlertCircle } from "lucide-react";
import Link from "next/link";

interface BenchmarkData {
  hasSector: boolean;
  sector?: { id: string; name: string };
  subSector?: { id: string; name: string } | null;
  sectorBenchmark?: {
    overall: { name: string; userScore: number; bestScore: number; averageScore: number };
    categories: Array<{ id: string; name: string; userScore: number; bestScore: number; averageScore: number }>;
  };
  subSectorBenchmark?: {
    overall: { name: string; userScore: number; bestScore: number; averageScore: number };
    categories: Array<{ id: string; name: string; userScore: number; bestScore: number; averageScore: number }>;
  } | null;
}

export function BenchmarkSection() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sector" | "subsector">("sector");

  useEffect(() => {
    const fetchBenchmark = async () => {
      try {
        const res = await fetch("/api/benchmarks/user");
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching benchmark:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBenchmark();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="text-[#1e3a8a]" size={24} />
          <h3 className="text-lg font-semibold text-gray-800">Benchmark Karşılaştırması</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data?.hasSector) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="text-[#1e3a8a]" size={24} />
          <h3 className="text-lg font-semibold text-gray-800">Benchmark Karşılaştırması</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle size={48} className="text-amber-400 mb-4" />
          <p className="text-gray-600 mb-2">Sektör bilgisi bulunamadı</p>
          <p className="text-sm text-gray-400">
            Benchmark karşılaştırması için profilinizde sektör bilgisi gereklidir
          </p>
        </div>
      </div>
    );
  }

  const hasSubSectorData = data.subSector && data.subSectorBenchmark;

  const currentBenchmark = activeTab === "subsector" && hasSubSectorData 
    ? data.subSectorBenchmark 
    : data.sectorBenchmark;

  if (!currentBenchmark) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="text-[#1e3a8a]" size={24} />
          <h3 className="text-lg font-semibold text-gray-800">Benchmark Karşılaştırması</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Factory size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-500">Sektörünüz için benchmark verisi henüz girilmemiş</p>
          <p className="text-sm text-gray-400 mt-1">Sektör: {data.sector?.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sector Info */}
      <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3b5998] rounded-xl p-4 text-white">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Factory size={20} />
            <div>
              <p className="text-xs text-white/70">Sektör</p>
              <p className="font-medium">{data.sector?.name}</p>
            </div>
          </div>
          {data.subSector && (
            <div className="flex items-center gap-2">
              <Layers size={20} />
              <div>
                <p className="text-xs text-white/70">Alt Sektör</p>
                <p className="font-medium">{data.subSector.name}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {hasSubSectorData && (
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("sector")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "sector"
                ? "bg-[#1e3a8a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Sektör Benchmark
          </button>
          <button
            onClick={() => setActiveTab("subsector")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "subsector"
                ? "bg-[#1e3a8a] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Alt Sektör Benchmark
          </button>
        </div>
      )}

      {/* Chart */}
      <BenchmarkChart
        title={activeTab === "subsector" && hasSubSectorData 
          ? `${data.subSector?.name} Benchmark` 
          : `${data.sector?.name} Benchmark`
        }
        overall={currentBenchmark.overall}
        categories={currentBenchmark.categories}
        companyName="Sizin Puanınız"
      />
    </div>
  );
}
