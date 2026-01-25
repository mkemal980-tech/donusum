"use client";

import { useEffect, useState } from "react";
import { Save, AlertCircle, CheckCircle, RefreshCw, FileText } from "lucide-react";

interface Sector {
  id: string;
  name: string;
}

interface Survey {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  surveyId: string | null;
}

interface WeightEntry {
  categoryId: string;
  weight: number;
}

export default function SectorWeightsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedSurvey, setSelectedSurvey] = useState<string>("");
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sectorsRes, surveysRes, categoriesRes] = await Promise.all([
          fetch("/api/admin/sectors"),
          fetch("/api/admin/surveys"),
          fetch("/api/admin/categories"),
        ]);
        const sectorsData = await sectorsRes.json();
        const surveysData = await surveysRes.json();
        const categoriesData = await categoriesRes.json();
        setSectors(sectorsData || []);
        setSurveys(surveysData || []);
        setCategories(categoriesData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter categories by selected survey
  const filteredCategories = selectedSurvey
    ? categories.filter((cat) => cat.surveyId === selectedSurvey)
    : [];

  // Fetch weights when sector and survey are selected
  useEffect(() => {
    if (selectedSector && selectedSurvey && filteredCategories.length > 0) {
      fetchWeightsForSectorAndSurvey(selectedSector, selectedSurvey);
    } else {
      setWeights([]);
    }
  }, [selectedSector, selectedSurvey, filteredCategories.length]);

  const fetchWeightsForSectorAndSurvey = async (sectorId: string, surveyId: string) => {
    try {
      const res = await fetch(`/api/admin/sector-weights?sectorId=${sectorId}&surveyId=${surveyId}`);
      const data = await res.json();
      
      // Initialize weights - use existing or default to equal distribution
      const existingWeights = new Map<string, number>(
        data.map((w: { categoryId: string; weight: number }) => [w.categoryId, w.weight])
      );
      const defaultWeight = filteredCategories.length > 0 ? 1 / filteredCategories.length : 0;
      
      const initialWeights: WeightEntry[] = filteredCategories.map((cat) => ({
        categoryId: cat.id,
        weight: existingWeights.get(cat.id) ?? defaultWeight,
      }));
      
      setWeights(initialWeights);
    } catch (error) {
      console.error("Error fetching weights:", error);
    }
  };

  const handleWeightChange = (categoryId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setWeights((prev) =>
      prev.map((w) =>
        w.categoryId === categoryId ? { ...w, weight: numValue / 100 } : w
      )
    );
  };

  const distributeEqually = () => {
    const equalWeight = filteredCategories.length > 0 ? 1 / filteredCategories.length : 0;
    setWeights(filteredCategories.map((cat) => ({ categoryId: cat.id, weight: equalWeight })));
  };

  const handleSave = async () => {
    if (!selectedSector || !selectedSurvey) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/sector-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectorId: selectedSector, surveyId: selectedSurvey, weights }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Kaydetme başarısız" });
      } else {
        setMessage({ type: "success", text: "Ağırlıklar başarıyla kaydedildi" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Bir hata oluştu" });
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const isValidTotal = Math.abs(totalWeight - 1) <= 0.01;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Sektör Ağırlıklandırması</h1>
        <p className="text-[var(--text-muted)] mt-1">
          Her sektör ve anket için kategori ağırlıklarını belirleyin. Genel puan bu ağırlıklara göre hesaplanır.
        </p>
      </div>

      {/* Selection Area */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Survey Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
              <FileText size={16} className="inline mr-2" />
              Anket Seçin
            </label>
            <select
              value={selectedSurvey}
              onChange={(e) => {
                setSelectedSurvey(e.target.value);
                setWeights([]);
                setMessage(null);
              }}
              className="w-full px-4 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            >
              <option value="">-- Anket Seçin --</option>
              {surveys.map((survey) => (
                <option key={survey.id} value={survey.id}>
                  {survey.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sector Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Sektör Seçin</label>
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setMessage(null);
              }}
              className="w-full px-4 py-2 border border-[var(--border-soft)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              disabled={!selectedSurvey}
            >
              <option value="">-- Sektör Seçin --</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSurvey && !selectedSector && (
          <p className="mt-4 text-amber-400 text-sm">Şimdi sektör seçin.</p>
        )}
      </div>

      {/* Weights Configuration */}
      {selectedSector && selectedSurvey && filteredCategories.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-main)]">Kategori Ağırlıkları</h2>
              <p className="text-sm text-[var(--text-dim)] mt-1">
                {surveys.find(s => s.id === selectedSurvey)?.name} anketi için
              </p>
            </div>
            <button
              onClick={distributeEqually}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--accent)] hover:bg-[var(--bg-card-2)] rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Eşit Dağıt
            </button>
          </div>

          <div className="space-y-4">
            {filteredCategories.map((category) => {
              const weightEntry = weights.find((w) => w.categoryId === category.id);
              const weightPercent = (weightEntry?.weight || 0) * 100;

              return (
                <div
                  key={category.id}
                  className="flex items-center gap-4 p-4 bg-[var(--bg-card-2)] rounded-lg"
                >
                  <div className="flex-1">
                    <span className="font-medium text-[var(--text-main)]">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={weightPercent.toFixed(0)}
                      onChange={(e) => handleWeightChange(category.id, e.target.value)}
                      className="w-20 px-3 py-2 border border-[var(--border-soft)] rounded-lg text-center focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                    <span className="text-[var(--text-dim)]">%</span>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-[var(--border-soft)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${Math.min(weightPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-6 pt-6 border-t border-[var(--border-soft)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--text-main)]">Toplam:</span>
                <span
                  className={`text-lg font-bold ${
                    isValidTotal ? "text-[var(--accent)]" : "text-red-400"
                  }`}
                >
                  {(totalWeight * 100).toFixed(1)}%
                </span>
                {isValidTotal ? (
                  <CheckCircle className="text-[var(--accent)]" size={20} />
                ) : (
                  <AlertCircle className="text-red-400" size={20} />
                )}
              </div>
              {!isValidTotal && (
                <p className="text-sm text-red-400">Toplam ağırlık 100% olmalıdır</p>
              )}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-[rgba(12,193,195,0.1)] text-[var(--accent)]"
                  : "bg-[rgba(239,68,68,0.1)] text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={saving || !isValidTotal}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedSector && selectedSurvey && filteredCategories.length === 0 && (
        <div className="bg-[rgba(245,158,11,0.1)] border border-amber-500/50 rounded-xl p-6 text-center">
          <p className="text-amber-400">Bu ankete ait kategori bulunamadı.</p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-[var(--bg-card-2)] border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-[var(--accent)] mb-2">Nasıl Çalışır?</h3>
        <ul className="text-sm text-[var(--text-muted)] space-y-2">
          <li>• Önce anketi, sonra sektörü seçin.</li>
          <li>• Her sektör ve anket kombinasyonu için farklı kategori ağırlıkları tanımlayabilirsiniz.</li>
          <li>• Ağırlıkların toplamı 100% olmalıdır.</li>
          <li>• Eğer bir sektör için ağırlık tanımlanmamışsa, tüm kategoriler eşit ağırlıkla hesaplanır.</li>
          <li>
            • <strong>Örnek:</strong> Çevre: 30%, Sosyal: 20%, Yönetişim: 50%
          </li>
        </ul>
      </div>
    </div>
  );
}
