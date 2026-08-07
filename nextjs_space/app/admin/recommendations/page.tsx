"use client";

import { useEffect, useState } from "react";
import RecommendationBulkPanel from "@/components/admin/recommendation-bulk-panel";
import { Plus, Edit, Trash2, X, Search, FileText, DollarSign, Target, FolderTree, HelpCircle, CheckSquare, TrendingUp, FileSpreadsheet } from "lucide-react";
import { derivePosition } from "@/lib/recommendation-position";

interface Survey {
  id: string;
  name: string;
}

interface Question {
  id: string;
  text: string;
  type: 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE';
  options: string | null;
}

interface SubLevel {
  id: string;
  name: string;
  questions: Question[];
}

interface SubCategory {
  id: string;
  name: string;
  hasSubLevels: boolean;
  subLevels: SubLevel[];
  questions: Question[];
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
  videoUrl: string | null;  // Nasıl Yapılır video linki
  categoryId: string | null;
  subCategoryId: string | null;
  subLevelId: string | null;
  questionId: string | null;
  triggerOptions: string | null;
  points: number;  // Gelişim skoru için puan
  question?: {
    id: string;
    text: string;
    type: string;
    options: string | null;
    subLevel?: {
      id: string;
      name: string;
      subCategory?: {
        id: string;
        name: string;
        category?: {
          id: string;
          name: string;
          surveyId?: string;
        };
      };
    };
    subCategory?: {
      id: string;
      name: string;
      category?: {
        id: string;
        name: string;
        surveyId?: string;
      };
    };
  };
  subCategory?: { 
    id: string;
    name: string;
    categoryId: string;
    category?: { 
      id: string;
      name: string;
      surveyId?: string;
    } 
  };
  subLevel?: { 
    id: string;
    name: string; 
    subCategory?: { 
      id: string;
      name: string;
      categoryId: string;
      category?: { 
        id: string;
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
  { value: 'QUICK_WIN', label: 'Hızlı Kazanım', color: 'bg-[rgba(12,193,195,0.15)] text-[var(--accent)]' },
  { value: 'PROJECT', label: 'Proje', color: 'bg-[var(--warning-bg)] text-[var(--warning)]' },
  { value: 'BIG_BET', label: 'Büyük Yatırım', color: 'bg-[rgba(239,68,68,0.15)] text-[var(--error)]' },
];

const DollarIndicator = ({ level, max = 5 }: { level: number; max?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <DollarSign 
        key={i} 
        size={14} 
        className={i < level ? 'text-[var(--accent)]' : 'text-[var(--ui-passive)]'} 
      />
    ))}
  </div>
);

// Soru şıklarını parse eden fonksiyon
const parseQuestionOptions = (question: Question): { value: string; label: string }[] => {
  if (question.type === 'SCALE') {
    return [
      { value: '1', label: '1 - Çok Düşük' },
      { value: '2', label: '2 - Düşük' },
      { value: '3', label: '3 - Orta' },
      { value: '4', label: '4 - İyi' },
      { value: '5', label: '5 - Çok İyi' },
    ];
  }
  
  if (question.type === 'YES_NO') {
    return [
      { value: 'evet', label: 'Evet' },
      { value: 'hayir', label: 'Hayır' },
    ];
  }
  
  if (question.type === 'MULTIPLE_CHOICE' && question.options) {
    try {
      // Options JSON array formatında olabilir: [{ value, label, score }]
      if (Array.isArray(question.options)) {
        return question.options.map((opt: { value: string; label: string }) => ({
          value: opt.value || '',
          label: opt.label || opt.value || '',
        }));
      }
      
      // String formatı: "değer|etiket|puan" per line (eski format)
      if (typeof question.options === 'string') {
        const lines = question.options.split('\n').filter((line: string) => line.trim());
        return lines.map((line: string) => {
          const parts = line.split('|');
          return {
            value: parts[0]?.trim() || line,
            label: parts[1]?.trim() || parts[0]?.trim() || line,
          };
        });
      }
      
      return [];
    } catch {
      return [];
    }
  }
  
  return [];
};

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
  const [modalQuestionId, setModalQuestionId] = useState('');
  const [selectedTriggerOptions, setSelectedTriggerOptions] = useState<string[]>([]);
  const [showBulkPanel, setShowBulkPanel] = useState(false);

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
    if (!formData.title?.trim()) {
      alert('Lütfen öneri başlığı girin!');
      return;
    }
    
    // Soru seçilmişse en az bir şık seçilmeli
    if (modalQuestionId && selectedTriggerOptions.length === 0) {
      alert('Lütfen en az bir tetikleyici şık seçin!');
      return;
    }
    
    try {
      // Konum sürgülerine hiç dokunulmadıysa (ikisi de varsayılan 5) grafikte
      // bütün öneriler tek noktada yığılırdı; bu durumda strateji, vade ve
      // etkiden anlamlı bir konum türetilir.
      const untouchedPosition = (formData.xPosition ?? 5) === 5 && (formData.yPosition ?? 5) === 5;
      const position = untouchedPosition
        ? derivePosition({
            strategicType: formData.strategicType,
            timeframe: formData.timeframe,
            estimatedImpact: formData.estimatedImpact,
          })
        : { xPosition: formData.xPosition, yPosition: formData.yPosition };

      const dataToSave = {
        ...formData,
        ...position,
        subCategoryId: modalSubLevelId ? null : (modalSubCategoryId || null),
        subLevelId: modalSubLevelId || null,
        questionId: modalQuestionId || null,
        triggerOptions: modalQuestionId && selectedTriggerOptions.length > 0 ? selectedTriggerOptions : null,
      };
      
      const response = await fetch('/api/admin/recommendations', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        alert('Kaydetme hatası: ' + (errorData.error || 'Bilinmeyen hata'));
        return;
      }
      
      fetchData();
      setShowModal(false);
      setEditItem(null);
      setFormData({});
      resetModalSelections();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Bağlantı hatası oluştu!');
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
    setModalQuestionId('');
    setSelectedTriggerOptions([]);
  };

  const openModal = (rec?: Recommendation) => {
    if (rec) {
      setEditItem(rec);
      setFormData(rec);
      
      // Soru ve trigger options'ları yükle
      if (rec.questionId) {
        setModalQuestionId(rec.questionId);
        if (rec.triggerOptions) {
          try {
            const parsed = JSON.parse(rec.triggerOptions);
            setSelectedTriggerOptions(Array.isArray(parsed) ? parsed : []);
          } catch {
            setSelectedTriggerOptions([]);
          }
        }
      }
      
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
        points: 0.5,  // Varsayılan gelişim puanı
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

  // Seçilen alana göre soruları getir
  const getAvailableQuestions = (): Question[] => {
    if (modalSubLevelId) {
      const subLevel = modalSubLevels.find(sl => sl.id === modalSubLevelId);
      return subLevel?.questions || [];
    }
    if (modalSubCategoryId && selectedSubCategory && !selectedSubCategory.hasSubLevels) {
      return selectedSubCategory.questions || [];
    }
    return [];
  };

  const availableQuestions = getAvailableQuestions();
  const selectedQuestion = modalQuestionId ? availableQuestions.find(q => q.id === modalQuestionId) : null;
  const questionOptions = selectedQuestion ? parseQuestionOptions(selectedQuestion) : [];

  // Önerileri filtrele
  const filteredRecs = recommendations.filter(rec => {
    const matchSearch = rec.title.toLowerCase().includes(search.toLowerCase()) || 
                        rec.description.toLowerCase().includes(search.toLowerCase());
    
    // Kategori filtreleme - öneri hangi yoldan kategoriye bağlı olursa olsun kontrol et
    let matchCategory = true;
    if (filterCategory) {
      if (rec.subLevel?.subCategory?.category?.id) {
        matchCategory = rec.subLevel.subCategory.category.id === filterCategory;
      } else if (rec.subCategory?.category?.id) {
        matchCategory = rec.subCategory.category.id === filterCategory;
      } else if (rec.question?.subLevel?.subCategory?.category?.id) {
        matchCategory = rec.question.subLevel.subCategory.category.id === filterCategory;
      } else if (rec.question?.subCategory?.category?.id) {
        matchCategory = rec.question.subCategory.category.id === filterCategory;
      } else if (rec.categoryId) {
        matchCategory = rec.categoryId === filterCategory;
      } else {
        matchCategory = false;
      }
    }
    
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

  // Tetikleme durumunu göster
  const getTriggerInfo = (rec: Recommendation) => {
    if (rec.questionId && rec.question && rec.triggerOptions) {
      try {
        const options = JSON.parse(rec.triggerOptions);
        return {
          questionText: rec.question.text.length > 30 ? rec.question.text.substring(0, 30) + '...' : rec.question.text,
          optionsCount: Array.isArray(options) ? options.length : 0
        };
      } catch {
        return null;
      }
    }
    return null;
  };

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
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Öneri Yönetimi</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkPanel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card-2)] text-[var(--text-muted)] rounded-lg hover:text-[var(--accent)] transition-colors"
          >
            <FileSpreadsheet size={20} /> Toplu Kurulum
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)] transition-colors"
          >
            <Plus size={20} /> Yeni Öneri
          </button>
        </div>
      </div>

      {showBulkPanel && (
        <RecommendationBulkPanel
          surveys={surveys}
          onClose={() => setShowBulkPanel(false)}
          onSaved={fetchData}
        />
      )}

      {/* Filters */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-soft p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={20} />
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
      <div className="bg-[var(--bg-card)] rounded-xl shadow-soft overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--bg-card-2)]">
            <tr>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">Başlık</th>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">Anket</th>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">Tetikleyici</th>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">CAPEX</th>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">OPEX</th>
              <th className="text-left p-4 font-semibold text-[var(--text-muted)]">Tip</th>
              <th className="text-right p-4 font-semibold text-[var(--text-muted)]">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecs.map((rec) => {
              const surveyName = getSurveyName(rec);
              const triggerInfo = getTriggerInfo(rec);
              const stratType = strategicTypes.find(t => t.value === rec.strategicType);
              return (
                <tr key={rec.id} className="border-t hover:bg-[var(--bg-card-2)]">
                  <td className="p-4">
                    <p className="font-medium text-[var(--text-main)]">{rec.title}</p>
                    <p className="text-sm text-[var(--text-dim)] truncate max-w-xs">{rec.description}</p>
                  </td>
                  <td className="p-4">
                    {surveyName ? (
                      <span className="px-2 py-1 bg-[var(--accent)]/15 text-primary-700 rounded text-xs flex items-center gap-1 w-fit">
                        <FileText size={12} />
                        {surveyName}
                      </span>
                    ) : (
                      <span className="text-[var(--text-dim)] text-sm">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    {triggerInfo ? (
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-1 bg-[rgba(12,193,195,0.15)] text-[var(--accent)] rounded text-xs flex items-center gap-1 w-fit">
                          <HelpCircle size={12} />
                          Soru Bağlı
                        </span>
                        <span className="text-xs text-[var(--text-dim)]">{triggerInfo.optionsCount} şık</span>
                      </div>
                    ) : (
                      <span className="px-2 py-1 bg-[rgba(245,158,11,0.15)] text-[var(--warning)] rounded text-xs">
                        Puan Aralığı: %{rec.minScoreThreshold}-{rec.maxScoreThreshold}
                      </span>
                    )}
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
                    <button onClick={() => openModal(rec)} className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]">
                      <Edit size={18} />
                    </button>
                    <button onClick={() => handleDelete(rec.id)} className="p-2 hover:bg-[rgba(239,68,68,0.15)] rounded text-[var(--error)]">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredRecs.length === 0 && (
          <p className="text-center text-[var(--text-dim)] py-8">
            {filterSurvey || filterCategory || search ? 'Öneri bulunamadı' : 'Henüz öneri eklenmemiş'}
          </p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editItem ? 'Öneri Düzenle' : 'Yeni Öneri'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Temel Bilgiler */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Başlık *</label>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Öneri başlığını girin..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Açıklama</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={2}
                    placeholder="Öneri açıklamasını girin..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                    🎬 Nasıl Yapılır Öğrenin - Video Linki
                  </label>
                  <input
                    type="url"
                    value={formData.videoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    placeholder="YouTube veya Vimeo linki girin... (örn: https://www.youtube.com/watch?v=...)"
                  />
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    YouTube, Vimeo veya başka bir video platformunun linkini girebilirsiniz.
                  </p>
                </div>
              </div>
              
              {/* Hedef Alan Seçimi - Kademeli */}
              <div className="p-4 bg-[rgba(99,102,241,0.1)] rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree size={18} className="text-[var(--blue-main)]" />
                  <label className="text-sm font-medium text-[var(--blue-main)]">Hedef Alan Seçimi</label>
                </div>
                <p className="text-xs text-[var(--blue-main)] mb-4">
                  Öneri hangi alana ait olacak? Anket → Kategori → Alt Kategori sırasıyla seçim yapın.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">1. Anket</label>
                    <select
                      value={modalSurveyId}
                      onChange={(e) => {
                        setModalSurveyId(e.target.value);
                        setModalCategoryId('');
                        setModalSubCategoryId('');
                        setModalSubLevelId('');
                        setModalQuestionId('');
                        setSelectedTriggerOptions([]);
                      }}
                      className="w-full p-2 border rounded-lg bg-[var(--bg-card)]"
                    >
                      <option value="">-- Anket Seçin --</option>
                      {surveys.map(survey => (
                        <option key={survey.id} value={survey.id}>{survey.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">2. Kategori</label>
                    <select
                      value={modalCategoryId}
                      onChange={(e) => {
                        setModalCategoryId(e.target.value);
                        setModalSubCategoryId('');
                        setModalSubLevelId('');
                        setModalQuestionId('');
                        setSelectedTriggerOptions([]);
                      }}
                      className="w-full p-2 border rounded-lg bg-[var(--bg-card)]"
                      disabled={!modalSurveyId}
                    >
                      <option value="">-- Kategori Seçin --</option>
                      {modalCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">3. Alt Kategori</label>
                    <select
                      value={modalSubCategoryId}
                      onChange={(e) => {
                        setModalSubCategoryId(e.target.value);
                        setModalSubLevelId('');
                        setModalQuestionId('');
                        setSelectedTriggerOptions([]);
                      }}
                      className="w-full p-2 border rounded-lg bg-[var(--bg-card)]"
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
                  
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">4. Alt Seviye (Opsiyonel)</label>
                    <select
                      value={modalSubLevelId}
                      onChange={(e) => {
                        setModalSubLevelId(e.target.value);
                        setModalQuestionId('');
                        setSelectedTriggerOptions([]);
                      }}
                      className="w-full p-2 border rounded-lg bg-[var(--bg-card)]"
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
              </div>

              {/* SORU-CEVAP BAZLI TETİKLEME - YENİ */}
              <div className="p-4 bg-[rgba(12,193,195,0.1)] rounded-lg border-2 border-[var(--accent)]">
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare size={18} className="text-[var(--accent)]" />
                  <label className="text-sm font-medium text-[var(--accent-bright)]">Şık Bazlı Tetikleme (Yeni!)</label>
                </div>
                <p className="text-xs text-[var(--accent)] mb-4">
                  Bir soru seçin ve bu önerinin hangi cevaplarda aktif olacağını belirleyin. 
                  Kullanıcı seçtiğiniz şıklardan birine cevap verdiğinde bu öneri gösterilecek.
                </p>
                
                {availableQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {/* Soru Seçimi */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Bağlanacak Soru</label>
                      <select
                        value={modalQuestionId}
                        onChange={(e) => {
                          setModalQuestionId(e.target.value);
                          setSelectedTriggerOptions([]);
                        }}
                        className="w-full p-2 border rounded-lg bg-[var(--bg-card)]"
                      >
                        <option value="">-- Soru Seçin (Opsiyonel) --</option>
                        {availableQuestions.map(q => (
                          <option key={q.id} value={q.id}>
                            {q.text.length > 80 ? q.text.substring(0, 80) + '...' : q.text}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Şık Seçimi */}
                    {selectedQuestion && questionOptions.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                          Tetikleyici Şıklar (Hangi cevaplarda bu öneri gösterilsin?)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {questionOptions.map(opt => (
                            <label 
                              key={opt.value} 
                              className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedTriggerOptions.includes(opt.value) 
                                  ? 'bg-[rgba(12,193,195,0.15)] border-[var(--accent)]' 
                                  : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-2)]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedTriggerOptions.includes(opt.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTriggerOptions([...selectedTriggerOptions, opt.value]);
                                  } else {
                                    setSelectedTriggerOptions(selectedTriggerOptions.filter(v => v !== opt.value));
                                  }
                                }}
                                className="w-4 h-4 text-[var(--accent)] rounded"
                              />
                              <span className="text-sm">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                        {selectedTriggerOptions.length > 0 && (
                          <p className="mt-2 text-xs text-[var(--accent)] bg-[rgba(12,193,195,0.15)] p-2 rounded">
                            ✅ Seçili {selectedTriggerOptions.length} şıktan birine cevap verildiğinde bu öneri gösterilecek.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-[var(--text-dim)]">
                    <HelpCircle size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {modalSubCategoryId 
                        ? 'Bu alanda henüz soru bulunmuyor. Önce "Kategoriler" sayfasından soru ekleyin.'
                        : 'Soru seçebilmek için önce yukarıdan alan seçimi yapın.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Puan Aralığı (Soru seçilmediyse) */}
              {!modalQuestionId && (
                <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--border-soft)]">
                  <label className="block text-sm font-medium text-[var(--text-main)] mb-2">Puan Aralığı (Alternatif Yöntem)</label>
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Soru seçmediyseniz, bu öneri seçilen alandaki puan aralığına göre gösterilir.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Minimum Puan (%)</label>
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
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Maksimum Puan (%)</label>
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
              )}

              {/* Gelişim Skoru Puanı */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border-2 border-[var(--blue-main)]">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={18} className="text-[var(--accent)]" />
                  <label className="text-sm font-medium text-[var(--accent)]">Gelişim Skoru Puanı</label>
                </div>
                <p className="text-xs text-[var(--blue-main)] mb-4">
                  Bu öneri tamamlandığında kullanıcının gelişim skoruna eklenecek puan (0-2 arası önerilir).
                  Puan yalnızca yol haritasında &quot;Tamamlandı&quot; işaretlendiğinde eklenir; &quot;Devam ediyor&quot; durumunda eklenmez.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.points || 0.5}
                    onChange={(e) => setFormData({ ...formData, points: parseFloat(e.target.value) })}
                    className="flex-1"
                  />
                  <div className="w-20 text-center">
                    <span className="text-2xl font-bold text-[var(--accent)]">{(formData.points || 0.5).toFixed(1)}</span>
                    <p className="text-xs text-[var(--text-dim)]">puan</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-[var(--text-dim)] mt-1">
                  <span>0 (Düşük etki)</span>
                  <span>2 (Yüksek etki)</span>
                </div>
              </div>

              {/* Bubble Chart Ayarları */}
              <div className="p-4 bg-[var(--accent)]/10 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={18} className="text-[var(--accent)]" />
                  <label className="text-sm font-medium text-[var(--text-main)]">Bubble Chart Konumu</label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">X Konumu (1-10)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={formData.xPosition || 5}
                      onChange={(e) => setFormData({ ...formData, xPosition: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-dim)]">
                      <span>Düşük</span>
                      <span className="font-semibold text-[var(--accent)]">{formData.xPosition || 5}</span>
                      <span>Yüksek</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Y Konumu (1-10)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.5"
                      value={formData.yPosition || 5}
                      onChange={(e) => setFormData({ ...formData, yPosition: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-dim)]">
                      <span>Düşük</span>
                      <span className="font-semibold text-[var(--accent)]">{formData.yPosition || 5}</span>
                      <span>Yüksek</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maliyet ve Diğer Ayarlar */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">CAPEX (1-5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.capexLevel || 1}
                    onChange={(e) => setFormData({ ...formData, capexLevel: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <DollarIndicator level={formData.capexLevel || 1} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">OPEX (1-5)</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.opexLevel || 1}
                    onChange={(e) => setFormData({ ...formData, opexLevel: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <DollarIndicator level={formData.opexLevel || 1} />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Zaman Dilimi</label>
                  <select
                    value={formData.timeframe || 'SHORT_TERM'}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value as 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM' })}
                    className="w-full p-2 border rounded-lg"
                  >
                    {timeframes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Stratejik Tip</label>
                  <select
                    value={formData.strategicType || 'QUICK_WIN'}
                    onChange={(e) => setFormData({ ...formData, strategicType: e.target.value as 'QUICK_WIN' | 'PROJECT' | 'BIG_BET' })}
                    className="w-full p-2 border rounded-lg"
                  >
                    {strategicTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kaydet/İptal */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-[var(--bg-card-2)]"
                >
                  İptal
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)] transition-colors"
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
