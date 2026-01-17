"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Save, X } from "lucide-react";

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
  subLevels: SubLevel[];
}

interface Category {
  id: string;
  name: string;
  description: string;
  order: number;
  subCategories: SubCategory[];
}

const questionTypes = [
  { value: 'SCALE', label: 'Ölçek (1-5)' },
  { value: 'YES_NO', label: 'Evet/Hayır' },
  { value: 'MULTIPLE_CHOICE', label: 'Çoktan Seçmeli' },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [showModal, setShowModal] = useState<{ type: string; parentId?: string } | null>(null);
  const [newItem, setNewItem] = useState<any>({});

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      setCategories(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

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
      setEditMode(null);
      setShowModal(null);
      setNewItem({});
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

  const Modal = ({ type, parentId }: { type: string; parentId?: string }) => {
    const titles: Record<string, string> = {
      category: 'Yeni Kategori',
      subcategory: 'Yeni Alt Kategori',
      sublevel: 'Yeni Alt Seviye',
      question: 'Yeni Soru',
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{titles[type]}</h2>
            <button onClick={() => setShowModal(null)} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          
          <div className="space-y-4">
            {type === 'question' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soru Metni</label>
                  <textarea
                    value={newItem.text || ''}
                    onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soru Tipi</label>
                  <select
                    value={newItem.type || 'SCALE'}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                    className="w-full p-3 border rounded-lg"
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
                    value={newItem.weight || 1}
                    onChange={(e) => setNewItem({ ...newItem, weight: parseFloat(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Varsayılan: 1.0 - Daha önemli sorular için daha yüksek değer girin</p>
                </div>
                {newItem.type === 'MULTIPLE_CHOICE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şıklar (her satırda: değer|etiket|puan)</label>
                    <textarea
                      value={newItem.optionsText || ''}
                      onChange={(e) => setNewItem({ ...newItem, optionsText: e.target.value })}
                      className="w-full p-3 border rounded-lg font-mono text-sm"
                      rows={5}
                      placeholder="dusuk|Düşük|1&#10;orta|Orta|3&#10;yuksek|Yüksek|5"
                    />
                    <p className="text-xs text-gray-500 mt-1">Format: değer|görünen_metin|puan (1-5 arası)</p>
                  </div>
                )}
                {(newItem.type === 'SCALE' || !newItem.type) && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">Ölçek tipi sorular otomatik olarak 1-5 arası puanlanır</p>
                  </div>
                )}
                {newItem.type === 'YES_NO' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Evet Puanı</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={newItem.yesScore || 5}
                        onChange={(e) => setNewItem({ ...newItem, yesScore: parseInt(e.target.value) })}
                        className="w-full p-3 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hayır Puanı</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={newItem.noScore || 1}
                        onChange={(e) => setNewItem({ ...newItem, noScore: parseInt(e.target.value) })}
                        className="w-full p-3 border rounded-lg"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newItem.requiresEvidence || false}
                    onChange={(e) => setNewItem({ ...newItem, requiresEvidence: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-700">Kanıt belgesi gerekli</label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                  <input
                    type="number"
                    value={newItem.order || 1}
                    onChange={(e) => setNewItem({ ...newItem, order: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">İsim</label>
                  <input
                    type="text"
                    value={newItem.name || ''}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                {type === 'category' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                    <textarea
                      value={newItem.description || ''}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      rows={2}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sıra</label>
                  <input
                    type="number"
                    value={newItem.order || 1}
                    onChange={(e) => setNewItem({ ...newItem, order: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
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
              onClick={() => {
                let data = { ...newItem };
                if (type === 'subcategory') data.categoryId = parentId;
                if (type === 'sublevel') data.subCategoryId = parentId;
                if (type === 'question') {
                  data.subLevelId = parentId;
                  // Çoktan seçmeli şıkları işle
                  if (data.optionsText) {
                    data.options = data.optionsText.split('\n').filter((l: string) => l.trim()).map((line: string) => {
                      const [value, label, score] = line.split('|');
                      return { value: value?.trim(), label: label?.trim(), score: parseInt(score) || 1 };
                    });
                    delete data.optionsText;
                  }
                  // Evet/Hayır puanlarını options'a ekle
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
              }}
              className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-700"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    );
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
        <h1 className="text-2xl font-bold text-gray-800">Kategoriler & Sorular</h1>
        <button
          onClick={() => { setShowModal({ type: 'category' }); setNewItem({ order: categories.length + 1 }); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} /> Yeni Kategori
        </button>
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
                <button onClick={() => { setShowModal({ type: 'subcategory', parentId: category.id }); setNewItem({ order: (category.subCategories?.length || 0) + 1 }); }} className="p-2 hover:bg-white/20 rounded">
                  <Plus size={18} />
                </button>
                <button onClick={() => handleDelete('category', category.id)} className="p-2 hover:bg-red-500 rounded">
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
                        <span className="text-purple-600 text-sm">({subCat.subLevels?.length || 0} alt seviye)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setShowModal({ type: 'sublevel', parentId: subCat.id }); setNewItem({ order: (subCat.subLevels?.length || 0) + 1 }); }} className="p-1 hover:bg-purple-200 rounded text-purple-700">
                          <Plus size={16} />
                        </button>
                        <button onClick={() => handleDelete('subcategory', subCat.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* SubLevels */}
                    {expanded[`sub-${subCat.id}`] && (
                      <div className="p-3 bg-gray-50 space-y-2">
                        {subCat.subLevels?.map((subLevel) => (
                          <div key={subLevel.id} className="border rounded-lg bg-white overflow-hidden">
                            <div className="flex items-center justify-between p-3 bg-indigo-50">
                              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`level-${subLevel.id}`)}>
                                {expanded[`level-${subLevel.id}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="font-medium text-indigo-800">{subLevel.name}</span>
                                <span className="text-indigo-600 text-sm">({subLevel.questions?.length || 0} soru)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setShowModal({ type: 'question', parentId: subLevel.id }); setNewItem({ order: (subLevel.questions?.length || 0) + 1, type: 'SCALE', weight: 1, yesScore: 5, noScore: 1 }); }} className="p-1 hover:bg-indigo-100 rounded text-indigo-700">
                                  <Plus size={16} />
                                </button>
                                <button onClick={() => handleDelete('sublevel', subLevel.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {/* Questions */}
                            {expanded[`level-${subLevel.id}`] && (
                              <div className="p-3 space-y-2">
                                {subLevel.questions?.map((question, idx) => (
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
                                    <button onClick={() => handleDelete('question', question.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                ))}
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
      </div>

      {showModal && <Modal type={showModal.type} parentId={showModal.parentId} />}
    </div>
  );
}
