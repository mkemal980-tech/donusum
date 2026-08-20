"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X, Activity, Factory, Layers, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Sector {
  id: string;
  name: string;
  subSectors: SubSector[];
}

interface SubSector {
  id: string;
  name: string;
}

interface IronmanBenchmark {
  id: string;
  sectorId: string;
  subSectorId: string | null;
  velocityAverage: number;
  velocityBest: number;
  enduranceAverage: number;
  enduranceBest: number;
  velocityAverageTarget: number;
  enduranceAverageTarget: number;
  sector: { id: string; name: string };
  subSector: { id: string; name: string } | null;
}

export default function IronmanBenchmarksPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [benchmarks, setBenchmarks] = useState<IronmanBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<IronmanBenchmark | null>(null);
  const [formData, setFormData] = useState({
    sectorId: '',
    subSectorId: '',
    velocityAverage: 2.5,
    velocityBest: 4.5,
    enduranceAverage: 2.5,
    enduranceBest: 4.5,
    velocityAverageTarget: 3.0,
    enduranceAverageTarget: 3.0,
    applyToAllSubSectors: false,
  });
  const [saving, setSaving] = useState(false);

  const fetchSectors = async () => {
    try {
      const res = await fetch('/api/admin/sectors');
      const data = await res.json();
      setSectors(data || []);
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  };

  const fetchBenchmarks = async () => {
    try {
      const res = await fetch('/api/admin/ironman-benchmarks');
      const data = await res.json();
      setBenchmarks(data || []);
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectors();
    fetchBenchmarks();
  }, []);

  const openModal = (benchmark?: IronmanBenchmark) => {
    if (benchmark) {
      setEditItem(benchmark);
      setFormData({
        sectorId: benchmark.sectorId,
        subSectorId: benchmark.subSectorId || '',
        velocityAverage: benchmark.velocityAverage,
        velocityBest: benchmark.velocityBest,
        enduranceAverage: benchmark.enduranceAverage,
        enduranceBest: benchmark.enduranceBest,
        velocityAverageTarget: benchmark.velocityAverageTarget || 3.0,
        enduranceAverageTarget: benchmark.enduranceAverageTarget || 3.0,
        applyToAllSubSectors: false,
      });
    } else {
      setEditItem(null);
      setFormData({
        sectorId: '',
        subSectorId: '',
        velocityAverage: 2.5,
        velocityBest: 4.5,
        enduranceAverage: 2.5,
        enduranceBest: 4.5,
        velocityAverageTarget: 3.0,
        enduranceAverageTarget: 3.0,
        applyToAllSubSectors: false,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        sectorId: formData.sectorId,
        subSectorId: formData.applyToAllSubSectors ? null : (formData.subSectorId || null),
        velocityAverage: formData.velocityAverage,
        velocityBest: formData.velocityBest,
        enduranceAverage: formData.enduranceAverage,
        enduranceBest: formData.enduranceBest,
        velocityAverageTarget: formData.velocityAverageTarget,
        enduranceAverageTarget: formData.enduranceAverageTarget,
        applyToAllSubSectors: formData.applyToAllSubSectors,
        id: editItem?.id,
      };

      const res = await fetch('/api/admin/ironman-benchmarks', {
        method: editItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.createdCount) {
          alert(`✅ ${result.createdCount} alt sektör için benchmark oluşturuldu!`);
        }
        fetchBenchmarks();
        setShowModal(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Hata oluştu');
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu benchmark verisini silmek istediğinizden emin misiniz?')) return;
    
    try {
      await fetch(`/api/admin/ironman-benchmarks?id=${id}`, { method: 'DELETE' });
      fetchBenchmarks();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const selectedSector = sectors.find(s => s.id === formData.sectorId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" role="status" aria-label="Yükleniyor" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="t-display" style={{ color: "var(--ink)" }}>
            Ironman benchmark
          </h1>
          <p className="mt-1 t-sm" style={{ color: "var(--ink-2)" }}>
            Sektör bazlı hız (velocity) ve dayanıklılık (endurance) değerleri.
          </p>
        </div>
        <Button
          onClick={() => openModal()}
        >
          <Plus size={20} /> Yeni Benchmark
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-[var(--bg-card-2)] border border-[var(--blue-main)] rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-[var(--accent)] mb-2">Ironman Analizi Nedir?</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-[var(--text-muted)]">
          <div>
            <strong className="text-[var(--accent)]">Velocity (X Ekseni):</strong> Şirketin hızını ve aksiyon alma kapasitesini ölçer.
            <br /><span className="text-xs text-[var(--text-dim)]">(Inisiyatifler, projeler, hedefler)</span>
          </div>
          <div>
            <strong className="text-[var(--accent)]">Endurance (Y Ekseni):</strong> Şirketin olgunluğunu ve sürdürülebilirliğini ölçer.
            <br /><span className="text-xs text-[var(--text-dim)]">(Politikalar, izleme, raporlama)</span>
          </div>
        </div>
        {/* Dört kadran bir ölçek değil, bir sınıflama; iyi/kötü demeyen
            nötr bir yüzey üzerinde nokta rengiyle ayrılır. */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { name: "Walker", hint: "düşük hız + düşük olgunluk", dot: "var(--ink-3)" },
            { name: "Sprinter", hint: "yüksek hız + düşük olgunluk", dot: "var(--accent)" },
            { name: "Maraton koşucusu", hint: "düşük hız + yüksek olgunluk", dot: "var(--series-4)" },
            { name: "Demir adam", hint: "yüksek hız + yüksek olgunluk", dot: "var(--series-2)" },
          ].map((q) => (
            <div
              key={q.name}
              className="rounded-[var(--radius-xs)] p-3"
              style={{ background: "var(--surface-2)" }}
            >
              <p className="flex items-center gap-2 t-sm font-medium" style={{ color: "var(--ink)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: q.dot }} aria-hidden="true" />
                {q.name}
              </p>
              <p className="mt-0.5 t-sm" style={{ color: "var(--ink-3)" }}>
                {q.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark Table */}
      <div className="theme-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="theme-table">
            <thead>
              <tr>
                <th>Sektör</th>
                <th>Alt Sektör</th>
                <th className="text-center">V. Ort.</th>
                <th className="text-center">V. Best</th>
                <th className="text-center">V. Target</th>
                <th className="text-center">E. Ort.</th>
                <th className="text-center">E. Best</th>
                <th className="text-center">E. Target</th>
                <th className="text-center">Işlemler</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((benchmark) => (
                <tr key={benchmark.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Factory size={16} className="text-[var(--text-dim)]" />
                      <span className="font-medium text-[var(--text-main)]">{benchmark.sector.name}</span>
                    </div>
                  </td>
                  <td>
                    {benchmark.subSector ? (
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[var(--text-dim)]" />
                        <span className="text-[var(--text-muted)]">{benchmark.subSector.name}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-dim)] text-sm">Tüm alt sektörler</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--info-bg)] text-[var(--accent-ink)] font-semibold text-sm">
                      {benchmark.velocityAverage.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--info-bg)] text-[var(--blue-dark)] font-semibold text-sm">
                      {benchmark.velocityBest.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent)] font-semibold text-sm">
                      {(benchmark.velocityAverageTarget || 3.0).toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent-quiet)] text-[var(--accent-ink)] font-semibold text-sm">
                      {benchmark.enduranceAverage.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent-quiet)] text-[var(--accent-ink)] font-semibold text-sm">
                      {benchmark.enduranceBest.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent)] font-semibold text-sm">
                      {(benchmark.enduranceAverageTarget || 3.0).toFixed(1)}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        onClick={() => openModal(benchmark)}
                        title="Düzenle"
                        variant="ghost"
                        size="icon"
                        className="text-[var(--blue-main)]"
                      >
                        <Edit size={18} />
                      </Button>
                      <Button
                        onClick={() => handleDelete(benchmark.id)}
                        title="Sil"
                        variant="ghost"
                        size="icon"
                        className="hover:bg-[var(--error-bg)] text-[var(--error-ink)]"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {benchmarks.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-dim)]">
                    Henüz benchmark verisi eklenmemiş. "Yeni Benchmark" butonunu kullanarak ekleyin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-main)]">
                {editItem ? 'Benchmark Düzenle' : 'Yeni Ironman Benchmark'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sektör Seçimi */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sektör *</label>
                <select
                  value={formData.sectorId}
                  onChange={(e) => setFormData({ ...formData, sectorId: e.target.value, subSectorId: '' })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  disabled={!!editItem}
                >
                  <option value="">Sektör seçin</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>{sector.name}</option>
                  ))}
                </select>
              </div>

              {/* Tüm Alt Sektörlere Uygula Checkbox */}
              {formData.sectorId && selectedSector?.subSectors && selectedSector.subSectors.length > 0 && !editItem && (
                <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning)]/50 rounded-lg">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applyToAllSubSectors}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        applyToAllSubSectors: e.target.checked,
                        subSectorId: e.target.checked ? '' : formData.subSectorId
                      })}
                      className="w-5 h-5 mt-0.5 text-[var(--warning)] border-[var(--warning)]/50 rounded focus:ring-[var(--accent)]"
                    />
                    <div>
                      <span className="font-semibold text-[var(--warning)]">Tüm alt sektörlere ayrı ayrı uygula</span>
                      <p className="text-xs text-[var(--warning)] mt-1">
                        İşaretlerseniz, seçilen sektörün tüm alt sektörlerine ({selectedSector.subSectors.length} adet) 
                        aynı benchmark değerleri ile ayrı kayıtlar oluşturulur.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Alt Sektör Seçimi */}
              {!formData.applyToAllSubSectors && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Alt Sektör (Opsiyonel)</label>
                  <select
                    value={formData.subSectorId}
                    onChange={(e) => setFormData({ ...formData, subSectorId: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    disabled={!!editItem || !formData.sectorId}
                  >
                    <option value="">Tüm alt sektörler için (genel)</option>
                    {selectedSector?.subSectors?.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Velocity Değerleri */}
              <div className="p-4 bg-[var(--info-bg)] rounded-lg">
                <h3 className="font-semibold text-[var(--blue-dark)] mb-3 flex items-center gap-2">
                  <Target size={16} /> Velocity (Hız) Değerleri
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--blue-main)] mb-1">Sektör Ort.</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.velocityAverage}
                      onChange={(e) => setFormData({ ...formData, velocityAverage: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--blue-main)] mb-1">Sektör En İyi</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.velocityBest}
                      onChange={(e) => setFormData({ ...formData, velocityBest: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--accent)] mb-1">Ort. Hedef</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.velocityAverageTarget}
                      onChange={(e) => setFormData({ ...formData, velocityAverageTarget: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Endurance Değerleri */}
              <div className="p-4 bg-[var(--accent-quiet)] rounded-lg">
                <h3 className="font-semibold text-[var(--accent)] mb-3 flex items-center gap-2">
                  <Target size={16} /> Endurance (Olgunluk) Değerleri
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--accent)] mb-1">Sektör Ort.</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.enduranceAverage}
                      onChange={(e) => setFormData({ ...formData, enduranceAverage: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--accent)] mb-1">Sektör En İyi</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.enduranceBest}
                      onChange={(e) => setFormData({ ...formData, enduranceBest: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--accent)] mb-1">Ort. Hedef</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.enduranceAverageTarget}
                      onChange={(e) => setFormData({ ...formData, enduranceAverageTarget: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Info */}
              <p className="text-xs text-[var(--text-dim)] text-center">
                Tüm değerler 1-5 arasında olmalıdır. "Ort. Hedef" sektörün gelecek yıl için beklenen ortalama değeridir.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowModal(false)}
                variant="outline"
                className="text-[var(--text-muted)]"
              >
                İptal
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formData.sectorId}
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
