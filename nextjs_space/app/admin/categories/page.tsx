"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Save, X, FileText, Layers, Upload, Download, AlertCircle, CheckCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Question {
  id: string;
  text: string;
  type: 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE';
  requiresEvidence: boolean;
  options: any[];
  order: number;
  weight: number;
  axisType: 'VELOCITY' | 'ENDURANCE';  // Ironman için: Hız veya Olgunluk
}

interface SubLevel {
  id: string;
  name: string;
  order: number;
  axisType: 'VELOCITY' | 'ENDURANCE';
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
  
  // Bulk upload state
  const [showBulkUpload, setShowBulkUpload] = useState<{ parentId: string; isSubCategory: boolean } | null>(null);
  const [bulkUploadResult, setBulkUploadResult] = useState<{
    success: boolean;
    summary?: { totalRows: number; successCount: number; errorCount: number; skippedRows?: number };
    errors?: { row: number; message: string }[];
  } | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Survey-level bulk upload state
  const [showSurveyBulkUpload, setShowSurveyBulkUpload] = useState(false);
  const [surveyBulkUploadResult, setSurveyBulkUploadResult] = useState<{
    success: boolean;
    summary?: { totalRows: number; successCount: number; errorCount: number; skippedRows?: number };
    errors?: { row: number; message: string }[];
  } | null>(null);
  const [surveyBulkUploading, setSurveyBulkUploading] = useState(false);
  const surveyFileInputRef = useRef<HTMLInputElement>(null);

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

  // Bulk upload functions
  const handleTemplateDownload = async () => {
    try {
      const response = await fetch('/api/admin/questions/template');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'soru_yukleme_sablonu.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Şablon indirilemedi');
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !showBulkUpload) return;

    setBulkUploading(true);
    setBulkUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (showBulkUpload.isSubCategory) {
        formData.append('subCategoryId', showBulkUpload.parentId);
      } else {
        formData.append('subLevelId', showBulkUpload.parentId);
      }

      const response = await fetch('/api/admin/questions/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setBulkUploadResult({
          success: true,
          summary: result.summary,
          errors: result.errors,
        });
        fetchCategories();
      } else {
        setBulkUploadResult({
          success: false,
          errors: [{ row: 0, message: result.error || 'Yükleme başarısız' }],
        });
      }
    } catch (error) {
      console.error('Error uploading:', error);
      setBulkUploadResult({
        success: false,
        errors: [{ row: 0, message: 'Dosya yüklenirken hata oluştu' }],
      });
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openBulkUploadModal = (parentId: string, isSubCategory: boolean) => {
    setShowBulkUpload({ parentId, isSubCategory });
    setBulkUploadResult(null);
  };

  // Survey-level bulk upload functions
  const handleSurveyTemplateDownload = async () => {
    if (!selectedSurveyId) return;
    try {
      const response = await fetch(`/api/admin/questions/survey-template?surveyId=${selectedSurveyId}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const surveyName = surveys.find(s => s.id === selectedSurveyId)?.name || 'anket';
      a.download = `${surveyName}_soru_sablonu.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading survey template:', error);
      alert('Şablon indirilemedi');
    }
  };

  const handleSurveyBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSurveyId) return;

    setSurveyBulkUploading(true);
    setSurveyBulkUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('surveyId', selectedSurveyId);

      const response = await fetch('/api/admin/questions/survey-bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setSurveyBulkUploadResult({
          success: true,
          summary: result.summary,
          errors: result.errors,
        });
        fetchCategories();
      } else {
        setSurveyBulkUploadResult({
          success: false,
          errors: [{ row: 0, message: result.error || 'Yükleme başarısız' }],
        });
      }
    } catch (error) {
      console.error('Error uploading:', error);
      setSurveyBulkUploadResult({
        success: false,
        errors: [{ row: 0, message: 'Dosya yüklenirken hata oluştu' }],
      });
    } finally {
      setSurveyBulkUploading(false);
      if (surveyFileInputRef.current) {
        surveyFileInputRef.current.value = '';
      }
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
      } else if (type === 'sublevel') {
        setFormData({ order: 1, axisType: 'VELOCITY' });
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
    <div key={question.id} className="flex items-start justify-between p-3 bg-[var(--bg-card-2)] rounded-lg">
      <div className="flex-1">
        <p className="text-[var(--text-main)]">{idx + 1}. {question.text}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="text-xs px-2 py-1 bg-[var(--bg-card-2)] text-[var(--accent)] rounded">
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
          <div className="mt-2 text-xs text-[var(--text-dim)]">
            Şıklar: {question.options.map((opt: any) => `${opt.label}(${opt.score}p)`).join(', ')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 ml-2">
        <button 
          onClick={() => openModal('question', parentId, question, parentData)} 
          className="p-1.5 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]" 
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
        <div className="w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Kategoriler & Sorular</h1>
        <button
          onClick={() => openModal('category')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)]"
        >
          <Plus size={20} /> Yeni Kategori
        </button>
      </div>

      {/* Anket Seçimi */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <FileText className="text-[var(--accent)]" size={20} />
          <label className="font-medium text-[var(--text-muted)]">Anket Seçin:</label>
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="flex-1 max-w-md p-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          >
            <option value="">Tüm Kategoriler (Anketsiz)</option>
            {surveys.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {selectedSurveyId && (
            <>
              <span className="text-sm text-[var(--text-dim)]">
                {categories.length} kategori gösteriliyor
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setShowSurveyBulkUpload(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  title="Tüm kategorilere toplu soru yükle"
                >
                  <Upload size={16} />
                  Toplu Soru Yükle
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.id} className="bg-[var(--bg-card)] rounded-xl shadow-md overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center justify-between p-4 bg-[var(--accent)] text-white">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`cat-${category.id}`)}>
                {expanded[`cat-${category.id}`] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                <span className="font-semibold">{category.name}</span>
                <span className="text-white/70 text-sm">({category.subCategories?.length || 0} alt kategori)</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openModal('subcategory', category.id)} 
                  className="p-2 hover:bg-[var(--bg-card)]/20 rounded" 
                  title="Alt Kategori Ekle"
                >
                  <Plus size={18} />
                </button>
                <button 
                  onClick={() => openModal('category', undefined, category)} 
                  className="p-2 hover:bg-[var(--bg-card)]/20 rounded" 
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
                          <>
                            <button 
                              onClick={() => openModal('question', subCat.id, undefined, { isSubCategory: true })} 
                              className="p-1.5 hover:bg-purple-200 rounded text-purple-700" 
                              title="Soru Ekle"
                            >
                              <Plus size={16} />
                            </button>
                            <button 
                              onClick={() => openBulkUploadModal(subCat.id, true)} 
                              className="p-1.5 hover:bg-green-200 rounded text-green-700" 
                              title="Excel'den Toplu Yükle"
                            >
                              <Upload size={16} />
                            </button>
                          </>
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
                      <div className="p-3 bg-[var(--bg-card-2)] space-y-2">
                        {subCat.hasSubLevels ? (
                          // Alt Seviyeler ve soruları
                          <>
                            {subCat.subLevels?.map((subLevel) => (
                              <div key={subLevel.id} className="border rounded-lg bg-[var(--bg-card)] overflow-hidden">
                                <div className="flex items-center justify-between p-3 bg-indigo-50">
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`level-${subLevel.id}`)}>
                                    {expanded[`level-${subLevel.id}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="font-medium text-indigo-800">{subLevel.name}</span>
                                    <span className="text-indigo-600 text-sm">({subLevel.questions?.length || 0} soru)</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      subLevel.axisType === 'VELOCITY' 
                                        ? 'bg-[var(--bg-card-2)] text-[var(--accent)]' 
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {subLevel.axisType === 'VELOCITY' ? 'X: Velocity' : 'Y: Endurance'}
                                    </span>
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
                                      onClick={() => openBulkUploadModal(subLevel.id, false)} 
                                      className="p-1.5 hover:bg-green-100 rounded text-green-700" 
                                      title="Excel'den Toplu Yükle"
                                    >
                                      <Upload size={16} />
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
                                      <p className="text-[var(--text-dim)] text-center py-4">Henüz soru eklenmemiş</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {(!subCat.subLevels || subCat.subLevels.length === 0) && (
                              <p className="text-[var(--text-dim)] text-center py-4">Henüz alt seviye eklenmemiş</p>
                            )}
                          </>
                        ) : (
                          // Doğrudan sorular (hasSubLevels = false)
                          <div className="space-y-2">
                            {subCat.questions?.map((question, idx) => 
                              renderQuestion(question, idx, subCat.id, { isSubCategory: true })
                            )}
                            {(!subCat.questions || subCat.questions.length === 0) && (
                              <p className="text-[var(--text-dim)] text-center py-4">Henüz soru eklenmemiş</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!category.subCategories || category.subCategories.length === 0) && (
                  <p className="text-[var(--text-dim)] text-center py-4">Henüz alt kategori eklenmemiş</p>
                )}
              </div>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <div className="bg-[var(--bg-card)] rounded-xl shadow-md p-8 text-center">
            <p className="text-[var(--text-dim)]">Henüz kategori eklenmemiş</p>
            <button
              onClick={() => openModal('category')}
              className="mt-4 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)]"
            >
              İlk Kategoriyi Ekle
            </button>
          </div>
        )}
      </div>

      {/* Modal - Inline JSX to prevent focus loss */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{getModalTitle()}</h2>
              <button onClick={() => setShowModal(null)} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {showModal.type === 'question' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Soru Metni</label>
                    <textarea
                      value={formData.text || ''}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Soru Tipi</label>
                    <select
                      value={formData.type || 'SCALE'}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    >
                      {questionTypes.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Soru Ağırlığı (Puan Çarpanı)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={formData.weight || 1}
                      onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
                      Ironman Ekseni (Hız / Olgunluk)
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, axisType: 'VELOCITY' })}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          (!formData.axisType || formData.axisType === 'VELOCITY')
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]'
                        }`}
                      >
                        ⚡ Hız (Velocity)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, axisType: 'ENDURANCE' })}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          formData.axisType === 'ENDURANCE'
                            ? 'bg-[var(--bg-card-2)]0 text-white shadow-md'
                            : 'bg-[var(--bg-card-2)] text-[var(--text-muted)] hover:bg-[var(--bg-card-2)]'
                        }`}
                      >
                        🏃 Olgunluk (Endurance)
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-dim)] mt-1">
                      Bu soru Ironman analizinde hangi havuza eklenecek?
                    </p>
                  </div>
                  {formData.type === 'MULTIPLE_CHOICE' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Şıklar (her satırda: değer|etiket|puan)</label>
                      <textarea
                        value={formData.optionsText || ''}
                        onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                        className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        rows={5}
                        placeholder={`dusuk|Düşük|1\norta|Orta|3\nyuksek|Yüksek|5`}
                      />
                    </div>
                  )}
                  {(formData.type === 'SCALE' || !formData.type) && (
                    <div className="p-3 bg-[var(--bg-card-2)] rounded-lg">
                      <p className="text-sm text-[var(--accent)]">Ölçek tipi sorular otomatik olarak 1-5 arası puanlanır</p>
                    </div>
                  )}
                  {formData.type === 'YES_NO' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Evet Puanı</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={formData.yesScore || 5}
                          onChange={(e) => setFormData({ ...formData, yesScore: parseInt(e.target.value) })}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Hayır Puanı</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={formData.noScore || 1}
                          onChange={(e) => setFormData({ ...formData, noScore: parseInt(e.target.value) })}
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.requiresEvidence || false}
                      onChange={(e) => setFormData({ ...formData, requiresEvidence: e.target.checked })}
                      className="w-4 h-4 text-[var(--accent)] rounded"
                    />
                    <label className="text-sm text-[var(--text-muted)]">Kanıt belgesi gerekli</label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                  </div>
                </>
              ) : showModal.type === 'subcategory' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">İsim</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
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
                          className="w-4 h-4 text-[var(--accent)]"
                        />
                        <span className="text-sm text-[var(--text-muted)]">Alt seviyeler kullan</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hasSubLevels"
                          checked={formData.hasSubLevels === false}
                          onChange={() => setFormData({ ...formData, hasSubLevels: false })}
                          className="w-4 h-4 text-[var(--accent)]"
                        />
                        <span className="text-sm text-[var(--text-muted)]">Doğrudan sorular ekle</span>
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
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">İsim</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                  </div>
                  {showModal.type === 'category' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Açıklama</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        rows={2}
                      />
                    </div>
                  )}
                  {showModal.type === 'sublevel' && (
                    <div className="p-4 bg-[var(--bg-card-2)] border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-[var(--blue-main)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span className="font-medium text-[var(--accent)]">Ironman Analiz Ekseni</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="axisType"
                            checked={formData.axisType === 'VELOCITY'}
                            onChange={() => setFormData({ ...formData, axisType: 'VELOCITY' })}
                            className="w-4 h-4 text-[var(--blue-main)]"
                          />
                          <span className="text-sm text-[var(--text-muted)]">
                            <strong>Velocity (X)</strong> - Hız/Aksiyon
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="axisType"
                            checked={formData.axisType === 'ENDURANCE'}
                            onChange={() => setFormData({ ...formData, axisType: 'ENDURANCE' })}
                            className="w-4 h-4 text-[var(--blue-main)]"
                          />
                          <span className="text-sm text-[var(--text-muted)]">
                            <strong>Endurance (Y)</strong> - Olgunluk
                          </span>
                        </label>
                      </div>
                      <p className="text-xs text-[var(--blue-main)] mt-2">
                        {formData.axisType === 'VELOCITY' 
                          ? 'İnisiyatifler, projeler, hedefler gibi aksiyon odaklı sorular için' 
                          : 'Politikalar, izleme, raporlama gibi sürdürülebilirlik odaklı sorular için'}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Sıra</label>
                    <input
                      type="number"
                      value={formData.order || 1}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(null)}
                className="px-4 py-2 text-[var(--text-muted)] hover:bg-[var(--bg-card-2)] rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleModalSubmit}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-dark)] flex items-center gap-2"
              >
                <Save size={18} />
                {showModal.editItem ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">Excel'den Toplu Soru Yükle</h2>
              <button onClick={() => { setShowBulkUpload(null); setBulkUploadResult(null); }} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Template Download */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-blue-200">
                <h3 className="font-medium text-[var(--accent)] mb-2 flex items-center gap-2">
                  <Download size={18} />
                  1. Şablonu İndir
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  Önce Excel şablonunu indirip doldurun. Şablonda örnek sorular ve açıklamalar bulunmaktadır.
                </p>
                <button
                  onClick={handleTemplateDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download size={18} />
                  Soru Yükleme Şablonu İndir (.xlsx)
                </button>
              </div>

              {/* File Upload */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <Upload size={18} />
                  2. Doldurduğunuz Dosyayı Yükleyin
                </h3>
                <p className="text-sm text-green-700 mb-3">
                  Şablonu doldurduktan sonra aşağıdan yükleyin.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={bulkUploading}
                  className="block w-full text-sm text-[var(--text-dim)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50"
                />
                {bulkUploading && (
                  <div className="flex items-center gap-2 mt-3 text-green-700">
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Yükleniyor...</span>
                  </div>
                )}
              </div>

              {/* Results */}
              {bulkUploadResult && (
                <div className={`p-4 rounded-lg border ${bulkUploadResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <h3 className={`font-medium mb-3 flex items-center gap-2 ${bulkUploadResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {bulkUploadResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    Yükleme Sonucu
                  </h3>
                  
                  {bulkUploadResult.summary && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--text-muted)]">{bulkUploadResult.summary.totalRows}</div>
                        <div className="text-xs text-[var(--text-dim)]">Toplam Satır</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-emerald-600">{bulkUploadResult.summary.successCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Başarılı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-red-600">{bulkUploadResult.summary.errorCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Hatalı</div>
                      </div>
                    </div>
                  )}

                  {bulkUploadResult.errors && bulkUploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-red-700 mb-2">Hatalı Satırlar:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {bulkUploadResult.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-red-600 p-2 bg-[var(--bg-card)] rounded">
                            {err.row > 0 ? `Satır ${err.row}: ` : ''}{err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Help Section */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--border-soft)]">
                <h4 className="font-medium text-[var(--text-muted)] mb-2">Desteklenen Soru Tipleri:</h4>
                <ul className="text-sm text-[var(--text-muted)] space-y-1">
                  <li><strong>COKTAN_SECMELI:</strong> Çoktan seçmeli (secenekler kolonunu doldurun)</li>
                  <li><strong>OLCEK_1_5:</strong> 1-5 arası ölçek (otomatik puanlama)</li>
                  <li><strong>EVET_HAYIR:</strong> Evet/Hayır (evet_puani ve hayir_puani kolonlarını doldurun)</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowBulkUpload(null); setBulkUploadResult(null); }}
                className="px-4 py-2 bg-gray-200 text-[var(--text-muted)] rounded-lg hover:bg-gray-300"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Survey-Level Bulk Upload Modal */}
      {showSurveyBulkUpload && selectedSurveyId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                📊 Ankete Toplu Soru Yükle
              </h2>
              <button onClick={() => { setShowSurveyBulkUpload(false); setSurveyBulkUploadResult(null); }} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>Seçili Anket:</strong> {surveys.find(s => s.id === selectedSurveyId)?.name}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Bu şablon, anketin tüm kategori ve alt kategorilerini içerir. Tek dosyada tüm soruları yükleyebilirsiniz.
              </p>
            </div>

            <div className="space-y-4">
              {/* Template Download */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-blue-200">
                <h3 className="font-medium text-[var(--accent)] mb-2 flex items-center gap-2">
                  <Download size={18} />
                  1. Anket Şablonunu İndir
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  Şablon, anketin yapısını (kategori, alt kategori, alt seviye) içerir. 
                  Her satırda hangi kategoriye ait olduğunu belirterek soruları doldurun.
                </p>
                <button
                  onClick={handleSurveyTemplateDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download size={18} />
                  Anket Soru Şablonu İndir (.xlsx)
                </button>
              </div>

              {/* File Upload */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <Upload size={18} />
                  2. Doldurduğunuz Dosyayı Yükleyin
                </h3>
                <p className="text-sm text-green-700 mb-3">
                  Şablondaki <strong>kategori_adi</strong>, <strong>alt_kategori_adi</strong> ve <strong>alt_seviye_adi</strong> kolonlarını 
                  değiştirmeden soruları ekleyin. Sistem otomatik olarak doğru yere yerleştirecek.
                </p>
                <input
                  ref={surveyFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSurveyBulkUpload}
                  disabled={surveyBulkUploading}
                  className="block w-full text-sm text-[var(--text-dim)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700 disabled:opacity-50"
                />
                {surveyBulkUploading && (
                  <div className="flex items-center gap-2 mt-3 text-green-700">
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Yükleniyor...</span>
                  </div>
                )}
              </div>

              {/* Results */}
              {surveyBulkUploadResult && (
                <div className={`p-4 rounded-lg border ${surveyBulkUploadResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <h3 className={`font-medium mb-3 flex items-center gap-2 ${surveyBulkUploadResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                    {surveyBulkUploadResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    Yükleme Sonucu
                  </h3>
                  
                  {surveyBulkUploadResult.summary && (
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--text-muted)]">{surveyBulkUploadResult.summary.totalRows}</div>
                        <div className="text-xs text-[var(--text-dim)]">Toplam Satır</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-emerald-600">{surveyBulkUploadResult.summary.successCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Başarılı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-red-600">{surveyBulkUploadResult.summary.errorCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Hatalı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--text-dim)]">{surveyBulkUploadResult.summary.skippedRows || 0}</div>
                        <div className="text-xs text-[var(--text-dim)]">Atlanan</div>
                      </div>
                    </div>
                  )}

                  {surveyBulkUploadResult.errors && surveyBulkUploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-red-700 mb-2">Hatalı Satırlar:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {surveyBulkUploadResult.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-red-600 p-2 bg-[var(--bg-card)] rounded">
                            {err.row > 0 ? `Satır ${err.row}: ` : ''}{err.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Help Section */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--border-soft)]">
                <h4 className="font-medium text-[var(--text-muted)] mb-2">📋 Şablon Kullanım Rehberi:</h4>
                <ul className="text-sm text-[var(--text-muted)] space-y-1">
                  <li>• <strong>kategori_adi:</strong> Kategori adını şablondaki gibi yazın</li>
                  <li>• <strong>alt_kategori_adi:</strong> Alt kategori adını tam olarak yazın</li>
                  <li>• <strong>alt_seviye_adi:</strong> Varsa alt seviye adı, yoksa boş bırakın</li>
                  <li>• Şablondaki "Anket Yapısı" sayfasından doğru isimleri kopyalayabilirsiniz</li>
                  <li>• "--- ÖRNEK SATIRLAR ---" işaretli satırlar otomatik atlanır</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowSurveyBulkUpload(false); setSurveyBulkUploadResult(null); }}
                className="px-4 py-2 bg-gray-200 text-[var(--text-muted)] rounded-lg hover:bg-gray-300"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
