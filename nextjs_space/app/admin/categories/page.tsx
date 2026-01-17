"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Save, X, FileText, Layers } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Question {
  id: string;
  text: string;
  type: 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE';
  requiresEvidence: boolean;
  options: any[];
  order: number;
  weight: number;
}

interface SubLevel {
  id: string;
  name: string;
  order: number;
  questions: Question[];
}

interface SubCategory {
  id: string;
  name: string;
  order: number;
  hasSubLevels: boolean;
  subLevels: SubLevel[];
  questions: Question[];
}

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  surveyId: string | null;
  survey?: { id: string; name: string } | null;
  subCategories: SubCategory[];
}

interface Survey {
  id: string;
  name: string;
}

const questionTypes = [
  { value: 'SCALE', label: 'Ölçek (1-5)' },
  { value: 'YES_NO', label: 'Evet/Hayır' },
  { value: 'MULTIPLE_CHOICE', label: 'Çoktan Seçmeli' },
];

export default function CategoriesPage() {
  const searchParams = useSearchParams();
  const surveyIdFromUrl = searchParams.get('surveyId');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(surveyIdFromUrl || '');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState<{ type: string; parentId?: string; editItem?: any; parentData?: any } | null>(null);
  const [formData, setFormData] = useState<any>({});

  const fetchSurveys = async () => {
    try {
      const res = await fetch('/api/admin/surveys');
      const data = await res.json();
      setSurveys(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const url = selectedSurveyId 
        ? `/api/admin/categories?surveyId=${selectedSurveyId}` 
        : '/api/admin/categories';
      const res = await fetch(url);
      const data = await res.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchSurveys(); 
  }, []);

  useEffect(() => { 
    setLoading(true);
    fetchCategories(); 
  }, [selectedSurveyId]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async (type: string, data: any) => {
    const endpoints: Record<string, string> = {
      category: '/api/admin/categories',
      subcategory: '/api/admin/subcategories',
      sublevel: '/api/admin/sublevels',
      question: '/api/admin/questions',
    };
    
    try {
      await fetch(endpoints[type], {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      fetchCategories();
      setShowModal(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm('Bu öğeyi silmek istediğinizden emin misiniz?')) return;
    
    const endpoints: Record<string, string> = {
      category: '/api/admin/categories',
      subcategory: '/api/admin/subcategories',
      sublevel: '/api/admin/sublevels',
      question: '/api/admin/questions',
    };
    
    try {
      await fetch(`${endpoints[type]}?id=${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const openModal = (type: string, parentId?: string, editItem?: any, parentData?: any) => {
    if (editItem) {
      let initialData = { ...editItem };
      if (type === 'question' && editItem.type === 'YES_NO' && editItem.options) {
        const yesOpt = editItem.options.find((o: any) => o.value === 'yes');
        const noOpt = editItem.options.find((o: any) => o.value === 'no');
        initialData.yesScore = yesOpt?.score || 5;
        initialData.noScore = noOpt?.score || 1;
      }
      if (type === 'question' && editItem.type === 'MULTIPLE_CHOICE' && editItem.options) {
        initialData.optionsText = editItem.options.map((o: any) => `${o.value}|${o.label}|${o.score}`).join('\n');
      }
      setFormData(initialData);
    } else {
      if (type === 'question') {
        setFormData({ type: 'SCALE', weight: 1, order: 1, yesScore: 5, noScore: 1 });
      } else if (type === 'subcategory') {
        setFormData({ order: 1, hasSubLevels: true });
      } else if (type === 'category') {
        setFormData({ order: 1, surveyId: selectedSurveyId || null });
      } else {
        setFormData({ order: 1 });
      }
    }
    setShowModal({ type, parentId, editItem, parentData });
  };

  const getModalTitle = () => {
    if (!showModal) return '';
    const { type, editItem } = showModal;
    const isEdit = !!editItem;
    const titles: Record<string, string> = {
      category: isEdit ? 'Kategori Düzenle' : 'Yeni Kategori',
      subcategory: isEdit ? 'Alt Kategori Düzenle' : 'Yeni Alt Kategori',
      sublevel: isEdit ? 'Alt Seviye Düzenle' : 'Yeni Alt Seviye',
      question: isEdit ? 'Soru Düzenle' : 'Yeni Soru',
    };
    return titles[type] || '';
  };

  const handleModalSubmit = () => {
    if (!showModal) return;
    const { type, parentId, editItem, parentData } = showModal;
    const isEdit = !!editItem;
    
    let data = { ...formData };
    if (type === 'category' && !isEdit) {
      data.surveyId = selectedSurveyId || null;
    }
    if (type === 'subcategory' && !isEdit) data.categoryId = parentId;
    if (type === 'sublevel' && !isEdit) data.subCategoryId = parentId;
    if (type === 'question') {
      if (!isEdit) {
        if (parentData?.isSubCategory) {
          data.subCategoryId = parentId;
          data.subLevelId = null;
        } else {
          data.subLevelId = parentId;
          data.subCategoryId = null;
        }
      }
      if (data.optionsText) {
        data.options = data.optionsText.split('\n').filter((l: string) => l.trim()).map((line: string) => {
          const [value, label, score] = line.split('|');
          return { value: value?.trim(), label: label?.trim(), score: parseInt(score) || 1 };
        });
        delete data.optionsText;
      }
      if (data.type === 'YES_NO') {
        data.options = [
          { value: 'yes', label: 'Evet', score: data.yesScore || 5 },
          { value: 'no', label: 'Hayır', score: data.noScore || 1 }
        ];
      }
      delete data.yesScore;
      delete data.noScore;
    }
    handleSave(type, data);
  };

  // Soru render fonksiyonu
  const renderQuestion = (question: Question, idx: number, parentId: string, parentData: any) => (
    <div key={question.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <p className="text-gray-800">{idx + 1}. {question.text}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
            {questionTypes.find(t => t.value === question.type)?.label}
          </span>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
            Ağırlık: {question.weight || 1}x
          </span>
          {question.requiresEvidence && (
            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Kanıt Gerekli</span>
          )}
        </div>
        {question.options && question.options.length > 0 && question.type !== 'SCALE' && (
          <div className="mt-2 text-xs text-gray-500">
            Şıklar: {question.options.map((opt: any) => `${opt.label}(${opt.score}p)`).join(', ')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button 
          onClick={() => openModal('question', parentId, question, parentData)} 
          className="p-1.5 hover:bg-blue-100 rounded text-blue-600" 
          title="Düzenle"
        >
          <Edit size={16} />
        </button>
        <button 
          onClick={() => handleDelete('question', question.id)} 
          className="p-1.5 hover:bg-red-100 rounded text-red-600" 
          title="Sil"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

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
        <h1 className="text-2xl font-bold text-gray-800">Kategoriler & Sorular</h1>
        <button
          onClick={() => openModal('category')}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998]"
        >
          <Plus size={20} /> Yeni Kategori
        </button>
      </div>

      {/* Anket Seçimi */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex items-center gap-4">
          <FileText className="text-[#1e3a8a]" size={20} />
          <label className="font-medium text-gray-700">Anket Seçin:</label>
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="flex-1 max-w-md p-2 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
          >
            <option value="">Tüm Kategoriler (Anketsiz)</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedSurveyId && (
            <span className="text-sm text-gray-500">
              {categories.length} kategori gösteriliyor
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.id} className="bg-white rounded-xl shadow-md overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center justify-between p-4 bg-[#1e3a8a] text-white">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`cat-${category.id}`)}>
                {expanded[`cat-${category.id}`] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">{category.name}</span>
                <span className="text-white/70 text-sm">({category.subCategories?.length || 0} alt kategori)</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openModal('subcategory', category.id)} 
                  className="p-2 hover:bg-white/20 rounded" 
                  title="Alt Kategori Ekle"
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={() => openModal('category', undefined, category)} 
                  className="p-2 hover:bg-white/20 rounded" 
                  title="Düzenle"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDelete('category', category.id)} 
                  className="p-2 hover:bg-red-500 rounded" 
                  title="Sil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* SubCategories */}
            {expanded[`cat-${category.id}`] && (
              <div className="p-4 space-y-3">
                {category.subCategories?.map((subCat) => (
                  <div key={subCat.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-purple-100">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`sub-${subCat.id}`)}>
                        {expanded[`sub-${subCat.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        <span className="font-medium text-purple-800">{subCat.name}</span>
                        {subCat.hasSubLevels ? (
                          <span className="text-purple-600 text-sm">({subCat.subLevels?.length || 0} alt seviye)</span>
                        ) : (
                          <span className="text-purple-600 text-sm">({subCat.questions?.length || 0} soru)</span>
                        )}
                        {!subCat.hasSubLevels && (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Doğrudan Sorular</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {subCat.hasSubLevels ? (
                          <button 
                            onClick={() => openModal('sublevel', subCat.id)} 
                            className="p-1.5 hover:bg-purple-200 rounded text-purple-700" 
                            title="Alt Seviye Ekle"
                          >
                            <Plus size={16} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => openModal('question', subCat.id, undefined, { isSubCategory: true })} 
                            className="p-1.5 hover:bg-purple-200 rounded text-purple-700" 
                            title="Soru Ekle"
                          >
                            <Plus size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => openModal('subcategory', category.id, subCat)} 
                          className="p-1.5 hover:bg-purple-200 rounded text-purple-700" 
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete('subcategory', subCat.id)} 
                          className="p-1.5 hover:bg-red-100 rounded text-red-600" 
                          title="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* SubLevels veya Doğrudan Sorular */}
                    {expanded[`sub-${subCat.id}`] && (
                      <div className="p-3 bg-gray-50 space-y-2">
                        {subCat.hasSubLevels ? (
                          // Alt Seviyeler ve soruları
                          <>
                            {subCat.subLevels?.map((subLevel) => (
                              <div key={subLevel.id} className="border rounded-lg bg-white overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-indigo-50">
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`level-${subLevel.id}`)}>
                                    {expanded[`level-${subLevel.id}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="font-medium text-indigo-800">{subLevel.name}</span>
                                    <span className="text-indigo-600 text-sm">({subLevel.questions?.length || 0} soru)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => openModal('question', subLevel.id, undefined, { isSubCategory: false })} 
                                      className="p-1.5 hover:bg-indigo-100 rounded text-indigo-700" 
                                      title="Soru Ekle"
                                    >
                                      <Plus size={16} />
                                    </button>
                                    <button 
                                      onClick={() => openModal('sublevel', subCat.id, subLevel)} 
                                      className="p-1.5 hover:bg-indigo-100 rounded text-indigo-700" 
                                      title="Düzenle"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete('sublevel', subLevel.id)} 
                                      className="p-1.5 hover:bg-red-100 rounded text-red-600" 
                                      title="Sil"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>

                                {/* Questions */}
                                {expanded[`level-${subLevel.id}`] && (
                                  <div className="p-3 space-y-2">
                                    {subLevel.questions?.map((question, idx) => 
                                      renderQuestion(question, idx, subLevel.id, { isSubCategory: false })
                                    )}
                                    {(!subLevel.questions || subLevel.questions.length === 0) && (
                                      <p className="text-gray-400 text-center py-4">Henüz soru eklenmemiş</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {(!subCat.subLevels || subCat.subLevels.length === 0) && (
                              <p className="text-gray-400 text-center py-4">Henüz alt seviye eklenmemiş</p>
                            )}
                          </>
                        ) : (
                          // Doğrudan sorular (hasSubLevels = false)
                          <div className="space-y-2">
                            {subCat.questions?.map((question, idx) => 
                              renderQuestion(question, idx, subCat.id, { isSubCategory: true })
                            )}
                            {(!subCat.questions || subCat.questions.length === 0) && (
                              <p className="text-gray-400 text-center py-4">Henüz soru eklenmemiş</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!category.subCategories || category.subCategories.length === 0) && (
                  <p className="text-gray-400 text-center py-4">Henüz alt kategori eklenmemiş</p>
                )}
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-500">Henüz kategori eklenmemiş</p>
            <button
              onClick={() => openModal('category')}
              className="mt-4 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998]"
            >
              İlk Kategoriyi Ekle
            </button>
          </div>
        )}
      </div>

      {/* Modal - Inline JSX to prevent focus loss */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">{getModalTitle()}</h2>
              <button onClick={() => setShowModal(null)} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {showModal.type === 'question' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni</label>
                    <textarea
                      value={formData.text || ''}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
                    <select
                      value={formData.type || 'SCALE'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    >
                      {questionTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Soru Ağırlığı (Puan Çarpanı)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.weight || 1}
                      onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                  {formData.type === 'MULTIPLE_CHOICE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Şıklar (her satırda: değer|etiket|puan)</label>
                      <textarea
                        value={formData.optionsText || ''}
                        onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                        className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                        rows={5}
                        placeholder="dusuk|Düşük|1&#10;orta|Orta|3&#10;yuksek|Yüksek|5"
                      />
                    </div>
                  )}
                  {(formData.type === 'SCALE' || !formData.type) && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">Ölçek tipi sorular otomatik olarak 1-5 arası puanlanır</p>
                    </div>
                  )}
                  {formData.type === 'YES_NO' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Evet Puanı</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={formData.yesScore || 5}
                          onChange={(e) => setFormData({ ...formData, yesScore: parseInt(e.target.value) })}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hayır Puanı</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={formData.noScore || 1}
                          onChange={(e) => setFormData({ ...formData, noScore: parseInt(e.target.value) })}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresEvidence || false}
                      onChange={(e) => setFormData({ ...formData, requiresEvidence: e.target.checked })}
                      className="w-4 h-4 text-[#1e3a8a] rounded"
                    />
                    <label className="text-sm text-gray-700">Kanıt belgesi gerekli</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                </>
              ) : showModal.type === 'subcategory' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İsim</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={20} className="text-amber-600" />
                      <span className="font-medium text-amber-800">Alt Seviye Yapısı</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasSubLevels"
                          checked={formData.hasSubLevels === true}
                          onChange={() => setFormData({ ...formData, hasSubLevels: true })}
                          className="w-4 h-4 text-[#1e3a8a]"
                        />
                        <span className="text-sm text-gray-700">Alt seviyeler kullan</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasSubLevels"
                          checked={formData.hasSubLevels === false}
                          onChange={() => setFormData({ ...formData, hasSubLevels: false })}
                          className="w-4 h-4 text-[#1e3a8a]"
                        />
                        <span className="text-sm text-gray-700">Doğrudan sorular ekle</span>
                      </label>
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      {formData.hasSubLevels 
                        ? '"İzleme", "İnisiyatifler" gibi alt seviyeler oluşturabilirsiniz' 
                        : 'Soruları doğrudan bu alt kategoriye ekleyebilirsiniz'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">İsim</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                  {showModal.type === 'category' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                        rows={2}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleModalSubmit}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#3b5998] flex items-center gap-2"
              >
                <Save size={18} />
                {showModal.editItem ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
