"use client";

import { useState, useEffect } from "react";
import { BenchmarkChart } from "@/components/ui/benchmark-chart";


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
    return <div className="skeleton h-[360px]" />;
  }

  /* Boş durum: tek cümle ne eksik, tek yol nereden tamamlanır. */
  if (!data?.hasSector) {
    return (
      <BenchmarkEmpty
        message="Sektör kıyaslaması için profilinizde sektör bilgisi gerekiyor."
        action={{ href: "/settings", label: "Ayarlardan sektör seç" }}
      />
    );
  }

  const hasSubSectorData = data.subSector && data.subSectorBenchmark;

  const currentBenchmark = activeTab === "subsector" && hasSubSectorData 
    ? data.subSectorBenchmark 
    : data.sectorBenchmark;

  if (!currentBenchmark) {
    return (
      <BenchmarkEmpty
        message={`${data.sector?.name} sektörü için henüz kıyaslama verisi girilmemiş.`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="t-sm" style={{ color: "var(--ink-2)" }}>
        Kıyaslama tabanı: <span style={{ color: "var(--ink)" }}>{data.sector?.name}</span>
        {data.subSector && <> · {data.subSector.name}</>}
      </p>

      {hasSubSectorData && (
        <div className="theme-tabs" role="tablist" aria-label="Kıyaslama tabanı">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sector"}
            onClick={() => setActiveTab("sector")}
            className={`theme-tab ${activeTab === "sector" ? "active" : ""}`}
          >
            Sektör
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "subsector"}
            onClick={() => setActiveTab("subsector")}
            className={`theme-tab ${activeTab === "subsector" ? "active" : ""}`}
          >
            Alt sektör
          </button>
        </div>
      )}

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

/** Kıyaslamanın çizilemediği durumlar için ortak boş kart. */
function BenchmarkEmpty({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <section
      className="rounded-[var(--radius-lg)] p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      <h3 className="t-subhead" style={{ color: "var(--ink)" }}>
        Sektör kıyaslaması
      </h3>
      <p className="mt-2 max-w-[60ch] t-body" style={{ color: "var(--ink-2)" }}>
        {message}
      </p>
      {action && (
        <a
          href={action.href}
          className="mt-3 inline-block t-sm font-medium underline underline-offset-4"
          style={{ color: "var(--accent)" }}
        >
          {action.label}
        </a>
      )}
    </section>
  );
}
