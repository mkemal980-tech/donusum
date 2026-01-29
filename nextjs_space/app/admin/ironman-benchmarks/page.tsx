"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X, Activity, Factory, Layers, Target } from "lucide-react";

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
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-main)' }}>
            <Activity className="text-[var(--accent)]" />
            Ironman Benchmark Verileri
          </h1>
          <p className="text-[var(--text-dim)] mt-1">Sektör bazlı Velocity (Hız) ve Endurance (Olgunluk) değerlerini yönetin</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)]"
        >
          <Plus size={20} /> Yeni Benchmark
        </button>
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
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          <div className="bg-[rgba(239,68,68,0.15)] text-[var(--error)] p-2 rounded text-center">
            <strong>Walker</strong><br />Düşük Hız + Düşük Olgunluk
          </div>
          <div className="bg-[rgba(251,146,60,0.15)] text-orange-400 p-2 rounded text-center">
            <strong>Sprinter</strong><br />Yüksek Hız + Düşük Olgunluk
          </div>
          <div className="bg-[rgba(139,92,246,0.15)] text-purple-400 p-2 rounded text-center">
            <strong>Marathon Runner</strong><br />Düşük Hız + Yüksek Olgunluk
          </div>
          <div className="bg-[rgba(12,193,195,0.15)] text-[var(--accent)] p-2 rounded text-center">
            <strong>Iron Man</strong><br />Yüksek Hız + Yüksek Olgunluk
          </div>
        </div>
      </div>

      {/* Benchmark Table */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-card-2)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Sektör</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Alt Sektör</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--blue-main)]">V. Ort.</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--blue-main)]">V. Best</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--blue-main)]">V. Target</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-teal-400">E. Ort.</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-teal-400">E. Best</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-teal-400">E. Target</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-[var(--text-muted)]">Işlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)]">
              {benchmarks.map((benchmark) => (
                <tr key={benchmark.id} className="hover:bg-[var(--bg-card-2)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Factory size={16} className="text-[var(--text-dim)]" />
                      <span className="font-medium text-[var(--text-main)]">{benchmark.sector.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {benchmark.subSector ? (
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[var(--text-dim)]" />
                        <span className="text-[var(--text-muted)]">{benchmark.subSector.name}</span>
                      </div>
                    ) : (
                      <span className="text-[var(--text-dim)] text-sm">Tüm alt sektörler</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--info-bg)] text-[var(--blue-main)] font-semibold text-sm">
                      {benchmark.velocityAverage.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--info-bg)] text-[var(--blue-dark)] font-semibold text-sm">
                      {benchmark.velocityBest.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent)] font-semibold text-sm">
                      {(benchmark.velocityAverageTarget || 3.0).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-teal-100 text-teal-600 font-semibold text-sm">
                      {benchmark.enduranceAverage.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-teal-200 text-teal-700 font-semibold text-sm">
                      {benchmark.enduranceBest.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent)] font-semibold text-sm">
                      {(benchmark.enduranceAverageTarget || 3.0).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openModal(benchmark)}
                        className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]"
                        title="Düzenle"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(benchmark.id)}
                        className="p-2 hover:bg-[rgba(239,68,68,0.15)] rounded text-[var(--error)]"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
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
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
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
                <div className="p-4 bg-[rgba(245,158,11,0.1)] border border-[var(--warning)]/50 rounded-lg">
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
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Endurance Değerleri */}
              <div className="p-4 bg-teal-50 rounded-lg">
                <h3 className="font-semibold text-teal-700 mb-3 flex items-center gap-2">
                  <Target size={16} /> Endurance (Olgunluk) Değerleri
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-teal-600 mb-1">Sektör Ort.</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.enduranceAverage}
                      onChange={(e) => setFormData({ ...formData, enduranceAverage: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-600 mb-1">Sektör En İyi</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={formData.enduranceBest}
                      onChange={(e) => setFormData({ ...formData, enduranceBest: parseFloat(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
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
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
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
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-[var(--border-soft)] rounded-lg hover:bg-[var(--bg-card-2)] text-[var(--text-muted)]"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.sectorId}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)] disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
