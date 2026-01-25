"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, FileText, X, Save, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

interface Survey {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  order: number;
  _count: {
    categories: number;
  };
  categories: {
    id: string;
    name: string;
    _count: {
      subCategories: number;
    };
  }[];
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Survey | null>(null);
  const [formData, setFormData] = useState<Partial<Survey>>({});

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/admin/surveys');
      const data = await res.json();
      setSurveys(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSurveys(); }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/admin/surveys', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchSurveys();
      setShowModal(false);
      setEditItem(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu anketi ve tüm içeriğini silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/api/admin/surveys?id=${id}`, { method: 'DELETE' });
      fetchSurveys();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const openModal = (survey?: Survey) => {
    if (survey) {
      setEditItem(survey);
      setFormData(survey);
    } else {
      setEditItem(null);
      setFormData({ order: surveys.length + 1, isActive: true });
    }
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1e3a8a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Anket Yönetimi</h1>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998]"
        >
          <Plus size={20} /> Yeni Anket
        </button>
      </div>

      {/* Survey List */}
      <div className="grid gap-4">
        {surveys.map((survey) => (
          <div key={survey.id} className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1e3a8a] rounded-lg flex items-center justify-center">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-main)]">{survey.name}</h3>
                    {survey.isActive ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        <CheckCircle size={12} /> Aktif
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-card-2)] text-[var(--text-dim)] rounded text-xs">
                        <XCircle size={12} /> Pasif
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-dim)]">{survey.description || 'Açıklama yok'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#1e3a8a]">{survey._count.categories}</p>
                  <p className="text-xs text-[var(--text-dim)]">Kategori</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/categories?surveyId=${survey.id}`}
                    className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]" 
                    title="Kategorileri Yönet"
                  >
                    <FileText size={18} />
                  </Link>
                  <button 
                    onClick={() => openModal(survey)} 
                    className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]" 
                    title="Düzenle"
                  >
                    <Edit size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(survey.id)} 
                    className="p-2 hover:bg-red-100 rounded text-red-600" 
                    title="Sil"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Categories Preview */}
            {survey.categories.length > 0 && (
              <div className="p-4 bg-[var(--bg-card-2)]">
                <p className="text-xs text-[var(--text-dim)] mb-2">Kategoriler:</p>
                <div className="flex flex-wrap gap-2">
                  {survey.categories.map((cat) => (
                    <span key={cat.id} className="px-3 py-1 bg-[var(--bg-card)] border rounded-full text-sm text-[var(--text-muted)]">
                      {cat.name} ({cat._count.subCategories} alt kategori)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {surveys.length === 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-8 text-center">
            <FileText className="mx-auto text-[var(--text-dim)] mb-4" size={48} />
            <p className="text-[var(--text-dim)] mb-4">Henüz anket oluşturulmamış</p>
            <button
              onClick={() => openModal()}
              className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998]"
            >
              İlk Anketi Oluştur
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{editItem ? 'Anket Düzenle' : 'Yeni Anket'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Anket Adı</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  placeholder="Örn: 2025 Dijital Dönüşüm Anketi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Açıklama</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  rows={3}
                  placeholder="Anketin amacını ve kapsamını açıklayın"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sıra</label>
                  <input
                    type="number"
                    value={formData.order || 1}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive ?? true}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 text-[#1e3a8a] rounded"
                    />
                    <span className="text-sm text-[var(--text-muted)]">Aktif</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] flex items-center gap-2"
              >
                <Save size={18} />
                {editItem ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
