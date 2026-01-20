"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, X, Search, FileText, DollarSign, Target, Layers, FolderTree } from "lucide-react";

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
  hasSubLevels: boolean;
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
  subCategoryId: string | null;
  subLevelId: string | null;
  subCategory?: { 
    name: string; 
    category?: { 
      name: string;
      surveyId?: string;
    } 
  };
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
  xPosition: number;
  yPosition: number;
  capexLevel: number;
  opexLevel: number;
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
  { value: 'QUICK_WIN', label: 'Hızlı Kazanım', color: 'bg-green-100 text-green-700' },
  { value: 'PROJECT', label: 'Proje', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'BIG_BET', label: 'Büyük Yatırım', color: 'bg-red-100 text-red-700' },
];

const DollarIndicator = ({ level, max = 5 }: { level: number; max?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <DollarSign 
        key={i} 
        size={14} 
        className={i < level ? 'text-green-600' : 'text-gray-300'} 
      />
    ))}
  </div>
);

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

  // Modal için ek state'ler
  const [modalSurveyId, setModalSurveyId] = useState('');
  const [modalCategoryId, setModalCategoryId] = useState('');
  const [modalSubCategoryId, setModalSubCategoryId] = useState('');
  const [modalSubLevelId, setModalSubLevelId] = useState('');

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
      const dataToSave = {
        ...formData,
        subCategoryId: modalSubLevelId ? null : (modalSubCategoryId || null),
        subLevelId: modalSubLevelId || null,
      };
      
      await fetch('/api/admin/recommendations', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      fetchData();
      setShowModal(false);
      setEditItem(null);
      setFormData({});
      resetModalSelections();
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

  const resetModalSelections = () => {
    setModalSurveyId('');
    setModalCategoryId('');
    setModalSubCategoryId('');
    setModalSubLevelId('');
  };

  const openModal = (rec?: Recommendation) => {
    if (rec) {
      setEditItem(rec);
      setFormData(rec);
      
      // Mevcut seçimleri belirle
      if (rec.subLevel?.subCategory?.category?.surveyId) {
        const surveyId = rec.subLevel.subCategory.category.surveyId;
        setModalSurveyId(surveyId);
        
        const cat = categories.find(c => c.surveyId === surveyId && 
          c.subCategories.some(sc => sc.subLevels.some(sl => sl.id === rec.subLevelId)));
        if (cat) {
          setModalCategoryId(cat.id);
          const subCat = cat.subCategories.find(sc => sc.subLevels.some(sl => sl.id === rec.subLevelId));
          if (subCat) {
            setModalSubCategoryId(subCat.id);
            setModalSubLevelId(rec.subLevelId || '');
          }
        }
      } else if (rec.subCategory?.category?.surveyId) {
        const surveyId = rec.subCategory.category.surveyId;
        setModalSurveyId(surveyId);
        
        const cat = categories.find(c => c.surveyId === surveyId && 
          c.subCategories.some(sc => sc.id === rec.subCategoryId));
        if (cat) {
          setModalCategoryId(cat.id);
          setModalSubCategoryId(rec.subCategoryId || '');
        }
      }
    } else {
      setEditItem(null);
      setFormData({ 
        order: recommendations.length + 1, 
        estimatedImpact: 5, 
        costType: 'OPEX', 
        timeframe: 'SHORT_TERM', 
        strategicType: 'QUICK_WIN',
        minScoreThreshold: 0,
        maxScoreThreshold: 70,
        xPosition: 5,
        yPosition: 5,
        capexLevel: 1,
        opexLevel: 1
      });
      resetModalSelections();
    }
    setShowModal(true);
  };

  // Ankete göre filtrelenmiş kategoriler
  const filteredCategories = filterSurvey 
    ? categories.filter(c => c.surveyId === filterSurvey)
    : categories;

  // Modal için filtrelenmiş veriler
  const modalCategories = modalSurveyId 
    ? categories.filter(c => c.surveyId === modalSurveyId)
    : [];
  
  const modalSubCategories = modalCategoryId
    ? modalCategories.find(c => c.id === modalCategoryId)?.subCategories || []
    : [];
  
  const selectedSubCategory = modalSubCategoryId
    ? modalSubCategories.find(sc => sc.id === modalSubCategoryId)
    : null;
  
  const modalSubLevels = selectedSubCategory?.hasSubLevels
    ? selectedSubCategory.subLevels || []
    : [];

  // Önerileri filtrele
  const filteredRecs = recommendations.filter(rec => {
    const matchSearch = rec.title.toLowerCase().includes(search.toLowerCase()) || 
                        rec.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || rec.categoryId === filterCategory;
    
    let matchSurvey = true;
    if (filterSurvey) {
      if (rec.subLevel?.subCategory?.category?.surveyId) {
        matchSurvey = rec.subLevel.subCategory.category.surveyId === filterSurvey;
      } else if (rec.subCategory?.category?.surveyId) {
        matchSurvey = rec.subCategory.category.surveyId === filterSurvey;
      } else if (rec.categoryId) {
        const cat = categories.find(c => c.id === rec.categoryId);
        matchSurvey = cat?.surveyId === filterSurvey;
      } else {
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
    if (rec.subCategory?.category?.surveyId) {
      const survey = surveys.find(s => s.id === rec.subCategory?.category?.surveyId);
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

  // Hedef alanı bul
  const getTargetArea = (rec: Recommendation) => {
    if (rec.subLevel?.subCategory?.category) {
      return `${rec.subLevel.subCategory.category.name} > ${rec.subLevel.subCategory.name} > ${rec.subLevel.name}`;
    }
    if (rec.subCategory?.category) {
      return `${rec.subCategory.category.name} > ${rec.subCategory.name}`;
    }
    return 'Genel Öneri';
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
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Plus size={20} /> Yeni Öneri
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-soft p-4 mb-6">
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
              setFilterCategory('');
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
      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">Başlık</th>
              <th className="text-left p-4 font-semibold text-gray-700">Anket</th>
              <th className="text-left p-4 font-semibold text-gray-700">Hedef Alan</th>
              <th className="text-left p-4 font-semibold text-gray-700">Konum</th>
              <th className="text-left p-4 font-semibold text-gray-700">CAPEX</th>
              <th className="text-left p-4 font-semibold text-gray-700">OPEX</th>
              <th className="text-left p-4 font-semibold text-gray-700">Tip</th>
              <th className="text-right p-4 font-semibold text-gray-700">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecs.map((rec) => {
              const surveyName = getSurveyName(rec);
              const targetArea = getTargetArea(rec);
              const stratType = strategicTypes.find(t => t.value === rec.strategicType);
              return (
                <tr key={rec.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{rec.title}</p>
                    <p className="text-sm text-gray-500 truncate max-w-xs">{rec.description}</p>
                  </td>
                  <td className="p-4">
                    {surveyName ? (
                      <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs flex items-center gap-1 w-fit">
                        <FileText size={12} />
                        {surveyName}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600">{targetArea}</span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-mono">
                      ({rec.xPosition || 5}, {rec.yPosition || 5})
                    </span>
                  </td>
                  <td className="p-4">
                    <DollarIndicator level={rec.capexLevel || 1} />
                  </td>
                  <td className="p-4">
                    <DollarIndicator level={rec.opexLevel || 1} />
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${stratType?.color}`}>
                      {stratType?.label}
                    </span>
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
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editItem ? 'Öneri Düzenle' : 'Yeni Öneri'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Temel Bilgiler */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Öneri başlığını girin..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                  placeholder="Öneri açıklamasını girin..."
                />
              </div>
              
              {/* Hedef Alan Seçimi - Kademeli */}
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree size={18} className="text-indigo-700" />
                  <label className="text-sm font-medium text-indigo-800">Hedef Alan Seçimi</label>
                </div>
                <p className="text-xs text-indigo-600 mb-4">
                  Öneri hangi alana ait olacak? Anket → Kategori → Alt Kategori sırasıyla seçim yapın.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Anket Seçimi */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">1. Anket</label>
                    <select
                      value={modalSurveyId}
                      onChange={(e) => {
                        setModalSurveyId(e.target.value);
                        setModalCategoryId('');
                        setModalSubCategoryId('');
                        setModalSubLevelId('');
                      }}
                      className="w-full p-2 border rounded-lg bg-white"
                    >
                      <option value="">-- Anket Seçin --</option>
                      {surveys.map(survey => (
                        <option key={survey.id} value={survey.id}>{survey.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Kategori Seçimi */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">2. Kategori</label>
                    <select
                      value={modalCategoryId}
                      onChange={(e) => {
                        setModalCategoryId(e.target.value);
                        setModalSubCategoryId('');
                        setModalSubLevelId('');
                      }}
                      className="w-full p-2 border rounded-lg bg-white"
                      disabled={!modalSurveyId}
                    >
                      <option value="">-- Kategori Seçin --</option>
                      {modalCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Alt Kategori Seçimi */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">3. Alt Kategori</label>
                    <select
                      value={modalSubCategoryId}
                      onChange={(e) => {
                        setModalSubCategoryId(e.target.value);
                        setModalSubLevelId('');
                      }}
                      className="w-full p-2 border rounded-lg bg-white"
                      disabled={!modalCategoryId}
                    >
                      <option value="">-- Alt Kategori Seçin --</option>
                      {modalSubCategories.map(subCat => (
                        <option key={subCat.id} value={subCat.id}>
                          {subCat.name} {!subCat.hasSubLevels && '(Direkt sorular)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Alt Seviye Seçimi (sadece hasSubLevels=true ise) */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">4. Alt Seviye (Opsiyonel)</label>
                    <select
                      value={modalSubLevelId}
                      onChange={(e) => setModalSubLevelId(e.target.value)}
                      className="w-full p-2 border rounded-lg bg-white"
                      disabled={!modalSubCategoryId || !selectedSubCategory?.hasSubLevels}
                    >
                      <option value="">
                        {selectedSubCategory?.hasSubLevels 
                          ? '-- Alt Seviye Seçin (Opsiyonel) --' 
                          : '-- Alt Seviye Yok --'}
                      </option>
                      {modalSubLevels.map(subLevel => (
                        <option key={subLevel.id} value={subLevel.id}>{subLevel.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Seçim Özeti */}
                {(modalSurveyId || modalCategoryId || modalSubCategoryId) && (
                  <div className="mt-3 p-2 bg-white rounded border">
                    <span className="text-xs text-gray-500">Seçilen Hedef: </span>
                    <span className="text-sm font-medium text-indigo-700">
                      {!modalSurveyId && 'Genel Öneri'}
                      {modalSurveyId && surveys.find(s => s.id === modalSurveyId)?.name}
                      {modalCategoryId && ` > ${modalCategories.find(c => c.id === modalCategoryId)?.name}`}
                      {modalSubCategoryId && ` > ${modalSubCategories.find(sc => sc.id === modalSubCategoryId)?.name}`}
                      {modalSubLevelId && ` > ${modalSubLevels.find(sl => sl.id === modalSubLevelId)?.name}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Puan Eşikleri */}
              <div className="p-4 bg-amber-50 rounded-lg">
                <label className="block text-sm font-medium text-amber-800 mb-2">Puan Aralığı</label>
                <p className="text-xs text-amber-600 mb-3">
                  Bu öneri, seçilen alanda belirtilen puan aralığında olan kullanıcılara gösterilecek.
                </p>
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
              </div>

              {/* Bubble Chart Ayarları */}
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={18} className="text-purple-700" />
                  <label className="text-sm font-medium text-purple-800">Bubble Chart Konumu</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">X Konumu (1-10): Kaynak → Önem → Aciliyet</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={formData.xPosition || 5}
                      onChange={(e) => setFormData({ ...formData, xPosition: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Düşük</span>
                      <span className="font-semibold text-purple-700">{formData.xPosition || 5}</span>
                      <span>Yüksek</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Y Konumu (1-10): Öncelik Puanı</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={formData.yPosition || 5}
                      onChange={(e) => setFormData({ ...formData, yPosition: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Düşük</span>
                      <span className="font-semibold text-purple-700">{formData.yPosition || 5}</span>
                      <span>Yüksek</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-2 bg-white rounded border text-center">
                  <span className="text-xs text-gray-500">Konum: </span>
                  <span className="font-mono text-sm text-purple-700">({formData.xPosition || 5}, {formData.yPosition || 5})</span>
                </div>
              </div>

              {/* Maliyet Seviyeleri */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={18} className="text-green-700" />
                  <label className="text-sm font-medium text-green-800">Maliyet Seviyeleri</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">CAPEX Seviyesi (Yatırım Maliyeti)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={formData.capexLevel || 1}
                        onChange={(e) => setFormData({ ...formData, capexLevel: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <DollarIndicator level={formData.capexLevel || 1} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">OPEX Seviyesi (Yıllık İşletme)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={formData.opexLevel || 1}
                        onChange={(e) => setFormData({ ...formData, opexLevel: parseInt(e.target.value) })}
                        className="flex-1"
                      />
                      <DollarIndicator level={formData.opexLevel || 1} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Diğer Ayarlar */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maliyet Tipi</label>
                  <select
                    value={formData.costType || 'OPEX'}
                    onChange={(e) => setFormData({ ...formData, costType: e.target.value as 'CAPEX' | 'OPEX' })}
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
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value as 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' })}
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
                    onChange={(e) => setFormData({ ...formData, strategicType: e.target.value as 'QUICK_WIN' | 'PROJECT' | 'BIG_BET' })}
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

              {/* Kaydet/İptal */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
