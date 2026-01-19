"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Save, X, Search, FileText } from "lucide-react";

interface Survey {
  id: string;
  name: string;
}

interface SubLevel {
  id: string;
  name: string;
}

interface SubCategory {
  id: string;
  name: string;
  subLevels: SubLevel[];
}

interface Category {
  id: string;
  name: string;
  surveyId: string | null;
  subCategories: SubCategory[];
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  subLevelId: string | null;
  subLevel?: { 
    name: string; 
    subCategory?: { 
      name: string; 
      category?: { 
        name: string;
        surveyId?: string;
      } 
    } 
  };
  costType: 'CAPEX' | 'OPEX';
  timeframe: 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';
  strategicType: 'QUICK_WIN' | 'PROJECT' | 'BIG_BET';
  estimatedImpact: number;
  minScoreThreshold: number;
  maxScoreThreshold: number;
  order: number;
}

const costTypes = [
  { value: 'CAPEX', label: 'CAPEX (Yatırım)' },
  { value: 'OPEX', label: 'OPEX (İşletme)' },
];

const timeframes = [
  { value: 'SHORT_TERM', label: 'Kısa Vade (0-6 ay)' },
  { value: 'MEDIUM_TERM', label: 'Orta Vade (6-18 ay)' },
  { value: 'LONG_TERM', label: 'Uzun Vade (18+ ay)' },
];

const strategicTypes = [
  { value: 'QUICK_WIN', label: 'Hızlı Kazanım' },
  { value: 'PROJECT', label: 'Proje' },
  { value: 'BIG_BET', label: 'Büyük Yatırım' },
];

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Recommendation | null>(null);
  const [formData, setFormData] = useState<Partial<Recommendation>>({});
  const [search, setSearch] = useState('');
  const [filterSurvey, setFilterSurvey] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const fetchData = async () => {
    try {
      const [recRes, surveyRes, catRes] = await Promise.all([
        fetch('/api/admin/recommendations'),
        fetch('/api/admin/surveys'),
        fetch('/api/admin/categories')
      ]);
      const recs = await recRes.json();
      const survs = await surveyRes.json();
      const cats = await catRes.json();
      setRecommendations(recs || []);
      setSurveys(survs || []);
      setCategories(cats || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/admin/recommendations', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchData();
      setShowModal(false);
      setEditItem(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu öneriyi silmek istediğinizden emin misiniz?')) return;
    try {
      await fetch(`/api/admin/recommendations?id=${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const openModal = (rec?: Recommendation) => {
    if (rec) {
      setEditItem(rec);
      setFormData(rec);
    } else {
      setEditItem(null);
      setFormData({ 
        order: recommendations.length + 1, 
        estimatedImpact: 5, 
        costType: 'OPEX', 
        timeframe: 'SHORT_TERM', 
        strategicType: 'QUICK_WIN',
        minScoreThreshold: 0,
        maxScoreThreshold: 70
      });
    }
    setShowModal(true);
  };

  // Ankete göre filtrelenmiş kategoriler
  const filteredCategories = filterSurvey 
    ? categories.filter(c => c.surveyId === filterSurvey)
    : categories;

  // Tüm alt seviyeleri düz liste halinde getir (ankete göre filtrelenerek)
  const getAllSubLevels = (surveyId?: string) => {
    const subLevels: { id: string; name: string; fullPath: string; surveyId: string | null }[] = [];
    const catsToUse = surveyId ? categories.filter(c => c.surveyId === surveyId) : categories;
    catsToUse.forEach(cat => {
      cat.subCategories?.forEach(subCat => {
        subCat.subLevels?.forEach(subLevel => {
          subLevels.push({
            id: subLevel.id,
            name: subLevel.name,
            fullPath: `${cat.name} > ${subCat.name} > ${subLevel.name}`,
            surveyId: cat.surveyId
          });
        });
      });
    });
    return subLevels;
  };

  // Önerileri filtrele
  const filteredRecs = recommendations.filter(rec => {
    const matchSearch = rec.title.toLowerCase().includes(search.toLowerCase()) || 
                        rec.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || rec.categoryId === filterCategory;
    
    // Anket filtresi: önerinin subLevel'in kategorisinin surveyId'si eşleşmeli
    let matchSurvey = true;
    if (filterSurvey) {
      if (rec.subLevel?.subCategory?.category?.surveyId) {
        matchSurvey = rec.subLevel.subCategory.category.surveyId === filterSurvey;
      } else if (rec.categoryId) {
        const cat = categories.find(c => c.id === rec.categoryId);
        matchSurvey = cat?.surveyId === filterSurvey;
      } else {
        // Genel öneriler (özel bir ankete bağlı değil)
        matchSurvey = false;
      }
    }
    
    return matchSearch && matchCategory && matchSurvey;
  });

  // Anket adını bul
  const getSurveyName = (rec: Recommendation) => {
    if (rec.subLevel?.subCategory?.category?.surveyId) {
      const survey = surveys.find(s => s.id === rec.subLevel?.subCategory?.category?.surveyId);
      return survey?.name;
    }
    if (rec.categoryId) {
      const cat = categories.find(c => c.id === rec.categoryId);
      if (cat?.surveyId) {
        const survey = surveys.find(s => s.id === cat.surveyId);
        return survey?.name;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Öneri Yönetimi</h1>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} /> Yeni Öneri
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Öneri ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={filterSurvey}
            onChange={(e) => {
              setFilterSurvey(e.target.value);
              setFilterCategory(''); // Anket değişince kategori filtresini sıfırla
            }}
            className="px-4 py-2 border rounded-lg min-w-[150px]"
          >
            <option value="">Tüm Anketler</option>
            {surveys.map(survey => (
              <option key={survey.id} value={survey.id}>{survey.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg min-w-[150px]"
          >
            <option value="">Tüm Kategoriler</option>
            {filteredCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">Başlık</th>
              <th className="text-left p-4 font-semibold text-gray-700">Anket</th>
              <th className="text-left p-4 font-semibold text-gray-700">Alt Seviye / Kategori</th>
              <th className="text-left p-4 font-semibold text-gray-700">Puan Aralığı</th>
              <th className="text-left p-4 font-semibold text-gray-700">Tip</th>
              <th className="text-left p-4 font-semibold text-gray-700">Etki</th>
              <th className="text-right p-4 font-semibold text-gray-700">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecs.map((rec) => {
              const surveyName = getSurveyName(rec);
              return (
                <tr key={rec.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{rec.title}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{rec.description}</p>
                  </td>
                  <td className="p-4">
                    {surveyName ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center gap-1 w-fit">
                        <FileText size={12} />
                        {surveyName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {rec.subLevel ? (
                      <div>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm block mb-1">
                          {rec.subLevel.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {rec.subLevel.subCategory?.category?.name} &gt; {rec.subLevel.subCategory?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">Genel</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600">
                      %{rec.minScoreThreshold || 0} - %{rec.maxScoreThreshold || 100}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${rec.strategicType === 'QUICK_WIN' ? 'bg-green-100 text-green-700' : rec.strategicType === 'PROJECT' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {strategicTypes.find(t => t.value === rec.strategicType)?.label}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-gray-700">{rec.estimatedImpact}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => openModal(rec)} className="p-2 hover:bg-blue-100 rounded text-blue-600">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(rec.id)} className="p-2 hover:bg-red-100 rounded text-red-600">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRecs.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            {filterSurvey || filterCategory || search ? 'Öneri bulunamadı' : 'Henüz öneri eklenmemiş'}
          </p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editItem ? 'Öneri Düzenle' : 'Yeni Öneri'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                />
              </div>
              
              {/* Alt Seviye Seçimi */}
              <div className="p-4 bg-indigo-50 rounded-lg">
                <label className="block text-sm font-medium text-indigo-800 mb-2">Hedef Alt Seviye (Öneri Hangi Alana Gösterilsin?)</label>
                <select
                  value={formData.subLevelId || ''}
                  onChange={(e) => setFormData({ ...formData, subLevelId: e.target.value || null })}
                  className="w-full p-3 border rounded-lg bg-white"
                >
                  <option value="">Genel Öneri (Tüm kullanıcılara)</option>
                  {surveys.map(survey => (
                    <optgroup key={survey.id} label={survey.name}>
                      {getAllSubLevels(survey.id).map(sl => (
                        <option key={sl.id} value={sl.id}>{sl.fullPath}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-indigo-600 mt-2">
                  Bir alt seviye seçerseniz, bu öneri sadece o alanda düşük puan alan kullanıcılara gösterilir.
                </p>
              </div>

              {/* Puan Eşikleri */}
              <div className="p-4 bg-amber-50 rounded-lg">
                <label className="block text-sm font-medium text-amber-800 mb-2">Puan Aralığı (Bu öneri hangi puan aralığındaki kullanıcılara gösterilsin?)</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Minimum Puan (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.minScoreThreshold || 0}
                      onChange={(e) => setFormData({ ...formData, minScoreThreshold: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Maksimum Puan (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.maxScoreThreshold || 70}
                      onChange={(e) => setFormData({ ...formData, maxScoreThreshold: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  Örn: %0-30 arası çok düşük puanlılar için temel öneriler, %30-70 arası orta puanlılar için geliştirme önerileri.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maliyet Tipi</label>
                  <select
                    value={formData.costType || 'OPEX'}
                    onChange={(e) => setFormData({ ...formData, costType: e.target.value as any })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {costTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zaman Dilimi</label>
                  <select
                    value={formData.timeframe || 'SHORT_TERM'}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value as any })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {timeframes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stratejik Tip</label>
                  <select
                    value={formData.strategicType || 'QUICK_WIN'}
                    onChange={(e) => setFormData({ ...formData, strategicType: e.target.value as any })}
                    className="w-full p-3 border rounded-lg"
                  >
                    {strategicTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tahmini Etki (1-15)</label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={formData.estimatedImpact || 5}
                    onChange={(e) => setFormData({ ...formData, estimatedImpact: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
