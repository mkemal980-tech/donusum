"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Save, X, FileText, Layers, Upload, Download, AlertCircle, CheckCircle, Activity, Eye } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  formatConditionalOptions,
  formatScoredOptions,
  parseScoredOptions,
} from "@/lib/question-options";
import type { ImportRow } from "@/lib/question-import";
import QuestionImportPreview, { type PreviewPayload } from "@/components/admin/question-import-preview";

interface Question {
  id: string;
  text: string;
  type: 'SCALE' | 'YES_NO' | 'MULTIPLE_CHOICE' | 'CONDITIONAL_CHOICE';
  requiresEvidence: boolean;
  options: any[];
  conditionalOptions?: any;  // Kademeli puanlama için
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
  questions: Question[];  // Doğrudan kategoriye bağlı sorular
}

interface Survey {
  id: string;
  name: string;
}

const questionTypes = [
  { value: 'SCALE', label: 'Ölçek (1-5)' },
  { value: 'YES_NO', label: 'Evet/Hayır' },
  { value: 'MULTIPLE_CHOICE', label: 'Çoktan Seçmeli' },
  { value: 'CONDITIONAL_CHOICE', label: 'Kademeli Puanlama (Evet/Hayır → Çoklu Seçim)' },
];

// Helper function to safely parse options (handles both JSON string and array)
const parseOptions = (options: any): any[] => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

// Helper to safely parse conditionalOptions
const parseConditionalOptions = (conditionalOptions: any): any => {
  if (!conditionalOptions) return null;
  if (typeof conditionalOptions === 'object' && !Array.isArray(conditionalOptions)) {
    return conditionalOptions;
  }
  if (typeof conditionalOptions === 'string') {
    try {
      return JSON.parse(conditionalOptions);
    } catch {
      return null;
    }
  }
  return null;
};

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
  const [bulkPreview, setBulkPreview] = useState<PreviewPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Survey-level bulk upload state
  const [showSurveyBulkUpload, setShowSurveyBulkUpload] = useState(false);
  const [surveyBulkUploadResult, setSurveyBulkUploadResult] = useState<{
    success: boolean;
    summary?: { totalRows: number; successCount: number; errorCount: number; skippedRows?: number };
    errors?: { row: number; message: string }[];
  } | null>(null);
  const [surveyBulkUploading, setSurveyBulkUploading] = useState(false);
  const [surveyBulkPreview, setSurveyBulkPreview] = useState<PreviewPayload | null>(null);
  const surveyFileInputRef = useRef<HTMLInputElement>(null);

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/surveys');
      const data = await res.json();
      setSurveys(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
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
  }, [selectedSurveyId]);

  useEffect(() => { 
    fetchSurveys(); 
  }, [fetchSurveys]);

  useEffect(() => { 
    setLoading(true);
    fetchCategories(); 
  }, [fetchCategories]);

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
      const response = await fetch(endpoints[type], {
        method: data.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Hata: ${errorData.error || 'Kaydetme başarısız oldu'}`);
        console.error('Save error:', errorData);
        return;
      }
      
      fetchCategories();
      setShowModal(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving:', error);
      alert('Kaydetme sırasında bir hata oluştu. Lütfen tekrar deneyin.');
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

  // 1. adım: dosyayı doğrulat, kaydetmeden önizlemeye al
  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !showBulkUpload) return;

    setBulkUploading(true);
    setBulkUploadResult(null);
    setBulkPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'preview');

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
        setBulkPreview(result);
      } else {
        setBulkUploadResult({
          success: false,
          errors: [{ row: 0, message: result.error || 'Dosya okunamadı' }],
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

  // 2. adım: önizlemede düzenlenmiş satırları kaydet
  const handleBulkConfirm = async (rows: ImportRow[]) => {
    if (!showBulkUpload) return;

    setBulkUploading(true);
    try {
      const response = await fetch('/api/admin/questions/bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          subCategoryId: showBulkUpload.isSubCategory ? showBulkUpload.parentId : null,
          subLevelId: showBulkUpload.isSubCategory ? null : showBulkUpload.parentId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setBulkPreview(null);
        setBulkUploadResult({ success: true, summary: result.summary, errors: result.errors });
        fetchCategories();
      } else {
        setBulkUploadResult({
          success: false,
          summary: result.summary,
          errors: result.errors?.length ? result.errors : [{ row: 0, message: result.error || 'Aktarım başarısız' }],
        });
      }
    } catch (error) {
      console.error('Error importing:', error);
      setBulkUploadResult({
        success: false,
        errors: [{ row: 0, message: 'Sorular aktarılırken hata oluştu' }],
      });
    } finally {
      setBulkUploading(false);
    }
  };

  const openBulkUploadModal = (parentId: string, isSubCategory: boolean) => {
    setShowBulkUpload({ parentId, isSubCategory });
    setBulkPreview(null);
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

  // 1. adım: dosyayı doğrulat, kaydetmeden önizlemeye al
  const handleSurveyBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSurveyId) return;

    setSurveyBulkUploading(true);
    setSurveyBulkUploadResult(null);
    setSurveyBulkPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('surveyId', selectedSurveyId);
      formData.append('mode', 'preview');

      const response = await fetch('/api/admin/questions/survey-bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setSurveyBulkPreview(result);
      } else {
        setSurveyBulkUploadResult({
          success: false,
          errors: [{ row: 0, message: result.error || 'Dosya okunamadı' }],
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

  // 2. adım: önizlemede düzenlenmiş satırları kaydet
  const handleSurveyBulkConfirm = async (rows: ImportRow[]) => {
    if (!selectedSurveyId) return;

    setSurveyBulkUploading(true);
    try {
      const response = await fetch('/api/admin/questions/survey-bulk-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId: selectedSurveyId, rows }),
      });

      const result = await response.json();

      if (response.ok) {
        setSurveyBulkPreview(null);
        setSurveyBulkUploadResult({ success: true, summary: result.summary, errors: result.errors });
        fetchCategories();
      } else {
        setSurveyBulkUploadResult({
          success: false,
          summary: result.summary,
          errors: result.errors?.length ? result.errors : [{ row: 0, message: result.error || 'Aktarım başarısız' }],
        });
      }
    } catch (error) {
      console.error('Error importing:', error);
      setSurveyBulkUploadResult({
        success: false,
        errors: [{ row: 0, message: 'Sorular aktarılırken hata oluştu' }],
      });
    } finally {
      setSurveyBulkUploading(false);
    }
  };

  const openModal = (type: string, parentId?: string, editItem?: any, parentData?: any) => {
    if (editItem) {
      let initialData = { ...editItem };
      if (type === 'question' && editItem.type === 'YES_NO' && editItem.options) {
        const parsedOpts = parseOptions(editItem.options);
        const yesOpt = parsedOpts.find((o: any) => o.value === 'yes');
        const noOpt = parsedOpts.find((o: any) => o.value === 'no');
        initialData.yesScore = yesOpt?.score || 5;
        initialData.noScore = noOpt?.score || 1;
      }
      if (type === 'question' && editItem.type === 'MULTIPLE_CHOICE' && editItem.options) {
        initialData.optionsText = formatScoredOptions(parseOptions(editItem.options));
      }
      if (type === 'question' && editItem.type === 'CONDITIONAL_CHOICE' && editItem.conditionalOptions) {
        const condOpts = parseConditionalOptions(editItem.conditionalOptions);
        if (condOpts) {
          initialData.thresholdQuestion = condOpts.thresholdQuestion || editItem.text;
          initialData.yesLabel = condOpts.yesLabel || 'Evet';
          initialData.noLabel = condOpts.noLabel || 'Hayır';
          const condSubOpts = parseOptions(condOpts.options);
          if (condSubOpts.length > 0) {
            initialData.conditionalOptionsText = formatConditionalOptions(condSubOpts);
          }
        }
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
    
    // Validasyon kontrolleri
    if (type === 'category' && !formData.name?.trim()) {
      alert('Kategori adı boş olamaz!');
      return;
    }
    if (type === 'subcategory' && !formData.name?.trim()) {
      alert('Alt kategori adı boş olamaz!');
      return;
    }
    if (type === 'sublevel' && !formData.name?.trim()) {
      alert('Alt seviye adı boş olamaz!');
      return;
    }
    if (type === 'question') {
      if (!formData.text?.trim()) {
        alert('Soru metni boş olamaz!');
        return;
      }
      if (formData.type === 'MULTIPLE_CHOICE' && !formData.optionsText?.trim()) {
        alert('Çoktan seçmeli sorular için şıklar girilmelidir!');
        return;
      }
      if (formData.type === 'CONDITIONAL_CHOICE') {
        if (!formData.thresholdQuestion?.trim() && !formData.text?.trim()) {
          alert('Kademeli puanlama için eşik sorusu girilmelidir!');
          return;
        }
        if (!formData.conditionalOptionsText?.trim()) {
          alert('Kademeli puanlama için alt seçenekler girilmelidir!');
          return;
        }
      }
    }
    
    let data = { ...formData };
    if (type === 'category' && !isEdit) {
      data.surveyId = selectedSurveyId || null;
    }
    if (type === 'subcategory' && !isEdit) data.categoryId = parentId;
    if (type === 'sublevel' && !isEdit) data.subCategoryId = parentId;
    if (type === 'question') {
      if (!isEdit) {
        if (parentData?.isCategory) {
          // Doğrudan kategoriye bağlı soru
          data.categoryId = parentId;
          data.subCategoryId = null;
          data.subLevelId = null;
        } else if (parentData?.isSubCategory) {
          data.subCategoryId = parentId;
          data.subLevelId = null;
          data.categoryId = null;
        } else {
          data.subLevelId = parentId;
          data.subCategoryId = null;
          data.categoryId = null;
        }
      }
      if (data.optionsText) {
        const parsed = parseScoredOptions(data.optionsText);
        if (parsed.errors.length > 0) {
          alert(`Şıklar okunamadı:\n\n${parsed.errors.join('\n')}\n\nDoğru yazım: Düşük = 1; Orta = 3; Yüksek = 5`);
          return;
        }
        data.options = parsed.options;
        delete data.optionsText;
      }
      if (data.type === 'YES_NO') {
        data.options = [
          { value: 'yes', label: 'Evet', score: data.yesScore || 5 },
          { value: 'no', label: 'Hayır', score: data.noScore || 1 }
        ];
      }
      if (data.type === 'CONDITIONAL_CHOICE') {
        // Conditional options'ı JSON formatına çevir
        const conditionalOpts = {
          thresholdQuestion: data.thresholdQuestion || data.text || '',
          yesLabel: data.yesLabel || 'Evet',
          noLabel: data.noLabel || 'Hayır',
          options: []
        };
        
        if (data.conditionalOptionsText) {
          const parsed = parseScoredOptions(data.conditionalOptionsText, { valueMode: 'index' });
          if (parsed.errors.length > 0) {
            alert(`Alt seçenekler okunamadı:\n\n${parsed.errors.join('\n')}\n\nDoğru yazım: ISO 9001 = 2; ISO 14001 = 2`);
            return;
          }
          conditionalOpts.options = parsed.options as never[];
        }

        data.conditionalOptions = conditionalOpts;
        delete data.conditionalOptionsText;
        delete data.thresholdQuestion;
        delete data.yesLabel;
        delete data.noLabel;
      }
      delete data.yesScore;
      delete data.noScore;
    }
    
    // Debug için veriyi yazdır
    console.log('Saving question with data:', {
      type,
      data,
      parentId: showModal.parentId,
      parentData: showModal.parentData
    });
    
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
          <span className="text-xs px-2 py-1 bg-[rgba(12,193,195,0.15)] text-[var(--accent)] rounded">
            Ağırlık: {question.weight || 1}x
          </span>
          {question.requiresEvidence && (
            <span className="text-xs px-2 py-1 bg-[var(--warning-bg)] text-[var(--warning)] rounded">Kanıt Gerekli</span>
          )}
        </div>
        {(() => {
          const parsedOpts = parseOptions(question.options);
          return parsedOpts.length > 0 && question.type !== 'SCALE' && question.type !== 'CONDITIONAL_CHOICE' ? (
            <div className="mt-2 text-xs text-[var(--text-dim)]">
              Şıklar: {parsedOpts.map((opt: any) => `${opt.label}(${opt.score}p)`).join(', ')}
            </div>
          ) : null;
        })()}
        {(() => {
          if (question.type !== 'CONDITIONAL_CHOICE' || !question.conditionalOptions) return null;
          const condOpts = parseConditionalOptions(question.conditionalOptions);
          if (!condOpts) return null;
          const condSubOpts = parseOptions(condOpts.options);
          return (
            <div className="mt-2 text-xs text-[var(--text-dim)]">
              <p className="font-medium text-[var(--accent)]">Kademeli: {condOpts.thresholdQuestion}</p>
              {condSubOpts.length > 0 && (
                <p className="mt-1">Alt seçenekler: {condSubOpts.map((opt: any) => `${opt.label}(${opt.score}p)`).join(', ')}</p>
              )}
            </div>
          );
        })()}
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
          className="p-1.5 hover:bg-[rgba(239,68,68,0.15)] rounded text-[var(--error)]" 
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
                <Link
                  href={`/survey-preview/${selectedSurveyId}`}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-card-2)] text-[var(--text-muted)] border border-[var(--border-soft)] rounded-lg hover:border-[var(--accent)] text-sm"
                  title="Anketi kullanıcının gördüğü gibi görüntüle"
                >
                  <Eye size={16} />
                  Anketi Önizle
                </Link>
                <button
                  onClick={() => { setShowSurveyBulkUpload(true); setSurveyBulkPreview(null); setSurveyBulkUploadResult(null); }}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-dark)] text-white rounded-lg hover:bg-[var(--accent-dark)] text-sm"
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
                  className="p-2 hover:bg-[rgba(239,68,68,0.1)]0 rounded" 
                  title="Sil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* Category Content */}
            {expanded[`cat-${category.id}`] && (
              <div className="p-4 space-y-3">
                {/* Doğrudan Kategoriye Bağlı Sorular */}
                {(category.questions?.length > 0 || category.subCategories?.length === 0) && (
                  <div className="border border-[var(--accent)]/30 rounded-lg overflow-hidden mb-4">
                    <div className="flex items-center justify-between p-3 bg-[rgba(12,193,195,0.15)]">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-[var(--accent)]" />
                        <span className="font-medium text-[var(--accent)]">Kategori Soruları</span>
                        <span className="text-[var(--text-dim)] text-sm">({category.questions?.length || 0} soru)</span>
                      </div>
                      <button
                        onClick={() => openModal('question', category.id, undefined, { isCategory: true })}
                        className="flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-dark)] text-sm"
                      >
                        <Plus size={14} />
                        Soru Ekle
                      </button>
                    </div>
                    {category.questions?.length > 0 && (
                      <div className="p-3 space-y-2">
                        {category.questions.map((question, idx) => renderQuestion(question, idx, category.id, { isCategory: true }))}
                      </div>
                    )}
                    {(!category.questions || category.questions.length === 0) && (
                      <p className="text-[var(--text-dim)] text-center py-3 text-sm">Alt kategori olmadan doğrudan soru ekleyebilirsiniz</p>
                    )}
                  </div>
                )}

                {/* Alt Kategoriler */}
                {category.subCategories?.length > 0 && (
                  <div className="border-t border-[var(--border-soft)] pt-3">
                    <p className="text-xs text-[var(--text-dim)] mb-2 uppercase tracking-wider">Alt Kategoriler</p>
                  </div>
                )}
                {category.subCategories?.map((subCat) => (
                  <div key={subCat.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between p-3 bg-[var(--accent)]/15">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`sub-${subCat.id}`)}>
                        {expanded[`sub-${subCat.id}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        <span className="font-medium text-[var(--text-main)]">{subCat.name}</span>
                        {subCat.hasSubLevels ? (
                          <span className="text-[var(--text-muted)] text-sm">({subCat.subLevels?.length || 0} alt seviye)</span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-sm">({subCat.questions?.length || 0} soru)</span>
                        )}
                        {!subCat.hasSubLevels && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--accent)]/15 text-[var(--accent)] rounded">Doğrudan Sorular</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {subCat.hasSubLevels ? (
                          <button 
                            onClick={() => openModal('sublevel', subCat.id)} 
                            className="p-1.5 hover:bg-[var(--bg-card-2)] rounded text-[var(--text-muted)]" 
                            title="Alt Seviye Ekle"
                          >
                            <Plus size={16} />
                          </button>
                        ) : (
                          <>
                            <button 
                              onClick={() => openModal('question', subCat.id, undefined, { isSubCategory: true })} 
                              className="p-1.5 hover:bg-[var(--bg-card-2)] rounded text-[var(--text-muted)]" 
                              title="Soru Ekle"
                            >
                              <Plus size={16} />
                            </button>
                            <button 
                              onClick={() => openBulkUploadModal(subCat.id, true)} 
                              className="p-1.5 hover:bg-[var(--success-bg)] rounded text-[var(--accent)]" 
                              title="Excel'den Toplu Yükle"
                            >
                              <Upload size={16} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => openModal('subcategory', category.id, subCat)} 
                          className="p-1.5 hover:bg-[var(--bg-card-2)] rounded text-[var(--text-muted)]" 
                          title="Düzenle"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete('subcategory', subCat.id)} 
                          className="p-1.5 hover:bg-[rgba(239,68,68,0.15)] rounded text-[var(--error)]" 
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
                                <div className="flex items-center justify-between p-3 bg-[rgba(99,102,241,0.1)]">
                                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(`level-${subLevel.id}`)}>
                                    {expanded[`level-${subLevel.id}`] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    <span className="font-medium text-[var(--blue-main)]">{subLevel.name}</span>
                                    <span className="text-[var(--blue-main)] text-sm">({subLevel.questions?.length || 0} soru)</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      subLevel.axisType === 'VELOCITY' 
                                        ? 'bg-[var(--bg-card-2)] text-[var(--accent)]' 
                                        : 'bg-[rgba(12,193,195,0.15)] text-[var(--accent)]'
                                    }`}>
                                      {subLevel.axisType === 'VELOCITY' ? 'X: Velocity' : 'Y: Endurance'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => openModal('question', subLevel.id, undefined, { isSubCategory: false })} 
                                      className="p-1.5 hover:bg-[var(--blue-main)]/15 rounded text-[var(--blue-main)]" 
                                      title="Soru Ekle"
                                    >
                                      <Plus size={16} />
                                    </button>
                                    <button 
                                      onClick={() => openBulkUploadModal(subLevel.id, false)} 
                                      className="p-1.5 hover:bg-[rgba(12,193,195,0.15)] rounded text-[var(--accent)]" 
                                      title="Excel'den Toplu Yükle"
                                    >
                                      <Upload size={16} />
                                    </button>
                                    <button 
                                      onClick={() => openModal('sublevel', subCat.id, subLevel)} 
                                      className="p-1.5 hover:bg-[var(--blue-main)]/15 rounded text-[var(--blue-main)]" 
                                      title="Düzenle"
                                    >
                                      <Edit size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDelete('sublevel', subLevel.id)} 
                                      className="p-1.5 hover:bg-[rgba(239,68,68,0.15)] rounded text-[var(--error)]" 
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
                            ? 'bg-[var(--accent)] text-white shadow-md'
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
                      <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Şıklar</label>
                      <textarea
                        value={formData.optionsText || ''}
                        onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                        className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        rows={5}
                        placeholder={`Düşük = 1\nOrta = 3\nYüksek = 5`}
                      />
                      <p className="text-xs text-[var(--text-dim)] mt-1">
                        Her satıra bir şık: <strong>Etiket = puan</strong>. Aynı satırda &quot;;&quot; ile de ayırabilirsiniz.
                        Puan ondalıklı olabilir (2,5). Kullanıcı bir şık seçtiğinde o şıkkın puanı, soru ağırlığıyla çarpılır.
                      </p>
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
                  {formData.type === 'CONDITIONAL_CHOICE' && (
                    <div className="space-y-4 p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--border-soft)]">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-[var(--accent)]" />
                        <h4 className="font-medium text-[var(--text-main)]">Kademeli Puanlama Ayarları</h4>
                      </div>
                      <p className="text-xs text-[var(--text-dim)] mb-3">
                        Önce evet/hayır sorusu sorulur. "Evet" seçilirse alt seçenekler gösterilir ve kullanıcı birden fazla seçenek işaretleyebilir. Toplam puan = seçilen seçeneklerin puanlarının toplamı.
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Eşik Sorusu (Ana Soru)</label>
                        <input
                          type="text"
                          value={formData.thresholdQuestion || formData.text || ''}
                          onChange={(e) => setFormData({ ...formData, thresholdQuestion: e.target.value })}
                          placeholder="Örn: ISO Belgeniz var mı?"
                          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Evet Etiketi</label>
                          <input
                            type="text"
                            value={formData.yesLabel || 'Evet'}
                            onChange={(e) => setFormData({ ...formData, yesLabel: e.target.value })}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Hayır Etiketi</label>
                          <input
                            type="text"
                            value={formData.noLabel || 'Hayır'}
                            onChange={(e) => setFormData({ ...formData, noLabel: e.target.value })}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                          Alt Seçenekler
                        </label>
                        <textarea
                          value={formData.conditionalOptionsText || ''}
                          onChange={(e) => setFormData({ ...formData, conditionalOptionsText: e.target.value })}
                          className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                          rows={6}
                          placeholder={`ISO 9001 = 2\nISO 14001 = 2\nISO 27001 = 1\nISO 45001 = 1`}
                        />
                        <p className="text-xs text-[var(--text-dim)] mt-1">
                          Her satıra bir seçenek: <strong>Etiket = puan</strong>. Ondalık yazılabilir (2,5).
                          Kullanıcı birden fazla seçenek işaretleyebilir; puanlar toplanır ve en fazla 5 olur.
                        </p>
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
                  <div className="p-4 bg-[var(--accent)]/10 border border-[var(--warning)]/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={20} className="text-[var(--warning)]" />
                      <span className="font-medium text-[var(--warning)]">Alt Seviye Yapısı</span>
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
                    <p className="text-xs text-[var(--warning)] mt-2">
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
                    <div className="p-4 bg-[var(--bg-card-2)] border border-[var(--blue-main)] rounded-lg">
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
          <div className={`bg-[var(--bg-card)] rounded-xl p-6 w-full max-h-[90vh] overflow-y-auto ${bulkPreview ? 'max-w-7xl' : 'max-w-lg'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                {bulkPreview ? 'Aktarmadan Önce Kontrol Edin' : "Excel'den Toplu Soru Yükle"}
              </h2>
              <button onClick={() => { setShowBulkUpload(null); setBulkUploadResult(null); setBulkPreview(null); }} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>

            {bulkPreview ? (
              <QuestionImportPreview
                payload={bulkPreview}
                withStructure={false}
                saving={bulkUploading}
                onCancel={() => setBulkPreview(null)}
                onConfirm={handleBulkConfirm}
              />
            ) : (
            <div className="space-y-4">
              {/* Template Download */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--blue-main)]">
                <h3 className="font-medium text-[var(--accent)] mb-2 flex items-center gap-2">
                  <Download size={18} />
                  1. Şablonu İndir
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  Sorularınızı yalnızca <strong>&quot;Sorular&quot;</strong> sayfasına yazın; dosyadaki diğer sayfalar yardım içindir ve yüklenmez.
                  Örnek satırlar <strong>&quot;Örnekler&quot;</strong>, şık yazımı <strong>&quot;Seçenek Yazımı&quot;</strong>, hangi tipte hangi kolonun dolacağı <strong>&quot;Soru Tipleri&quot;</strong> sayfasında.
                </p>
                <button
                  onClick={handleTemplateDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--blue-main)] text-white rounded-lg hover:bg-[var(--blue-dark)]"
                >
                  <Download size={18} />
                  Soru Yükleme Şablonu İndir (.xlsx)
                </button>
              </div>

              {/* File Upload */}
              <div className="p-4 bg-[rgba(12,193,195,0.1)] rounded-lg border border-[var(--accent)]">
                <h3 className="font-medium text-[var(--accent-bright)] mb-2 flex items-center gap-2">
                  <Upload size={18} />
                  2. Doldurduğunuz Dosyayı Yükleyin
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  Dosyayı seçince önce bir <strong>önizleme</strong> açılır. Soruları orada düzenleyebilir,
                  onayladıktan sonra aktarabilirsiniz — onaylamadan hiçbir şey kaydedilmez.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBulkUpload}
                  disabled={bulkUploading}
                  className="block w-full text-sm text-[var(--text-dim)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent-dark)] file:text-white hover:file:bg-[var(--accent-dark)] disabled:opacity-50"
                />
                {bulkUploading && (
                  <div className="flex items-center gap-2 mt-3 text-[var(--accent)]">
                    <div className="w-4 h-4 border-2 border-[var(--success)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Dosya okunuyor...</span>
                  </div>
                )}
              </div>

              {/* Results */}
              {bulkUploadResult && (
                <div className={`p-4 rounded-lg border ${bulkUploadResult.success ? 'bg-[var(--success-bg)] border-[var(--success)]' : 'bg-[rgba(239,68,68,0.1)] border-[var(--error)]/50'}`}>
                  <h3 className={`font-medium mb-3 flex items-center gap-2 ${bulkUploadResult.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                    {bulkUploadResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    Yükleme Sonucu
                  </h3>
                  
                  {bulkUploadResult.summary && (
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--text-muted)]">{bulkUploadResult.summary.totalRows}</div>
                        <div className="text-xs text-[var(--text-dim)]">Toplam Satır</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--success)]">{bulkUploadResult.summary.successCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Başarılı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--error)]">{bulkUploadResult.summary.errorCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Hatalı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--text-dim)]">{bulkUploadResult.summary.skippedRows || 0}</div>
                        <div className="text-xs text-[var(--text-dim)]">Atlanan</div>
                      </div>
                    </div>
                  )}

                  {bulkUploadResult.errors && bulkUploadResult.errors.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-[var(--error)] mb-2">Hatalı Satırlar:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {bulkUploadResult.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-[var(--error)] p-2 bg-[var(--bg-card)] rounded">
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
                  <li><strong>COKTAN_SECMELI:</strong> Tek şık seçilir — <code>secenekler</code> kolonunu doldurun</li>
                  <li><strong>OLCEK_1_5:</strong> 1-5 arası ölçek — ek kolon gerekmez, puanlama otomatiktir</li>
                  <li><strong>EVET_HAYIR:</strong> Evet/Hayır — <code>evet_puani</code> ve <code>hayir_puani</code> kolonlarını doldurun</li>
                  <li><strong>KADEMELI_PUANLAMA:</strong> Önce evet/hayır, &quot;Evet&quot; ise çoklu seçim — <code>esik_sorusu</code> ve <code>alt_secenekler</code> kolonlarını doldurun</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
                  <p className="text-sm text-[var(--text-muted)]">
                    <strong>Şıklar nasıl yazılır?</strong> Hepsi tek hücreye, tek satırda:
                  </p>
                  <p className="text-sm font-mono mt-1 text-[var(--accent)]">Düşük = 1; Orta = 3; Yüksek = 5</p>
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Her şık &quot;Etiket = puan&quot;, şıklar arasında &quot;;&quot;. Puan ondalıklı olabilir (2,5).
                  </p>
                </div>
              </div>
            </div>
            )}

            {!bulkPreview && (
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowBulkUpload(null); setBulkUploadResult(null); }}
                  className="px-4 py-2 bg-[var(--border-soft)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--ui-passive)]"
                >
                  Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Survey-Level Bulk Upload Modal */}
      {showSurveyBulkUpload && selectedSurveyId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`bg-[var(--bg-card)] rounded-xl p-6 w-full max-h-[90vh] overflow-y-auto ${surveyBulkPreview ? 'max-w-[95vw]' : 'max-w-2xl'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                {surveyBulkPreview ? '📋 Aktarmadan Önce Kontrol Edin' : '📊 Ankete Toplu Soru Yükle'}
              </h2>
              <button onClick={() => { setShowSurveyBulkUpload(false); setSurveyBulkUploadResult(null); setSurveyBulkPreview(null); }} className="text-[var(--text-dim)] hover:text-[var(--text-muted)]">
                <X size={24} />
              </button>
            </div>

            <div className="bg-[var(--accent)]/10 border border-[var(--warning)]/50 rounded-lg p-3 mb-4">
              <p className="text-sm text-[var(--warning)]">
                <strong>Seçili Anket:</strong> {surveys.find(s => s.id === selectedSurveyId)?.name}
              </p>
              <p className="text-xs text-[var(--warning)] mt-1">
                {surveyBulkPreview
                  ? 'Aşağıdaki sorular henüz kaydedilmedi. Düzenleyip onayladığınızda bu ankete eklenecek.'
                  : 'Bu şablon, anketin tüm kategori ve alt kategorilerini içerir. Tek dosyada tüm soruları yükleyebilirsiniz.'}
              </p>
            </div>

            {surveyBulkPreview ? (
              <QuestionImportPreview
                payload={surveyBulkPreview}
                withStructure
                saving={surveyBulkUploading}
                onCancel={() => setSurveyBulkPreview(null)}
                onConfirm={handleSurveyBulkConfirm}
              />
            ) : (
            <div className="space-y-4">
              {/* Template Download */}
              <div className="p-4 bg-[var(--bg-card-2)] rounded-lg border border-[var(--blue-main)]">
                <h3 className="font-medium text-[var(--accent)] mb-2 flex items-center gap-2">
                  <Download size={18} />
                  1. Anket Şablonunu İndir
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  &quot;Sorular&quot; sayfası anketin tüm yapısıyla (kategori, alt kategori, alt seviye) hazır gelir;
                  siz yalnızca soru satırlarını doldurun. Dosyadaki diğer sayfalar yardım içindir ve yüklenmez.
                </p>
                <button
                  onClick={handleSurveyTemplateDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--blue-main)] text-white rounded-lg hover:bg-[var(--blue-dark)]"
                >
                  <Download size={18} />
                  Anket Soru Şablonu İndir (.xlsx)
                </button>
              </div>

              {/* File Upload */}
              <div className="p-4 bg-[rgba(12,193,195,0.1)] rounded-lg border border-[var(--accent)]">
                <h3 className="font-medium text-[var(--accent-bright)] mb-2 flex items-center gap-2">
                  <Upload size={18} />
                  2. Doldurduğunuz Dosyayı Yükleyin
                </h3>
                <p className="text-sm text-[var(--accent)] mb-3">
                  Dosyayı seçince önce bir <strong>önizleme</strong> açılır: her sorunun kategorisini, tipini ve
                  şıklarını orada düzeltebilirsiniz. <strong>Onaylamadan hiçbir soru kaydedilmez.</strong>
                </p>
                <input
                  ref={surveyFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleSurveyBulkUpload}
                  disabled={surveyBulkUploading}
                  className="block w-full text-sm text-[var(--text-dim)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent-dark)] file:text-white hover:file:bg-[var(--accent-dark)] disabled:opacity-50"
                />
                {surveyBulkUploading && (
                  <div className="flex items-center gap-2 mt-3 text-[var(--accent)]">
                    <div className="w-4 h-4 border-2 border-[var(--success)] border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Dosya okunuyor...</span>
                  </div>
                )}
              </div>

              {/* Results */}
              {surveyBulkUploadResult && (
                <div className={`p-4 rounded-lg border ${surveyBulkUploadResult.success ? 'bg-[var(--success-bg)] border-[var(--success)]' : 'bg-[rgba(239,68,68,0.1)] border-[var(--error)]/50'}`}>
                  <h3 className={`font-medium mb-3 flex items-center gap-2 ${surveyBulkUploadResult.success ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
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
                        <div className="text-lg font-bold text-[var(--success)]">{surveyBulkUploadResult.summary.successCount}</div>
                        <div className="text-xs text-[var(--text-dim)]">Başarılı</div>
                      </div>
                      <div className="text-center p-2 bg-[var(--bg-card)] rounded-lg">
                        <div className="text-lg font-bold text-[var(--error)]">{surveyBulkUploadResult.summary.errorCount}</div>
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
                      <h4 className="text-sm font-medium text-[var(--error)] mb-2">Hatalı Satırlar:</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {surveyBulkUploadResult.errors.map((err, idx) => (
                          <div key={idx} className="text-sm text-[var(--error)] p-2 bg-[var(--bg-card)] rounded">
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
                  <li>• Şablondaki &quot;Anket Yapısı&quot; sayfasından doğru isimleri kopyalayabilirsiniz</li>
                  <li>• <strong>soru_metni</strong> boş bırakılan satırlar yüklenmez — kullanmadığınız satırları silmeniz gerekmez</li>
                  <li>• Şık yazımı için &quot;Seçenek Yazımı&quot;, tip başına gereken kolonlar için &quot;Soru Tipleri&quot; sayfasına bakın</li>
                  <li>• &quot;Örnekler&quot; sayfası yalnızca referanstır; yüklenmez</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-[var(--border-soft)]">
                  <p className="text-sm text-[var(--text-muted)]">
                    <strong>Şıklar nasıl yazılır?</strong> Hepsi tek hücreye, tek satırda:
                  </p>
                  <p className="text-sm font-mono mt-1 text-[var(--accent)]">Düşük = 1; Orta = 3; Yüksek = 5</p>
                </div>
              </div>
            </div>
            )}

            {!surveyBulkPreview && (
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowSurveyBulkUpload(false); setSurveyBulkUploadResult(null); }}
                  className="px-4 py-2 bg-[var(--border-soft)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--ui-passive)]"
                >
                  Kapat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
