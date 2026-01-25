"use client";

import { useState, useEffect } from "react";
import { BarChart3, Save, Trash2, Plus } from "lucide-react";

interface Sector {
  id: string;
  name: string;
  subSectors: { id: string; name: string }[];
}

interface Category {
  id: string;
  name: string;
  subCategories: { id: string; name: string }[];
}

interface Benchmark {
  id: string;
  sectorId: string;
  subSectorId: string | null;
  level: string;
  targetId: string | null;
  bestScore: number;
  averageScore: number;
  sector?: { name: string };
  subSector?: { name: string } | null;
}

export default function BenchmarksPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSubSector, setSelectedSubSector] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("OVERALL");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  const fetchData = async () => {
    try {
      const [sectorsRes, categoriesRes, benchmarksRes] = await Promise.all([
        fetch("/api/admin/sectors"),
        fetch("/api/admin/categories"),
        fetch("/api/admin/benchmarks")
      ]);
      
      const sectorsData = await sectorsRes.json();
      const categoriesData = await categoriesRes.json();
      const benchmarksData = await benchmarksRes.json();
      
      setSectors(sectorsData || []);
      setCategories(categoriesData || []);
      setBenchmarks(benchmarksData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!selectedSector) {
      alert("Lütfen bir sektör seçin");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorId: selectedSector,
          subSectorId: selectedSubSector || null,
          level: selectedLevel,
          targetId: selectedLevel !== "OVERALL" ? selectedTarget : null,
          bestScore,
          averageScore
        })
      });

      if (res.ok) {
        fetchData();
        // Reset form
        setSelectedTarget("");
        setBestScore(0);
        setAverageScore(0);
      }
    } catch (error) {
      console.error("Error saving benchmark:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu benchmark verisini silmek istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/admin/benchmarks?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error deleting benchmark:", error);
    }
  };

  const selectedSectorData = sectors.find(s => s.id === selectedSector);

  const getTargetName = (b: Benchmark) => {
    if (b.level === "OVERALL") return "Genel";
    if (b.level === "CATEGORY") {
      const cat = categories.find(c => c.id === b.targetId);
      return cat?.name || b.targetId;
    }
    if (b.level === "SUBCATEGORY") {
      for (const cat of categories) {
        const sub = cat.subCategories.find(s => s.id === b.targetId);
        if (sub) return sub.name;
      }
      return b.targetId;
    }
    return "-";
  };

  const filteredBenchmarks = benchmarks.filter(b => {
    if (selectedSector && b.sectorId !== selectedSector) return false;
    if (selectedSubSector && b.subSectorId !== selectedSubSector) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Benchmark Verileri</h1>
        <p className="text-[var(--text-muted)] mt-1">Sektör ve alt sektör bazlı en iyi ve ortalama puanları girin</p>
      </div>

      {/* Form */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <Plus size={20} />
          Benchmark Verisi Ekle / Güncelle
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sektör *</label>
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setSelectedSubSector(""); }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Sektör Seçin</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Alt Sektör (Opsiyonel)</label>
            <select
              value={selectedSubSector}
              onChange={(e) => setSelectedSubSector(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={!selectedSector}
            >
              <option value="">Tüm Sektör (Genel)</option>
              {selectedSectorData?.subSectors.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Seviye</label>
            <select
              value={selectedLevel}
              onChange={(e) => { setSelectedLevel(e.target.value); setSelectedTarget(""); }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="OVERALL">Genel Skor</option>
              <option value="CATEGORY">Kategori Bazlı</option>
              <option value="SUBCATEGORY">Alt Kategori Bazlı</option>
            </select>
          </div>

          {selectedLevel === "CATEGORY" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Kategori</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Kategori Seçin</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedLevel === "SUBCATEGORY" && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Alt Kategori</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Alt Kategori Seçin</option>
                {categories.map(c => (
                  <optgroup key={c.id} label={c.name}>
                    {c.subCategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">En İyi Puan (0-5)</label>
            <input
              type="number"
              value={bestScore}
              onChange={(e) => setBestScore(parseFloat(e.target.value) || 0)}
              min="0"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Ortalama Puan (0-5)</label>
            <input
              type="number"
              value={averageScore}
              onChange={(e) => setAverageScore(parseFloat(e.target.value) || 0)}
              min="0"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !selectedSector}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={20} />
          )}
          Kaydet
        </button>
      </div>

      {/* Existing Benchmarks */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b bg-[var(--bg-card-2)]">
          <h2 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
            <BarChart3 size={20} />
            Mevcut Benchmark Verileri
          </h2>
        </div>

        {filteredBenchmarks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-card-2)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Sektör</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Alt Sektör</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Seviye</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Hedef</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">En İyi</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">Ortalama</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBenchmarks.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--bg-card-2)]">
                    <td className="px-4 py-3 text-sm text-[var(--text-main)]">{b.sector?.name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{b.subSector?.name || "Tüm"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.level === "OVERALL" ? "bg-[var(--bg-card-2)] text-[var(--accent)]" :
                        b.level === "CATEGORY" ? "bg-purple-100 text-purple-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {b.level === "OVERALL" ? "Genel" : b.level === "CATEGORY" ? "Kategori" : "Alt Kategori"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{getTargetName(b)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">{b.bestScore.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-[var(--bg-card-2)] text-[var(--text-muted)] rounded font-medium">{b.averageScore.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-[var(--text-dim)]">Henüz benchmark verisi girilmemiş</p>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              {selectedSector ? "Seçili sektör için veri bulunamadı" : "Yukarıdaki formu kullanarak veri ekleyin"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
