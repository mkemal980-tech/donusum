"use client";

import { useState, useEffect } from "react";
import { BarChart3, Save, Trash2, Plus, FileText, Factory, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Survey {
  id: string;
  name: string;
  categories: Category[];
}

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
  surveyId: string;
  sectorId: string;
  subSectorId: string | null;
  level: string;
  targetId: string | null;
  bestScore: number;
  averageScore: number;
  survey?: { name: string };
  sector?: { name: string };
  subSector?: { name: string } | null;
}

export default function BenchmarksPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state - Yeni sıra: Anket -> Seviye -> Kategori/AltKategori -> Sektör -> Alt Sektör -> Puanlar
  const [selectedSurvey, setSelectedSurvey] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("OVERALL");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedSector, setSelectedSector] = useState("");
  const [selectedSubSector, setSelectedSubSector] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  const fetchData = async () => {
    try {
      const [surveysRes, sectorsRes, benchmarksRes] = await Promise.all([
        fetch("/api/admin/surveys"),
        fetch("/api/admin/sectors"),
        fetch("/api/admin/benchmarks")
      ]);
      
      const surveysData = await surveysRes.json();
      const sectorsData = await sectorsRes.json();
      const benchmarksData = await benchmarksRes.json();
      
      setSurveys(surveysData || []);
      setSectors(sectorsData || []);
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

  // Seçili anketin kategorileri
  const selectedSurveyData = surveys.find(s => s.id === selectedSurvey);
  const categories = selectedSurveyData?.categories || [];
  
  // Seçili kategorinin alt kategorileri
  const selectedCategoryData = categories.find(c => c.id === selectedCategory);
  const subCategories = selectedCategoryData?.subCategories || [];
  
  // Seçili sektörün alt sektörleri
  const selectedSectorData = sectors.find(s => s.id === selectedSector);

  const handleSave = async () => {
    if (!selectedSurvey) {
      alert("Lütfen bir anket seçin");
      return;
    }
    if (!selectedSector) {
      alert("Lütfen bir sektör seçin");
      return;
    }
    if (selectedLevel === "CATEGORY" && !selectedCategory) {
      alert("Lütfen bir kategori seçin");
      return;
    }
    if (selectedLevel === "SUBCATEGORY" && !selectedSubCategory) {
      alert("Lütfen bir alt kategori seçin");
      return;
    }

    setSaving(true);
    try {
      // targetId belirleme
      let targetId = null;
      if (selectedLevel === "CATEGORY") {
        targetId = selectedCategory;
      } else if (selectedLevel === "SUBCATEGORY") {
        targetId = selectedSubCategory;
      }

      const res = await fetch("/api/admin/benchmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: selectedSurvey,
          sectorId: selectedSector,
          subSectorId: selectedSubSector || null, // Boş ise tüm alt sektörlerde geçerli
          level: selectedLevel,
          targetId,
          bestScore,
          averageScore
        })
      });

      if (res.ok) {
        fetchData();
        // Reset scores
        setBestScore(0);
        setAverageScore(0);
      } else {
        const err = await res.json();
        alert(err.error || "Kayıt sırasında hata oluştu");
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

  const getTargetName = (b: Benchmark) => {
    if (b.level === "OVERALL") return "Genel Skor";
    if (b.level === "CATEGORY") {
      // Tüm anketlerin kategorilerinde ara
      for (const survey of surveys) {
        const cat = survey.categories?.find(c => c.id === b.targetId);
        if (cat) return cat.name;
      }
      return b.targetId || "-";
    }
    if (b.level === "SUBCATEGORY") {
      // Tüm anketlerin kategorilerinin alt kategorilerinde ara
      for (const survey of surveys) {
        for (const cat of (survey.categories || [])) {
          const sub = cat.subCategories?.find(s => s.id === b.targetId);
          if (sub) return `${cat.name} > ${sub.name}`;
        }
      }
      return b.targetId || "-";
    }
    return "-";
  };

  // Filtreleme
  const filteredBenchmarks = benchmarks.filter(b => {
    if (selectedSurvey && b.surveyId !== selectedSurvey) return false;
    if (selectedSector && b.sectorId !== selectedSector) return false;
    if (selectedSubSector && b.subSectorId !== selectedSubSector) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-main)]">Benchmark Verileri</h1>
        <p className="text-[var(--text-muted)] mt-1">Anket, kategori ve sektör bazlı en iyi ve ortalama puanları girin</p>
      </div>

      {/* Form */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-6 mb-6 border border-[var(--border-soft)]">
        <h2 className="text-lg font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <Plus size={20} className="text-[var(--accent)]" />
          Benchmark Verisi Ekle / Güncelle
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* 1. Anket Seçimi */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
              <FileText size={14} />
              Anket *
            </label>
            <select
              value={selectedSurvey}
              onChange={(e) => { 
                setSelectedSurvey(e.target.value); 
                setSelectedCategory("");
                setSelectedSubCategory("");
              }}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
            >
              <option value="">Anket Seçin</option>
              {surveys.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 2. Seviye Seçimi */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
              <Layers size={14} />
              Seviye *
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => { 
                setSelectedLevel(e.target.value); 
                setSelectedCategory("");
                setSelectedSubCategory("");
              }}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
              disabled={!selectedSurvey}
            >
              <option value="OVERALL">Genel Skor</option>
              <option value="CATEGORY">Kategori Bazlı</option>
              <option value="SUBCATEGORY">Alt Kategori Bazlı</option>
            </select>
          </div>

          {/* 3. Kategori Seçimi (CATEGORY veya SUBCATEGORY seviyesinde) */}
          {(selectedLevel === "CATEGORY" || selectedLevel === "SUBCATEGORY") && selectedSurvey && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Kategori *</label>
              <select
                value={selectedCategory}
                onChange={(e) => { 
                  setSelectedCategory(e.target.value);
                  setSelectedSubCategory("");
                }}
                className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
              >
                <option value="">Kategori Seçin</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Alt Kategori Seçimi (Sadece SUBCATEGORY seviyesinde) */}
          {selectedLevel === "SUBCATEGORY" && selectedCategory && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Alt Kategori *</label>
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
              >
                <option value="">Alt Kategori Seçin</option>
                {subCategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Sektör Seçimi */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1 flex items-center gap-1">
              <Factory size={14} />
              Sektör *
            </label>
            <select
              value={selectedSector}
              onChange={(e) => { setSelectedSector(e.target.value); setSelectedSubSector(""); }}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
            >
              <option value="">Sektör Seçin</option>
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 6. Alt Sektör Seçimi (Opsiyonel) */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
              Alt Sektör <span className="text-[var(--text-dim)]">(Opsiyonel)</span>
            </label>
            <select
              value={selectedSubSector}
              onChange={(e) => setSelectedSubSector(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
              disabled={!selectedSector}
            >
              <option value="">Tüm Alt Sektörler (Genel)</option>
              {selectedSectorData?.subSectors.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
            <p className="text-xs text-[var(--text-dim)] mt-1">Seçilmezse tüm alt sektörlerde geçerli olur</p>
          </div>

          {/* 7. En İyi Puan */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">En İyi Puan (0-5) *</label>
            <input
              type="number"
              value={bestScore}
              onChange={(e) => setBestScore(parseFloat(e.target.value) || 0)}
              min="0"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>

          {/* 8. Ortalama Puan */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Ortalama Puan (0-5) *</label>
            <input
              type="number"
              value={averageScore}
              onChange={(e) => setAverageScore(parseFloat(e.target.value) || 0)}
              min="0"
              max="5"
              step="0.1"
              className="w-full px-3 py-2 border border-[var(--border-soft)] rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !selectedSurvey || !selectedSector}
          className="text-[var(--bg-deep)] font-medium"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-[var(--bg-deep)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save size={20} />
          )}
          Kaydet
        </Button>
      </div>

      {/* Existing Benchmarks */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden border border-[var(--border-soft)]">
        <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--bg-card-2)]">
          <h2 className="text-lg font-semibold text-[var(--text-main)] flex items-center gap-2">
            <BarChart3 size={20} className="text-[var(--accent)]" />
            Mevcut Benchmark Verileri
          </h2>
        </div>

        {filteredBenchmarks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-card-2)]">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Anket</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Sektör</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Alt Sektör</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Seviye</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-muted)]">Hedef</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">En İyi</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">Ortalama</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-muted)]">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {filteredBenchmarks.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--bg-card-2)] transition-colors">
                    <td className="px-4 py-3 text-sm text-[var(--accent)]">{b.survey?.name || "-"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-main)]">{b.sector?.name}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{b.subSector?.name || "Tüm"}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        b.level === "OVERALL" ? "bg-[var(--bg-card-2)] text-[var(--accent)]" :
                        b.level === "CATEGORY" ? "bg-[var(--accent)]/15 text-[var(--accent)]" :
                        "bg-[var(--accent-soft)] text-[var(--accent)]"
                      }`}>
                        {b.level === "OVERALL" ? "Genel" : b.level === "CATEGORY" ? "Kategori" : "Alt Kategori"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{getTargetName(b)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-[var(--accent)]/15 text-[var(--accent)] rounded font-medium">{b.bestScore.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-[var(--bg-card-2)] text-[var(--text-muted)] rounded font-medium">{b.averageScore.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="p-1 text-[var(--error)] hover:bg-[var(--error-bg)] rounded transition-colors"
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
            <BarChart3 size={48} className="mx-auto text-[var(--ui-passive)] mb-4" />
            <p className="text-[var(--text-dim)]">Henüz benchmark verisi girilmemiş</p>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              {selectedSurvey || selectedSector ? "Seçili filtreler için veri bulunamadı" : "Yukarıdaki formu kullanarak veri ekleyin"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
