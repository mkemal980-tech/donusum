"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, FileText, X, Save, CheckCircle, XCircle, AlertTriangle, Loader2, Eye, Copy, Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Survey {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDemo: boolean;
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

interface DeleteImpact {
  categories: number;
  subCategories: number;
  subLevels: number;
  questions: number;
  responses: number;
  recommendations: number;
  benchmarks: number;
  total: number;
}

interface DeleteConfirmState {
  show: boolean;
  surveyId: string;
  surveyName: string;
  impact: DeleteImpact | null;
  confirmText: string;
  loading: boolean;
  deleting: boolean;
}

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Survey | null>(null);
  const [formData, setFormData] = useState<Partial<Survey>>({});
  /** Kopyalanmakta olan anket — düğme iki kez basılmasın. */
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  
  // Silme onay state'i
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    show: false,
    surveyId: '',
    surveyName: '',
    impact: null,
    confirmText: '',
    loading: false,
    deleting: false
  });

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
      const res = await fetch('/api/admin/surveys', {
        method: formData.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        // API'den gelen hata mesajını göster
        toast.error(data.error || 'Anket kaydedilemedi', {
          duration: 5000,
          description: data.code === 'EMPTY_SURVEY' 
            ? 'Önce kategoriler sayfasından soru ekleyin.' 
            : data.code === 'NO_QUESTIONS'
            ? 'Ankette en az bir soru olmalıdır.'
            : undefined
        });
        return;
      }
      
      toast.success(formData.id ? 'Anket güncellendi' : 'Anket oluşturuldu');
      fetchSurveys();
      setShowModal(false);
      setEditItem(null);
      setFormData({});
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Bir hata oluştu');
    }
  };

  // Silme işlemini başlat - önce etki analizi yap
  /**
   * Anketi her şeyiyle çoğaltır.
   *
   * Kopya pasif başlar ve kimseye atanmaz; kullanıcıların ekranında ancak
   * gözden geçirilip aktif edildikten sonra belirir.
   */
  const duplicateSurvey = async (survey: Survey) => {
    if (!confirm(`"${survey.name}" anketinin tam bir kopyası oluşturulacak.\n\nKopya pasif başlar; cevaplar ve kullanıcı atamaları kopyalanmaz.`)) {
      return;
    }

    setDuplicatingId(survey.id);
    try {
      const res = await fetch('/api/admin/surveys/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId: survey.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Anket kopyalanamadı');
        return;
      }

      const s = data.summary;
      toast.success(
        `"${data.survey.name}" oluşturuldu — ${s.categories} kategori, ${s.subCategories} bölüm, ${s.questions} soru, ${s.recommendations} öneri.`,
        { duration: 6000 }
      );
      fetchSurveys();
    } catch (error) {
      console.error('Kopyalama hatası:', error);
      toast.error('Kopyalama sırasında hata oluştu');
    } finally {
      setDuplicatingId(null);
    }
  };

  const initiateDelete = async (survey: Survey) => {
    setDeleteConfirm({
      show: true,
      surveyId: survey.id,
      surveyName: survey.name,
      impact: null,
      confirmText: '',
      loading: true,
      deleting: false
    });
    
    try {
      const res = await fetch(`/api/admin/surveys?action=delete-impact&id=${survey.id}`);
      const data = await res.json();
      
      if (data.error) {
        toast.error(data.error);
        setDeleteConfirm(prev => ({ ...prev, show: false }));
        return;
      }
      
      setDeleteConfirm(prev => ({
        ...prev,
        impact: data.impact,
        loading: false
      }));
    } catch (error) {
      console.error('Error fetching impact:', error);
      toast.error('Etki analizi yapılamadı');
      setDeleteConfirm(prev => ({ ...prev, show: false }));
    }
  };
  
  // Gerçek silme işlemi
  const handleDelete = async () => {
    if (deleteConfirm.confirmText !== deleteConfirm.surveyName) {
      toast.error('Anket adı eşleşmiyor!');
      return;
    }
    
    setDeleteConfirm(prev => ({ ...prev, deleting: true }));
    
    try {
      const res = await fetch(`/api/admin/surveys?id=${deleteConfirm.surveyId}`, { method: 'DELETE' });
      
      if (res.ok) {
        toast.success('Anket başarıyla silindi');
        fetchSurveys();
        setDeleteConfirm({
          show: false,
          surveyId: '',
          surveyName: '',
          impact: null,
          confirmText: '',
          loading: false,
          deleting: false
        });
      } else {
        toast.error('Silme işlemi başarısız');
        setDeleteConfirm(prev => ({ ...prev, deleting: false }));
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Silme işlemi sırasında hata oluştu');
      setDeleteConfirm(prev => ({ ...prev, deleting: false }));
    }
  };
  
  // Silme işlemini iptal et
  const cancelDelete = () => {
    setDeleteConfirm({
      show: false,
      surveyId: '',
      surveyName: '',
      impact: null,
      confirmText: '',
      loading: false,
      deleting: false
    });
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
        <div className="spinner" role="status" aria-label="Yükleniyor" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="t-display" style={{ color: "var(--ink)" }}>Anketler</h1>
        <Button
          onClick={() => openModal()}
        >
          <Plus size={20} /> Yeni Anket
        </Button>
      </div>

      {/* Survey List */}
      <div className="grid gap-4">
        {surveys.map((survey) => (
          <div key={survey.id} className="theme-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--accent)] rounded-lg flex items-center justify-center">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-main)]">{survey.name}</h3>
                    {survey.isActive ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent-ink)] rounded text-xs">
                        <CheckCircle size={12} /> Aktif
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--bg-card-2)] text-[var(--text-dim)] rounded text-xs">
                        <XCircle size={12} /> Pasif
                      </span>
                    )}
                    {survey.isDemo && (
                      <span
                        className="px-2 py-0.5 bg-[rgba(99,102,241,0.15)] text-[#818cf8] rounded text-xs"
                        title="Kayıt olan kullanıcılara otomatik atanır; değerlendirmeleri yönetici raporlarına girmez"
                      >
                        Tanıtım
                      </span>
                    )}
                    {/* Boş anket uyarısı */}
                    {survey._count.categories === 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-[var(--warning)]/15 text-[var(--warning)] rounded text-xs" title="Bu ankette kategori veya soru bulunmuyor">
                        <AlertTriangle size={12} /> Boş Anket
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-dim)]">
                    {survey.description || 'Açıklama yok'}
                    <span className="ml-2 text-[var(--text-muted)]">• {survey._count.categories} kategori</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--accent)]">{survey._count.categories}</p>
                  <p className="text-xs text-[var(--text-dim)]">Kategori</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/survey-preview/${survey.id}`}
                    className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--accent)]"
                    title="Anketi kullanıcının gördüğü gibi önizle"
                  >
                    <Eye size={18} />
                  </Link>
                  <Link
                    href={`/admin/categories?surveyId=${survey.id}`}
                    className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--blue-main)]"
                    title="Kategorileri Yönet"
                  >
                    <FileText size={18} />
                  </Link>
                  <Button
                    onClick={() => openModal(survey)} 
                    title="Düzenle"
                    variant="ghost"
                    size="icon"
                    className="text-[var(--blue-main)]"
                  >
                    <Edit size={18} />
                  </Button>
                  {/* Kategori/soru tanımı bitince öneri yazma sırası gelir;
                      şablon o anketin soru ve şıklarıyla hazır iner. */}
                  <a
                    href={`/api/admin/recommendations/template?surveyId=${survey.id}`}
                    className="p-2 hover:bg-[var(--bg-card-2)] rounded text-[var(--warning)]"
                    title={`"${survey.name}" için öneri şablonu indir — her soru ve şık için hazır satır`}
                  >
                    <Download size={18} />
                  </a>
                  <Button
                    onClick={() => duplicateSurvey(survey)}
                    disabled={duplicatingId === survey.id}
                    title={`"${survey.name}" anketini her şeyiyle kopyala — sorular, öneriler, kapsam kuralları`}
                    variant="ghost"
                    size="icon"
                    className="text-[var(--accent)]"
                  >
                    {duplicatingId === survey.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Copy size={18} />
                    )}
                  </Button>
                  <Button
                    onClick={() => initiateDelete(survey)} 
                    title="Sil"
                    variant="ghost"
                    size="icon"
                    className="hover:bg-[var(--error-bg)] text-[var(--error-ink)]"
                  >
                    <Trash2 size={18} />
                  </Button>
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
          <div className="theme-card p-8 text-center">
            <FileText className="mx-auto text-[var(--text-dim)] mb-4" size={48} />
            <p className="text-[var(--text-dim)] mb-4">Henüz anket oluşturulmamış</p>
            <Button
              onClick={() => openModal()}
            >
              İlk Anketi Oluştur
            </Button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-card p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-main)]">{editItem ? 'Anket Düzenle' : 'Yeni Anket'}</h2>
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
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  placeholder="Örn: 2025 Dijital Dönüşüm Anketi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Açıklama</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
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
                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive ?? true}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-5 h-5 text-[var(--accent)] rounded"
                    />
                    <span className="text-sm text-[var(--text-muted)]">Aktif</span>
                  </label>
                </div>

                {/* Tanıtım anketi: yeni kayıtlara otomatik atanır ve
                    raporlardan dışlanır. İkisi de aynı işaretten geliyor. */}
                <div className="col-span-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDemo ?? false}
                      onChange={(e) => setFormData({ ...formData, isDemo: e.target.checked })}
                      className="w-5 h-5 mt-0.5 text-[var(--accent)] rounded"
                    />
                    <span className="text-sm text-[var(--text-muted)]">
                      Tanıtım anketi
                      <span className="block text-xs text-[var(--text-dim)]">
                        Kayıt olan kullanıcılara otomatik atanır. Bu ankete verilen cevaplar
                        yönetici raporlarındaki puan ortalamalarına girmez.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button
                onClick={() => setShowModal(false)}
                variant="ghost"
                className="text-[var(--text-muted)]"
              >
                İptal
              </Button>
              <Button
                onClick={handleSave}
              >
                <Save size={18} />
                {editItem ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Silme Onay Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="theme-card p-6 w-full max-w-lg border border-[var(--error)]/30">
            {deleteConfirm.loading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                <p className="mt-4 text-[var(--text-muted)]">Etki analizi yapılıyor...</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-[var(--error-bg)] rounded-full flex items-center justify-center">
                    <AlertTriangle className="text-[var(--error)]" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--error)]">Tehlikeli İşlem!</h2>
                    <p className="text-sm text-[var(--text-dim)]">Bu işlem geri alınamaz</p>
                  </div>
                </div>
                
                {/* Anket Bilgisi */}
                <div className="bg-[var(--error-bg)] border border-[var(--error)]/30 rounded-lg p-4 mb-4">
                  <p className="text-[var(--text-main)] font-medium">
                    &ldquo;{deleteConfirm.surveyName}&rdquo; anketini silmek üzeresiniz.
                  </p>
                </div>
                
                {/* Etki Analizi */}
                {deleteConfirm.impact && (
                  <div className="bg-[var(--bg-card-2)] rounded-lg p-4 mb-4">
                    <h3 className="text-[var(--text-main)] font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-[var(--warning)]" />
                      Silinecek Kayıtlar:
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {deleteConfirm.impact.categories > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Kategoriler:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.categories}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.subCategories > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Alt Kategoriler:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.subCategories}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.subLevels > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Alt Seviyeler:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.subLevels}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.questions > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Sorular:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.questions}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.responses > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Kullanıcı Cevapları:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.responses}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.recommendations > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Öneriler:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.recommendations}</span>
                        </div>
                      )}
                      {deleteConfirm.impact.benchmarks > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[var(--text-dim)]">Benchmark&apos;lar:</span>
                          <span className="text-[var(--error)] font-medium">{deleteConfirm.impact.benchmarks}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border-soft)] flex justify-between">
                      <span className="text-[var(--text-main)] font-semibold">Toplam:</span>
                      <span className="text-[var(--error)] font-semibold">{deleteConfirm.impact.total} kayıt silinecek</span>
                    </div>
                  </div>
                )}
                
                {/* Onay Kutusu */}
                <div className="mb-4">
                  <label className="block text-sm text-[var(--text-muted)] mb-2">
                    Silmek için anket adını yazın: <span className="font-semibold text-[var(--error)]">{deleteConfirm.surveyName}</span>
                  </label>
                  <input
                    type="text"
                    value={deleteConfirm.confirmText}
                    onChange={(e) => setDeleteConfirm(prev => ({ ...prev, confirmText: e.target.value }))}
                    placeholder="Anket adını buraya yazın..."
                    className="w-full p-3 border border-[var(--error)]/30 rounded-lg bg-[var(--bg-card-2)] text-[var(--text-main)] focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                
                {/* Butonlar */}
                <div className="flex justify-end gap-3">
                  <Button
                    onClick={cancelDelete}
                    disabled={deleteConfirm.deleting}
                    variant="ghost"
                    className="text-[var(--text-muted)]"
                  >
                    İptal
                  </Button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteConfirm.confirmText !== deleteConfirm.surveyName || deleteConfirm.deleting}
                    className="px-4 py-2 bg-[var(--error)] text-[var(--canvas)] rounded-lg hover:bg-[var(--error)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {deleteConfirm.deleting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Siliniyor...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Kalıcı Olarak Sil
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
