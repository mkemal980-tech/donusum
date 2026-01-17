"use client";

import { useEffect, useState } from "react";
import { Save, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

interface Sector {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface WeightEntry {
  categoryId: string;
  weight: number;
}

export default function SectorWeightsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sectorsRes, categoriesRes] = await Promise.all([
          fetch("/api/admin/sectors"),
          fetch("/api/admin/categories"),
        ]);
        const sectorsData = await sectorsRes.json();
        const categoriesData = await categoriesRes.json();
        setSectors(sectorsData || []);
        setCategories(categoriesData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSector && categories.length > 0) {
      fetchWeightsForSector(selectedSector);
    }
  }, [selectedSector, categories]);

  const fetchWeightsForSector = async (sectorId: string) => {
    try {
      const res = await fetch(`/api/admin/sector-weights?sectorId=${sectorId}`);
      const data = await res.json();
      
      // Initialize weights - use existing or default to equal distribution
      const existingWeights = new Map<string, number>(
        data.map((w: { categoryId: string; weight: number }) => [w.categoryId, w.weight])
      );
      const defaultWeight = categories.length > 0 ? 1 / categories.length : 0;
      
      const initialWeights: WeightEntry[] = categories.map((cat) => ({
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
    const equalWeight = categories.length > 0 ? 1 / categories.length : 0;
    setWeights(categories.map((cat) => ({ categoryId: cat.id, weight: equalWeight })));
  };

  const handleSave = async () => {
    if (!selectedSector) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/sector-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectorId: selectedSector, weights }),
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
        <div className="w-10 h-10 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Sektör Ağırlıklandırması</h1>
        <p className="text-gray-600 mt-1">
          Her sektör için kategori ağırlıklarını belirleyin. Genel puan bu ağırlıklara göre hesaplanır.
        </p>
      </div>

      {/* Sector Selection */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Sektör Seçin</label>
        <select
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="w-full md:w-96 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
        >
          <option value="">-- Sektör Seçin --</option>
          {sectors.map((sector) => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>

      {/* Weights Configuration */}
      {selectedSector && categories.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-800">Kategori Ağırlıkları</h2>
            <button
              onClick={distributeEqually}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Eşit Dağıt
            </button>
          </div>

          <div className="space-y-4">
            {categories.map((category) => {
              const weightEntry = weights.find((w) => w.categoryId === category.id);
              const weightPercent = (weightEntry?.weight || 0) * 100;

              return (
                <div
                  key={category.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={weightPercent.toFixed(0)}
                      onChange={(e) => handleWeightChange(category.id, e.target.value)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <div className="w-32">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1e3a8a] transition-all duration-300"
                        style={{ width: `${Math.min(weightPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">Toplam:</span>
                <span
                  className={`text-lg font-bold ${
                    isValidTotal ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {(totalWeight * 100).toFixed(1)}%
                </span>
                {isValidTotal ? (
                  <CheckCircle className="text-green-600" size={20} />
                ) : (
                  <AlertCircle className="text-red-600" size={20} />
                )}
              </div>
              {!isValidTotal && (
                <p className="text-sm text-red-600">Toplam ağırlık 100% olmalıdır</p>
              )}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
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
              className="flex items-center gap-2 px-6 py-3 bg-[#1e3a8a] text-white rounded-lg font-medium hover:bg-[#3b5998] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-[#1e3a8a] mb-2">Nasıl Çalışır?</h3>
        <ul className="text-sm text-gray-700 space-y-2">
          <li>• Her sektör için farklı kategori ağırlıkları tanımlayabilirsiniz.</li>
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
